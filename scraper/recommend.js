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

// Recurring events (e.g. a weekly "Tango Practica") upload one Firestore doc
// per occurrence, all sharing the same eventName - they score near-identically
// against any given profile, so without this the top 10 could be the same
// title repeated several times instead of 10 distinct events. Must run after
// sorting by score and before slicing to the limit, so it keeps each name's
// best-scoring occurrence and doesn't shrink the final count below the limit.
function dedupeByName(scoredEvents) {
  const seen = new Set();
  const out = [];
  for (const item of scoredEvents) {
    const key = (item.eventName || "").trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
  }
  return out;
}

async function computeRecommendations({ onProgress } = {}) {
  init();

  onProgress?.("Loading tagged events...");
  const eventsSnap = await db.collection("building-events").get();
  const events = eventsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((e) => Array.isArray(e.tags) && e.tags.length > 0);

  // Embeddings live in a separate collection (see server.js's /api/upload) -
  // the mobile app subscribes to building-events directly and never reads
  // embeddings, so keeping them off that doc keeps its client-facing payload
  // small. Merge them back in here, in-memory, for scoring.
  onProgress?.("Loading event embeddings...");
  const embeddingsSnap = await db.collection("event-embeddings").get();
  const embeddingById = new Map(embeddingsSnap.docs.map((doc) => [doc.id, doc.data().embedding]));
  for (const event of events) {
    const embedding = embeddingById.get(event.id);
    if (embedding) event.embedding = embedding;
  }

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

  // Group events by school so each user is scored only against their own
  // campus's catalog - building-events has no cross-school relevance, and
  // without this every user was scored against every school's events,
  // meaning recommendedEvents could end up full of events from a school the
  // user isn't even enrolled in (which the app's schoolId-scoped event
  // subscription then can't resolve locally at all).
  const eventsBySchool = new Map();
  for (const event of events) {
    if (!event.schoolId) continue;
    const list = eventsBySchool.get(event.schoolId);
    if (list) list.push(event);
    else eventsBySchool.set(event.schoolId, [event]);
  }

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
    const schoolEvents = eventsBySchool.get(user.schoolId) || [];
    const scored = schoolEvents
      .map((e) => ({ id: e.id, eventName: e.eventName, score: scoreEvent(e, user.interests, profileEmbedding) }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score);
    const recommended = dedupeByName(scored).slice(0, 10).map((e) => e.id);

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
