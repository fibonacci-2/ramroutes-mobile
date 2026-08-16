const admin = require("firebase-admin");

let db = null;

function init() {
  if (db) return;
  const serviceAccount = require("../serviceAccountKey.json");
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  db = admin.firestore();
}

// score = number of tags in common with user interests
function scoreEvent(event, interests) {
  return (event.tags || []).filter((t) => interests.includes(t)).length;
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
  const users = usersSnap.docs
    .map((doc) => ({ ref: doc.ref, ...doc.data() }))
    .filter((u) => Array.isArray(u.interests) && u.interests.length > 0);

  onProgress?.(`${users.length} users with interests found.`);

  const BATCH_LIMIT = 500;
  let batch = db.batch();
  let opCount = 0;
  let updated = 0;

  for (const user of users) {
    const recommended = events
      .map((e) => ({ id: e.id, score: scoreEvent(e, user.interests) }))
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
