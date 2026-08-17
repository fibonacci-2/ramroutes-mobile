/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const {onDocumentCreated, onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {initializeApp} = require("firebase-admin/app");
const {getMessaging} = require("firebase-admin/messaging");
const logger = require("firebase-functions/logger");
const {embedTexts, cosineSimilarity} = require("./embedder");

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

/**
 * Notify students at a school when a new building event is published there.
 * Triggers when a document is created in the building-events collection.
 *
 * Both write paths (Admin/src/components/BuildingEventForm.js and the
 * scraper's /api/upload) stamp schoolId directly onto the event doc, so no
 * join through buildings is needed. Events created without a schoolId are
 * skipped rather than broadcast to everyone - the mobile app's events feed
 * is school-scoped, so an unscoped push would reach students it's not for.
 *
 * Scraper imports add many events per run (createdBy: "scraper") - those are
 * skipped here and rolled up into one notification per school instead by
 * notifyEventImportBatch below, so a bulk import doesn't fire one push per event.
 */
// exports.notifyNewBuildingEventV2 = onDocumentCreated("building-events/{eventId}", async (event) => {
//   try {
//     const eventData = event.data.data();
//     const eventId = event.params.eventId;
//     const schoolId = eventData.schoolId;

//     if (eventData.createdBy === "scraper") {
//       logger.info("Skipping per-event notification for scraper import (batch notification handles this)", {
//         eventId: eventId,
//         eventName: eventData.eventName
//       });
//       return null;
//     }

//     if (!schoolId) {
//       logger.warn("Building event has no schoolId, skipping notification", {
//         eventId: eventId,
//         eventName: eventData.eventName,
//         buildingName: eventData.buildingName
//       });
//       return null;
//     }

//     logger.info("New building event created", {
//       eventId: eventId,
//       eventName: eventData.eventName,
//       buildingName: eventData.buildingName,
//       schoolId: schoolId,
//       date: eventData.date
//     });

//     const topic = schoolTopic(schoolId);

//     // Send notification to users subscribed to this school's topic
//     const message = {
//       topic: topic,
//       notification: {
//         title: `New Event: ${eventData.eventName}`,
//         body: `Check out the new event at ${eventData.buildingName}!`
//       },
//       data: {
//         eventId: eventId,
//         eventName: eventData.eventName || "",
//         buildingName: eventData.buildingName || "",
//         schoolId: schoolId,
//         date: eventData.date ? eventData.date.toString() : "",
//         type: "building_event"
//       },
//       android: {
//         notification: {
//           icon: "ic_notification",
//           color: "#4CAF50",
//           sound: "default"
//         },
//         priority: "high",
//         data: {
//           force_foreground: "true"
//         }
//       },
//       apns: {
//         payload: {
//           aps: {
//             badge: 1,
//             sound: "default"
//           }
//         }
//       }
//     };

//     const response = await getMessaging().send(message);
//     logger.info("Successfully sent building event notification to school topic", {
//       messageId: response,
//       eventName: eventData.eventName,
//       topic: topic
//     });

//     return response;

//   } catch (error) {
//     logger.error("Error sending building event notification", {
//       error: error.message,
//       eventId: event.params.eventId
//     });
//     throw error;
//   }
// });

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

    if (interests.length === 0 && !hasProfileText) {
      // Nothing left to recommend from (e.g. user cleared their bio/major
      // and had no tags) - clear a stale list instead of leaving it stuck.
      if (Array.isArray(after.recommendedEvents) && after.recommendedEvents.length > 0) {
        await event.data.after.ref.update({ recommendedEvents: [] });
      }
      return null;
    }

    logger.info("Profile changed, recomputing recommendations", { userId });

    const eventsSnap = await db.collection("building-events").get();
    const events = eventsSnap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((e) => Array.isArray(e.tags) && e.tags.length > 0);

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

    const recommended = events
      .map((e) => ({ id: e.id, score: scoreEvent(e, interests, profileEmbedding) }))
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((e) => e.id);

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
 * Notify all users when someone joins for the first time
 * Triggers when a user document is updated with notificationToken for the first time
 */
exports.sendUserJoinedNotification = onDocumentUpdated(
    'users/{userId}',
    async (event) => {
        try {
            const beforeData = event.data.before.data();
            const afterData = event.data.after.data();
            const userId = event.params.userId;
            const userEmail = afterData.email || '';
            
            // Skip notification for guest users with @ramroutes.com emails
            if (userEmail.endsWith('@ramroutes.com')) {
                logger.info("Skipping user joined notification for guest user", {
                    userId: userId,
                    email: userEmail
                });
                return null;
            }
            
            // Only trigger if notificationToken was added for the first time
            const hadToken = beforeData.notificationToken && beforeData.notificationToken.trim() !== '';
            const hasToken = afterData.notificationToken && afterData.notificationToken.trim() !== '';
            
            if (hadToken || !hasToken) {
                // User already had a token or still doesn't have one
                return null;
            }
            
            logger.info("New user joined the game. Pushing a notification", {
                userId: userId,
                userName: afterData.name,
                email: afterData.email
            });

            // Send notification to all users subscribed to 'updates' topic
            const message = {
                topic: 'updates',
                notification: {
                    title: 'New Player Joined!',
                    body: `${afterData.name || 'A new player'} has joined the game. Welcome them to the community!`
                },
                data: {
                    userId: userId,
                    userName: afterData.name || "",
                    type: "user_joined"
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
            logger.info("Successfully sent user joined notification to 'updates' topic", {
                messageId: response,
                userId: userId,
                userName: afterData.name
            });

            return response;
        } catch (error) {
            logger.error('Error sending user joined notification', {
                error: error.message,
                userId: event.params.userId
            });
            throw error;
        }
    }
);

/**
 * Notify all users when someone unlocks a building
 * Triggers when a document is created in the unlocked-trials collection
 */
exports.notifyBuildingUnlocked = onDocumentCreated("unlocked-trials/{unlockId}", async (event) => {
    try {
        const unlockData = event.data.data();
        const unlockId = event.params.unlockId;
        const userId = unlockData.userId; // Get the user who unlocked the building
        
        // Check if the user is a guest user (email ending with @ramroutes.com)
        if (userId) {
            const admin = require("firebase-admin");
            const db = admin.firestore();
            const userDoc = await db.collection("users").doc(userId).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                const userEmail = userData.email || '';
                
                if (userEmail.endsWith('@ramroutes.com')) {
                    logger.info("Skipping building unlocked notification for guest user", {
                        unlockId: unlockId,
                        userId: userId,
                        email: userEmail
                    });
                    return null;
                }
            }
        }
        
        logger.info("Building unlocked by user", {
            unlockId: unlockId,
            userName: unlockData.userName,
            buildingName: unlockData.buildingName,
            userId: userId
        });

        // Send notification to all users subscribed to 'updates' topic
        const message = {
            topic: 'updates',
            notification: {
                title: 'New Building Unlocked! 🏢',
                body: `${unlockData.userName || 'A player'} has unlocked ${unlockData.buildingName || 'a building'}! Check it out!`
            },
            data: {
                unlockId: unlockId,
                userName: unlockData.userName || "",
                buildingName: unlockData.buildingName || "",
                userId: unlockData.userId || "",
                type: "building_unlocked"
            },
            android: {
                notification: {
                    icon: "ic_notification",
                    color: "#FF9800", // Orange color for building unlocks
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
        logger.info("Successfully sent building unlocked notification to 'updates' topic", {
            messageId: response,
            unlockId: unlockId,
            buildingName: unlockData.buildingName,
            userId: unlockData.userId
        });

        return response;

    } catch (error) {
        logger.error('Error sending building unlocked notification', {
            error: error.message,
            unlockId: event.params.unlockId
        });
        throw error;
    }
});

/**
 * Notify all users when someone reaches a higher rank
 * Triggers when a user document is updated in the users collection
 * Monitors changes to knowledgePoints and coins to detect rank changes
 */
exports.notifyRankAchievement = onDocumentUpdated("users/{userId}", async (event) => {
    try {
        const beforeData = event.data.before.data();
        const afterData = event.data.after.data();
        const userId = event.params.userId;
        const userEmail = afterData.email || '';
        
        // Skip notification for guest users with @ramroutes.com emails
        if (userEmail.endsWith('@ramroutes.com')) {
            logger.info("Skipping rank achievement notification for guest user", {
                userId: userId,
                email: userEmail
            });
            return null;
        }
        
        // Get point values before and after the update
        const beforeCoins = beforeData.coins || 0;
        const beforeKnowledgePoints = beforeData.knowledgePoints || 0;
        const beforeTotalPoints = beforeCoins + beforeKnowledgePoints;
        
        const afterCoins = afterData.coins || 0;
        const afterKnowledgePoints = afterData.knowledgePoints || 0;
        const afterTotalPoints = afterCoins + afterKnowledgePoints;
        
        // Calculate ranks using the same logic as GetUserAvatarBasedOnPoints
        const calculateRank = (totalPoints) => {
            const weightedScore = (0.7 * totalPoints.knowledgePoints) + (0.3 * totalPoints.coins);
            
            if (weightedScore >= 3000) {
                return 3;
            } else if (weightedScore >= 1500) {
                return 2;
            } else {
                return 1;
            }
        };
        
        const beforeRank = calculateRank(beforeTotalPoints);
        const afterRank = calculateRank(afterTotalPoints);
        
        // Only send notification if rank increased
        if (afterRank > beforeRank) {
            const userName = afterData.name || 'A player';
            const rankNames = {
                0: 'Beginner',
                1: 'Gold',
                2: 'Silver',
                3: 'Platinum'
            };
            
            logger.info("User achieved higher rank", {
                userId: userId,
                userName: userName,
                beforeRank: beforeRank,
                afterRank: afterRank,
                beforeTotalPoints: beforeTotalPoints,
                afterTotalPoints: afterTotalPoints,
                rankName: rankNames[afterRank]
            });

            // Send notification to all users subscribed to 'updates' topic
            const message = {
                topic: 'updates',
                notification: {
                    title: `🏆 ${userName} Reached ${rankNames[afterRank]} Rank!`,
                    body: `🎉 Amazing achievement! ${userName} just leveled up to ${rankNames[afterRank]} rank with an impressive ${afterTotalPoints} points! Who's next? 🚀`
                },
                data: {
                    userId: userId,
                    userName: userName,
                    newRank: afterRank.toString(),
                    rankName: rankNames[afterRank],
                    totalPoints: afterTotalPoints.toString(),
                    coins: afterCoins.toString(),
                    knowledgePoints: afterKnowledgePoints.toString(),
                    type: "rank_achievement"
                },
                android: {
                    notification: {
                        icon: "ic_notification",
                        color: "#FFD700", // Gold color for rank achievements
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
            logger.info("Successfully sent rank achievement notification to 'updates' topic", {
                messageId: response,
                userId: userId,
                userName: userName,
                newRank: afterRank,
                rankName: rankNames[afterRank],
                totalPoints: afterTotalPoints
            });

            return response;
        } else {
            // No rank change, log for debugging but don't send notification
            logger.info("User points updated but no rank change", {
                userId: userId,
                userName: afterData.name,
                beforeRank: beforeRank,
                afterRank: afterRank,
                beforeTotalPoints: beforeTotalPoints,
                afterTotalPoints: afterTotalPoints
            });
            
            return null;
        }

    } catch (error) {
        logger.error('Error processing rank achievement notification', {
            error: error.message,
            userId: event.params.userId
        });
        throw error;
    }
});

/**
 * Notify users when they receive a shoutout
 * Triggers when a new document is created in the shout-outs collection
 */
exports.notifyShoutoutReceived = onDocumentCreated("shout-outs/{shoutoutId}", async (event) => {
    try {
        const shoutoutData = event.data.data();
        const shoutoutId = event.params.shoutoutId;
        const receiverUserId = shoutoutData.toId;
        const senderUserId = shoutoutData.fromId;
        
        if (!receiverUserId) {
            logger.error("No receiver user ID found in shoutout", { shoutoutId });
            return null;
        }
        
        const admin = require("firebase-admin");
        const db = admin.firestore();
        
        // Get receiver user data to check if it's a guest user
        const receiverDoc = await db.collection("users").doc(receiverUserId).get();
        if (!receiverDoc.exists) {
            logger.error("Receiver user not found", { receiverUserId, shoutoutId });
            return null;
        }
        
        const receiverData = receiverDoc.data();
        const receiverEmail = receiverData.email || '';
        
        // Skip notification for guest users with @ramroutes.com emails
        // if (receiverEmail.endsWith('@ramroutes.com')) {
        //     logger.info("Skipping shoutout notification for guest user", {
        //         shoutoutId: shoutoutId,
        //         receiverUserId: receiverUserId,
        //         email: receiverEmail
        //     });
        //     return null;
        // }
        
        // Get sender user data for the notification message
        let senderName = 'Someone';
        if (senderUserId) {
            const senderDoc = await db.collection("users").doc(senderUserId).get();
            if (senderDoc.exists) {
                const senderData = senderDoc.data();
                senderName = senderData.name || 'Someone';
            }
        }
        
        const kbAmount = shoutoutData.kbAmount || 10;
        const coinAmount = shoutoutData.coinAmount || 10;
        
        logger.info("Shoutout received, sending notification", {
            shoutoutId: shoutoutId,
            senderName: senderName,
            receiverUserId: receiverUserId,
            receiverToken: receiverData.notificationToken,
            kbAmount: kbAmount,
            coinAmount: coinAmount
        });
        
        // Send targeted notification to the receiver only
        const message = {
            token: null, // We'll need to get the FCM token for the specific user
            notification: {
                title: '🎉 You received a Shoutout!',
                body: `${senderName} sent you a shoutout! You gained ${coinAmount} coins and ${kbAmount} knowledge points!`
            },
            data: {
                shoutoutId: shoutoutId,
                senderName: senderName,
                senderUserId: senderUserId || "",
                receiverUserId: receiverUserId,
                kbAmount: kbAmount.toString(),
                coinAmount: coinAmount.toString(),
                type: "shoutout_received"
            },
            android: {
                notification: {
                    icon: "ic_notification",
                    color: "#E91E63", // Pink color for shoutouts
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
        
        // Try to get the user's FCM token from their user document
        const fcmToken = receiverData.notificationToken;
        if (fcmToken) {
            message.token = fcmToken;
            
            const response = await getMessaging().send(message);
            logger.info("Successfully sent shoutout notification to user", {
                messageId: response,
                shoutoutId: shoutoutId,
                receiverUserId: receiverUserId,
                senderName: senderName
            });
            
            return response;
        } 
        // else {
        //     // Fallback: send to updates topic (all users will see it but it's better than nothing)
        //     delete message.token;
        //     message.topic = 'updates';
        //     message.notification.body = `${senderName} sent a shoutout to ${receiverData.name || 'a player'}!`;
            
        //     const response = await getMessaging().send(message);
        //     logger.info("Sent shoutout notification to updates topic (no FCM token found)", {
        //         messageId: response,
        //         shoutoutId: shoutoutId,
        //         receiverUserId: receiverUserId,
        //         senderName: senderName
        //     });
            
        //     return response;
        // }
        
    } catch (error) {
        logger.error("Error sending shoutout notification", {
            error: error.message,
            shoutoutId: event.params.shoutoutId
        });
        throw error;
    }
});

/**
 * Notify user when they receive a friend request
 * Triggers when a document is created in the FriendRequests collection
 */
exports.notifyFriendRequestReceived = onDocumentCreated("friend-requests/{requestId}", async (event) => {
    try {
        const requestData = event.data.data();
        const requestId = event.params.requestId;
        const receiverUserId = requestData.toId;
        const senderUserId = requestData.fromId;
        
        if (!receiverUserId) {
            logger.error("No receiver user ID found in friend request", { requestId });
            return null;
        }
        
        const admin = require("firebase-admin");
        const db = admin.firestore();
        
        // Get receiver user data to check if it's a guest user
        const receiverDoc = await db.collection("users").doc(receiverUserId).get();
        if (!receiverDoc.exists) {
            logger.error("Receiver user not found", { receiverUserId, requestId });
            return null;
        }
        
        const receiverData = receiverDoc.data();
        const receiverEmail = receiverData.email || '';
        
        // Skip notification for guest users with @ramroutes.com emails
        // if (receiverEmail.endsWith('@ramroutes.com')) {
        //     logger.info("Skipping friend request notification for guest user", {
        //         requestId: requestId,
        //         receiverUserId: receiverUserId,
        //         email: receiverEmail
        //     });
        //     return null;
        // }
        
        // Get sender name from request data or fallback to user document
        let senderName = requestData.fromName || 'Someone';
        if (!requestData.fromName && senderUserId) {
            const senderDoc = await db.collection("users").doc(senderUserId).get();
            if (senderDoc.exists) {
                const senderData = senderDoc.data();
                senderName = senderData.name || 'Someone';
            }
        }
        
        logger.info("Friend request received, sending notification", {
            requestId: requestId,
            senderName: senderName,
            receiverUserId: receiverUserId,
                        receiverToken: receiverData.notificationToken,

        });
        
        // Send targeted notification to the receiver only
        const message = {
            token: null, // We'll need to get the FCM token for the specific user
            notification: {
                title: '👥 New Friend Request',
                body: `${senderName} wants to be your friend!`
            },
            data: {
                requestId: requestId,
                senderName: senderName,
                senderUserId: senderUserId || "",
                receiverUserId: receiverUserId,
                type: "friend_request_received"
            },
            android: {
                notification: {
                    icon: "ic_notification",
                    color: "#2196F3", // Blue color for friend requests
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
        
        // Try to get the user's FCM token from their user document
        const fcmToken = receiverData.notificationToken;
        if (fcmToken) {
            message.token = fcmToken;
            
            const response = await getMessaging().send(message);
            logger.info("Successfully sent friend request notification to user", {
                messageId: response,
                requestId: requestId,
                receiverUserId: receiverUserId,
                senderName: senderName
            });
            
            return response;
        } else {
            logger.info("No FCM token found for user, cannot send targeted notification", {
                requestId: requestId,
                receiverUserId: receiverUserId,
                senderName: senderName
            });
            
            return null;
        }
        
    } catch (error) {
        logger.error("Error sending friend request notification", {
            error: error.message,
            requestId: event.params.requestId
        });
        throw error;
    }
});

/**
 * Notify user when they receive a whisper
 * Triggers when a document is created in the chat collection
 */
exports.notifyWhisperReceived = onDocumentCreated("chat/{chatId}", async (event) => {
    try {
        const chatData = event.data.data();
        const chatId = event.params.chatId;
        const receiverUserId = chatData.toId;
        const senderUserId = chatData.fromId;
        const whisperType = chatData.chatEmojies;
        
        if (!receiverUserId) {
            logger.error("No receiver user ID found in whisper", { chatId });
            return null;
        }
        
        const admin = require("firebase-admin");
        const db = admin.firestore();
        
        // Get receiver user data
        const receiverDoc = await db.collection("users").doc(receiverUserId).get();
        if (!receiverDoc.exists) {
            logger.error("Receiver user not found", { receiverUserId, chatId });
            return null;
        }
        
        const receiverData = receiverDoc.data();
        const receiverEmail = receiverData.email || '';
        
        // Skip notification for guest users with @ramroutes.com emails
        // if (receiverEmail.endsWith('@ramroutes.com')) {
        //     logger.info("Skipping whisper notification for guest user", {
        //         chatId: chatId,
        //         receiverUserId: receiverUserId,
        //         email: receiverEmail
        //     });
        //     return null;
        // }
        
        // Get sender name for more personalized notification
        let senderName = 'Someone';
        if (senderUserId) {
            try {
                const senderDoc = await db.collection("users").doc(senderUserId).get();
                if (senderDoc.exists) {
                    const senderData = senderDoc.data();
                    senderName = senderData.name || 'Someone';
                    senderBuilding = senderData.currentBuilding || 'Unknown';
                }
            } catch (error) {
                logger.warn("Could not fetch sender data", { senderUserId, chatId });
            }
        }
        
        // Create dramatic whisper messages
        // const dramaticMessages = [
        //     "🌟 A mysterious whisper has found its way to you...",
        //     "✨ The winds carry a secret message just for you...",
        //     "🔮 Someone has sent you a whisper from the shadows...",
        //     "💫 A whisper echoes through the digital realm to reach you...",
        //     "🎭 The whispers of the campus have something to tell you...",
        //     "🌙 Under the moonlight, a whisper arrives at your doorstep...",
        //     "⚡ Lightning carries a whispered message to your ears...",
        //     "🍃 The whispers in the wind speak your name...",
        //     "🔥 A fiery whisper burns bright with a message for you...",
        //     "🌊 Waves of whispers crash upon your consciousness..."
        // ];
        
        // // Select a random dramatic message
        // const randomMessage = dramaticMessages[Math.floor(Math.random() * dramaticMessages.length)];
        
        logger.info("Whisper received, sending notification", {
            chatId: chatId,
            senderName: senderName,
            receiverUserId: receiverUserId,
            whisperType: whisperType,
            receiverToken: receiverData.notificationToken ? 'present' : 'missing'
        });
        
        // Send targeted notification to the receiver only
        const message = {
            token: null, // We'll set this below
            notification: {
                title: `🌟 ${senderName} Whispered to you`,
                body: `Sender: ${senderName}, Building: ${senderBuilding}`
            },
            data: {
                chatId: chatId,
                senderName: senderName,
                senderUserId: senderUserId || "",
                receiverUserId: receiverUserId,
                whisperType: whisperType || "",
                timestamp: chatData.timestamp ? chatData.timestamp.toString() : "",
                type: "whisper_received"
            },
            android: {
                notification: {
                    icon: "ic_notification",
                    color: "#9C27B0", // Purple color for whispers (mysterious)
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
        
        // Try to get the user's FCM token from their user document
        const fcmToken = receiverData.notificationToken;
        if (fcmToken && fcmToken.trim() !== '') {
            message.token = fcmToken;
            
            try {
                const response = await getMessaging().send(message);
                logger.info("Successfully sent whisper notification to user", {
                    messageId: response,
                    chatId: chatId,
                    receiverUserId: receiverUserId,
                    senderName: senderName,
                    whisperType: whisperType
                });
                
                return response;
            } catch (sendError) {
                logger.error("Failed to send whisper notification", {
                    error: sendError.message,
                    chatId: chatId,
                    receiverUserId: receiverUserId
                });
                
                return null;
            }
        } else {
            
            logger.info("No valid FCM token found for user, cannot send whisper notification", {
                chatId: chatId,
                receiverUserId: receiverUserId,
                senderName: senderName,
                whisperType: whisperType,
                tokenPresent: !!fcmToken
            });
            
            return null;
        }
        
    } catch (error) {
        logger.error("Error sending whisper notification", {
            error: error.message,
            stack: error.stack,
            chatId: event.params.chatId
        });
        
        // Don't re-throw the error to prevent function retry
        return null;
    }
});

/**
 * Notify all users when a new store item is added
 * Triggers when a document is created in the store-items collection
 */
exports.notifyNewStoreItem = onDocumentCreated("store-items/{itemId}", async (event) => {
    try {
        const itemData = event.data.data();
        const itemId = event.params.itemId;
        
        // Only notify if item is available for purchase
        if (!itemData.available) {
            logger.info("Store item not available, skipping notification", { itemId });
            return null;
        }
        
        const itemName = itemData.name || 'New Item';
        const category = itemData.category || 'general';
        
        logger.info("Sending new store item notification", {
            itemId: itemId,
            itemName: itemName,
            category: category
        });
        
        // Create the notification message
        const message = {
            topic: 'updates',
            notification: {
                title: 'New Store Item!',
                body: `${itemName} is now available in the store!`
            },
            data: {
                type: 'new_store_item',
                itemId: itemId,
                itemName: itemName,
                category: category
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
        
        // Send the notification
        const response = await getMessaging().send(message);
        logger.info("Successfully sent new store item notification", {
            messageId: response,
            itemId: itemId,
            itemName: itemName
        });
        
        return null;
        
    } catch (error) {
        logger.error("Error sending new store item notification", {
            error: error.message,
            stack: error.stack,
            itemId: event.params.itemId
        });
        
        // Don't re-throw the error to prevent function retry
        return null;
    }
});

/**
 * Schedule upcoming event notifications when events are created
 * More efficient than polling - schedules individual notifications
 */
exports.scheduleEventReminder = onDocumentCreated("building-events/{eventId}", async (event) => {
    try {
        const eventData = event.data.data();
        const eventId = event.params.eventId;
        
        // Skip if no date or event is in the past
        if (!eventData.date) return null;
        
        const eventTime = eventData.date.toDate();
        const now = new Date();
        const reminderTime = new Date(eventTime.getTime() - 15 * 60 * 1000); // 15 minutes before
        
        // Skip if reminder time has already passed
        if (reminderTime <= now) return null;
        
        // Store reminder in a collection for a daily cleanup job to process
        const admin = require("firebase-admin");
        const db = admin.firestore();
        
        await db.collection("event-reminders").doc(eventId).set({
            eventId: eventId,
            eventName: eventData.eventName,
            buildingName: eventData.buildingName,
            eventTime: eventTime,
            reminderTime: reminderTime,
            processed: false,
            createdAt: now
        });
        
        logger.info("Event reminder scheduled", {
            eventId: eventId,
            reminderTime: reminderTime.toISOString()
        });
        
        return null;
        
    } catch (error) {
        logger.error("Error scheduling event reminder:", {
            message: error.message,
            stack: error.stack,
            eventId: event.params.eventId
        });
        return null;
    }
});

/**
 * Process scheduled event reminders
 * Runs once per hour to send due notifications
 */
exports.processEventReminders = onSchedule("every 60 minutes", async (event) => {
    try {
        const admin = require("firebase-admin");
        const db = admin.firestore();
        const now = new Date();
        
        // Find unprocessed reminders that are due
        const remindersSnapshot = await db.collection("event-reminders")
            .where("processed", "==", false)
            .where("reminderTime", "<=", now)
            .limit(50)
            .get();
        
        if (remindersSnapshot.empty) return null;
        
        const batch = db.batch();
        
        for (const reminderDoc of remindersSnapshot.docs) {
            const reminder = reminderDoc.data();
            
            // Send notification
            const message = {
                topic: 'updates',
                notification: {
                    title: `Event Starting Soon!`,
                    body: `${reminder.eventName} at ${reminder.buildingName} starts in 15 minutes`
                },
                data: {
                    eventId: reminder.eventId,
                    eventName: reminder.eventName || "",
                    buildingName: reminder.buildingName || "",
                    type: "upcoming_event"
                },
                android: {
                    notification: {
                        icon: "ic_notification",
                        color: "#FF9800",
                        sound: "default"
                    },
                    priority: "high"
                }
            };
            
            await getMessaging().send(message);
            
            // Mark as processed
            batch.update(reminderDoc.ref, { processed: true, processedAt: now });
            
            logger.info("Event reminder sent", { eventId: reminder.eventId });
        }
        
        await batch.commit();
        return null;
        
    } catch (error) {
        logger.error("Error processing event reminders:", {
            message: error.message,
            stack: error.stack
        });
        return null;
    }
});

