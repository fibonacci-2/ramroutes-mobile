/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest, onCall, HttpsError} = require("firebase-functions/https");
const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");
const {embedTexts, cosineSimilarity} = require("./embedder");
const {getScoutReply} = require("./scoutModel");

// Initialize Firebase Admin SDK
initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// Firestore doc IDs (letters/digits/-/_) are always valid FCM topic names -
// see usePushNotifications.ts (ramroutes-mobile) for the matching subscribe side.
function schoolTopic(schoolId) {
  return `school-${schoolId}`;
}

// score = tagOverlap + λ·cosine(profile_emb, event_emb), λ = 0.5 - mirrors
// scraper/recommend.js's scoring exactly (see PLAN.md's "personalization v2
// (embeddings)" section). Duplicated rather than shared for the same reason
// as embedder.js - functions/ and scraper/ are separate deployable projects.
const RECOMMENDATION_LAMBDA = 0.5;

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
  return tagScore + RECOMMENDATION_LAMBDA * embScore;
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


/**
 * Notify each affected school once when a scraper bulk import finishes,
 * instead of once per event. Triggers when the scraper (Admin/scraper/server.js
 * POST /api/upload) writes its post-upload summary to event-import-batches.
 */
exports.notifyEventImportBatch = onDocumentCreated("event-import-batches/{batchId}", async (event) => {
  try {
    const batchData = event.data.data();
    const batchId = event.params.batchId;
    const schools = Array.isArray(batchData.schools) ? batchData.schools : [];

    if (schools.length === 0) {
      logger.info("Event import batch has no school breakdown, skipping", { batchId });
      return null;
    }

    logger.info("Processing event import batch", {
      batchId: batchId,
      totalUploaded: batchData.totalUploaded,
      schoolCount: schools.length
    });

    const results = await Promise.allSettled(schools.map(async (school) => {
      if (!school.schoolId || !school.count) return null;

      const topic = schoolTopic(school.schoolId);
      const schoolName = school.schoolName || "your school";

      const message = {
        topic: topic,
        notification: {
          title: school.count === 1 ? "New Event!" : `${school.count} New Events!`,
          body: school.count === 1
            ? `A new event was just added at ${schoolName}. Check it out!`
            : `${school.count} new events were just added at ${schoolName}. Check them out!`
        },
        data: {
          batchId: batchId,
          schoolId: school.schoolId,
          count: String(school.count),
          type: "event_import_batch"
        },
        android: {
          notification: {
            icon: "ic_notification",
            color: "#4CAF50",
            sound: "default"
          },
          priority: "high",
          data: {
            force_foreground: "true"
          }
        },
        apns: {
          payload: {
            aps: {
              badge: 1,
              sound: "default"
            }
          }
        }
      };

      const response = await getMessaging().send(message);
      logger.info("Successfully sent event import batch notification", {
        messageId: response,
        batchId: batchId,
        schoolId: school.schoolId,
        count: school.count
      });
      return response;
    }));

    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      logger.error("Some event import batch notifications failed", {
        batchId: batchId,
        failureCount: failures.length,
        errors: failures.map((f) => f.reason?.message)
      });
    }

    return null;

  } catch (error) {
    logger.error("Error processing event import batch notification", {
      error: error.message,
      batchId: event.params.batchId
    });
    throw error;
  }
});

/**
 * Recompute one user's recommendedEvents as soon as their profile actually
 * changes, instead of waiting for scraper/recommend.js's nightly batch.
 * Triggers on every users/{userId} write, but does real work only when
 * profileHash differs - src/services/users.ts writes a fresh profileHash
 * (a fingerprint of bio+major+interests) alongside every bio/major/interests
 * update, so this is a single cheap field comparison rather than diffing
 * three fields (and staying correct if more profile fields are added later).
 *
 * A single edit can still only produce one profileHash write per ~2s of
 * inactivity per field - see the debounce in useUserBio/useStudentProfile/
 * useInterests - so this doesn't need its own coalescing on top of that.
 */
exports.recomputeRecommendationsOnProfileChange = onDocumentUpdated("users/{userId}", async (event) => {
  const userId = event.params.userId;
  try {
    const before = event.data.before.data();
    const after = event.data.after.data();

    if (!after.profileHash || before.profileHash === after.profileHash) {
      return null;
    }

    const admin = require("firebase-admin");
    const db = admin.firestore();

    const interests = Array.isArray(after.interests) ? after.interests : [];
    const hasProfileText = Boolean(after.major) || Boolean(after.bio);

    if (!after.schoolId) {
      // Mid-onboarding (AppGate blocks profile edits before schoolId is set
      // in the normal flow, but this trigger fires on any users/{userId}
      // write) - nothing sensible to recommend against yet.
      return null;
    }

    if (interests.length === 0 && !hasProfileText) {
      // Nothing left to recommend from (e.g. user cleared their bio/major
      // and had no tags) - clear a stale list instead of leaving it stuck.
      if (Array.isArray(after.recommendedEvents) && after.recommendedEvents.length > 0) {
        await event.data.after.ref.update({ recommendedEvents: [] });
      }
      return null;
    }

    logger.info("Profile changed, recomputing recommendations", { userId, schoolId: after.schoolId });

    // Scoped to the user's own school - building-events has no cross-school
    // relevance, and scoring against every school's catalog meant
    // recommendedEvents could end up full of events from a school the user
    // isn't even enrolled in (which the app's schoolId-scoped event
    // subscription then can't resolve locally at all).
    const eventsSnap = await db.collection("building-events").where("schoolId", "==", after.schoolId).get();
    const events = eventsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((e) => Array.isArray(e.tags) && e.tags.length > 0);

    // Embeddings live in a separate collection (see scraper/server.js's
    // /api/upload) - the mobile app subscribes to building-events directly
    // and never reads embeddings, so keeping them off that doc keeps its
    // client-facing payload small. Merge them back in here for scoring -
    // fetched by exact id (one batched round trip via getAll, not a full
    // collection scan) so this only ever loads embeddings for the events
    // already scoped to this user's school above. The earlier version did
    // db.collection("event-embeddings").get() with no scoping at all, which
    // pulled every school's embeddings into memory on every single profile
    // edit and was the actual cause of this function's OOM - the
    // building-events scoping alone didn't touch this second read.
    const embeddingRefs = events.map((e) => db.collection("event-embeddings").doc(e.id));
    const embeddingDocs = embeddingRefs.length ? await db.getAll(...embeddingRefs) : [];
    const embeddingById = new Map();
    embeddingDocs.forEach((snap, i) => {
      if (snap.exists) embeddingById.set(events[i].id, snap.data().embedding);
    });
    for (const e of events) {
      const embedding = embeddingById.get(e.id);
      if (embedding) e.embedding = embedding;
    }

    let profileEmbedding = null;
    const text = profileText(after);
    if (text) {
      try {
        [profileEmbedding] = await embedTexts([text]);
      } catch (err) {
        logger.warn("Profile embedding failed, falling back to tag-only scoring", {
          userId,
          error: err.message
        });
      }
    }

    const scored = events
      .map((e) => ({ id: e.id, eventName: e.eventName, score: scoreEvent(e, interests, profileEmbedding) }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score);
    const recommended = dedupeByName(scored).slice(0, 10).map((e) => e.id);

    await event.data.after.ref.update({ recommendedEvents: recommended });
    logger.info("Recomputed recommendations", { userId, count: recommended.length });
    return null;
  } catch (error) {
    logger.error("Error recomputing recommendations on profile change", {
      error: error.message,
      userId
    });
    // Don't rethrow - a bad profile shouldn't retry-storm this trigger.
    return null;
  }
});

/**
 * Notify a student when their "For you" section actually changes - not on
 * every users/{userId} write, only when recommendedEvents' membership
 * differs from before. Fires regardless of which process wrote the update
 * (recomputeRecommendationsOnProfileChange above, or scraper/recommend.js's
 * nightly batch) since both just do a plain Firestore update on this doc.
 * Compared as a set, not an ordered list: a pure re-rank of the same 10
 * events isn't something a student would perceive as new content, so it
 * shouldn't page them.
 */
exports.notifyRecommendationsUpdated = onDocumentUpdated("users/{userId}", async (event) => {
  const userId = event.params.userId;
  try {
    const before = event.data.before.data();
    const after = event.data.after.data();

    const beforeIds = new Set(Array.isArray(before.recommendedEvents) ? before.recommendedEvents : []);
    const afterIds = Array.isArray(after.recommendedEvents) ? after.recommendedEvents : [];

    const changed = afterIds.length !== beforeIds.size || afterIds.some((id) => !beforeIds.has(id));
    if (!changed || afterIds.length === 0) {
      return null;
    }

    const fcmToken = after.notificationToken;
    if (!fcmToken) {
      logger.info("Recommendations changed but user has no notification token", { userId });
      return null;
    }

    logger.info("Recommendations changed, notifying user", { userId, count: afterIds.length });

    const message = {
      token: fcmToken,
      notification: {
        title: "Your For You list just updated",
        body: `${afterIds.length} event${afterIds.length === 1 ? "" : "s"} picked for you - take a look!`
      },
      data: {
        userId,
        count: String(afterIds.length),
        type: "recommendations_updated"
      },
      android: {
        notification: {
          icon: "ic_notification",
          color: "#4CAF50",
          sound: "default"
        },
        priority: "high",
        data: {
          force_foreground: "true"
        }
      },
      apns: {
        payload: {
          aps: {
            badge: 1,
            sound: "default"
          }
        }
      }
    };

    const response = await getMessaging().send(message);
    logger.info("Successfully sent recommendations-updated notification", {
      messageId: response,
      userId,
      count: afterIds.length
    });
    return response;
  } catch (error) {
    logger.error("Error sending recommendations-updated notification", {
      error: error.message,
      userId
    });
    // Don't rethrow - a bad token/profile shouldn't retry-storm this trigger.
    return null;
  }
});

/**
 * Callable Scout chat endpoint - the RN app invokes this via
 * @react-native-firebase/functions instead of calling OpenRouter directly,
 * so the API key never ships in the app bundle (same reasoning as
 * embedder.js). Retrieval mirrors recomputeRecommendationsOnProfileChange:
 * school-scoped events + their embeddings (event-embeddings collection),
 * ranked by cosine similarity against the student's message, so Scout is
 * grounded in real events instead of free-associating.
 */
exports.scoutReply = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }

  const message = typeof request.data?.message === "string" ? request.data.message.trim() : "";
  if (!message) {
    throw new HttpsError("invalid-argument", "message is required.");
  }

  // Last few turns only - Scout doesn't need the whole conversation to stay
  // coherent, and it keeps the prompt (and cost) bounded.
  const history = Array.isArray(request.data?.history)
    ? request.data.history
        .filter((m) => m && (m.role === "me" || m.role === "ai") && typeof m.text === "string")
        .slice(-6)
    : [];

  const userId = request.auth.uid;

  try {
    const admin = require("firebase-admin");
    const db = admin.firestore();

    const userDoc = await db.collection("users").doc(userId).get();
    const schoolId = userDoc.data()?.schoolId;
    if (!schoolId) {
      throw new HttpsError("failed-precondition", "Pick a school before chatting with Scout.");
    }

    // Bounded + recency-biased rather than every event a school has ever
    // had - a single semester can run into the thousands (PLAN.md), fine
    // for a nightly batch, too slow/costly to reload on every chat message.
    const CANDIDATE_LIMIT = 100;
    const eventsSnap = await db
      .collection("building-events")
      .where("schoolId", "==", schoolId)
      .orderBy("createdAt", "desc")
      .limit(CANDIDATE_LIMIT)
      .get();
    const events = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    const embeddingRefs = events.map((e) => db.collection("event-embeddings").doc(e.id));
    const embeddingDocs = embeddingRefs.length ? await db.getAll(...embeddingRefs) : [];
    const embeddingById = new Map();
    embeddingDocs.forEach((snap, i) => {
      if (snap.exists) embeddingById.set(events[i].id, snap.data().embedding);
    });

    let messageEmbedding = null;
    try {
      [messageEmbedding] = await embedTexts([message]);
    } catch (err) {
      logger.warn("Scout message embedding failed, falling back to unranked candidates", {
        userId,
        error: err.message
      });
    }

    const TOP_K = 8;
    const candidates = messageEmbedding
      ? events
          .map((e) => {
            const embedding = embeddingById.get(e.id);
            return { event: e, score: embedding ? cosineSimilarity(messageEmbedding, embedding) : -1 };
          })
          .filter((c) => c.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_K)
          .map((c) => c.event)
      : events.slice(0, TOP_K);

    const reply = await getScoutReply(message, history, candidates);

    logger.info("Scout reply sent", {
      userId,
      candidateCount: candidates.length,
      eventIdsReturned: reply.eventIds.length
    });
    return reply;
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error generating Scout reply", { error: error.message, userId });
    throw new HttpsError("internal", "Scout couldn't come up with a reply. Try again in a moment.");
  }
});

