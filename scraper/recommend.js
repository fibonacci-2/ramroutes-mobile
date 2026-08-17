const admin = require("firebase-admin");
const { embedTexts, cosineSimilarity } = require("./embedder");

let db = null;

function init() {
  if (db) return;
  const serviceAccount = require("./serviceAccountKey.json");
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
}

// score = tagOverlap + λ·cosine(profile_emb, event_emb), λ = 0.5 - see
// PLAN.md's "personalization v2 (embeddings)" section.
const LAMBDA = 0.5;

// Same fields PreferencesScreen collects (major, bio, interests) - the
// embedding is what lets a "political science major" match events whose
// description never uses that phrase, which tag overlap alone can't do.
function profileText(user) {
  const parts = [user.major, user.bio, (user.interests || []).join(", ")].filter(Boolean);
  return parts.join(". ");
}

function scoreEvent(event, interests, profileEmbedding) {
  const tagScore = (event.tags || []).filter((t) => (interests || []).includes(t)).length;
  const embScore =
    profileEmbedding && Array.isArray(event.embedding)
      ? cosineSimilarity(profileEmbedding, event.embedding)
      : 0;
  return tagScore + LAMBDA * embScore;
}

async function computeRecommendations({ onProgress } = {}) {
  init();

  onProgress?.("Loading tagged events...");
  const eventsSnap = await db.collection("building-events").get();
  const events = eventsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((e) => Array.isArray(e.tags) && e.tags.length > 0);

  onProgress?.(`${events.length} tagged events loaded.`);

  onProgress?.("Loading users...");
  const usersSnap = await db.collection("users").get();
  // Eligible = has tag interests OR a bio OR a major - not interests-only.
  // A student who picked zero tags but wrote a bio/major still has a real
  // profile to embed and match against event embeddings; gating on
  // interests alone silently skipped them (no embedding, no
  // recommendedEvents at all).
  const users = usersSnap.docs
    .map((doc) => ({ ref: doc.ref, ...doc.data() }))
    .filter((u) => (Array.isArray(u.interests) && u.interests.length > 0) || u.bio || u.major);

  onProgress?.(`${users.length} eligible users found.`);

  // One batched embeddings call for every eligible user's profile text,
  // instead of one call per user. Falls back to tag-only scoring (embScore
  // stays 0 in scoreEvent) if OpenRouter is unreachable, so a flaky call
  // doesn't fail the whole nightly run.
  let userEmbeddings = [];
  if (users.length > 0) {
    try {
      onProgress?.(`Embedding user profiles: ${users.map((u) => u.ref.id).join(", ")}`);
      userEmbeddings = await embedTexts(users.map(profileText));
    } catch (err) {
      onProgress?.(`Profile embedding failed, falling back to tag-only scoring: ${err.message}`);
    }
  }

  const BATCH_LIMIT = 500;
  let batch = db.batch();
  let opCount = 0;
  let updated = 0;

  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    const profileEmbedding = userEmbeddings[i];
    const recommended = events
      .map((e) => ({ id: e.id, score: scoreEvent(e, user.interests, profileEmbedding) }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((e) => e.id);

    if (recommended.length === 0) continue;

    batch.update(user.ref, { recommendedEvents: recommended });
    opCount++;
    updated++;

    if (opCount >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      opCount = 0;
    }
  }

  if (opCount > 0) await batch.commit();

  const result = {
    taggedEvents: events.length,
    usersProcessed: users.length,
    usersUpdated: updated,
  };

  onProgress?.(`Done. ${updated} users updated.`);
  return result;
}

// Standalone mode
if (require.main === module) {
  computeRecommendations({ onProgress: console.log })
    .then((r) => console.log("Result:", r))
    .catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { computeRecommendations };
