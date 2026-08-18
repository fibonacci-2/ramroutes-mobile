const express = require("express");
const path = require("path");
const fs = require("fs");
const { scrapeEvents, timestampedEventsPath } = require("./scrape");
const { matchAll } = require("./matcher");
const { TAGS } = require("./tagger");
const { tagEventsWithModel } = require("./modelTagger");
const { embedTexts } = require("./embedder");
const { computeRecommendations } = require("./recommend");

// Firebase Admin — requires Admin/serviceAccountKey.json
let db = null;
let FieldValue = null;
try {
  console.log("Initializing Firebase Admin...");
  const admin = require("firebase-admin");
  const serviceAccount = require("./serviceAccountKey.json");
  console.log("serviceAccountKey.json", serviceAccount ? "found" : "not found");
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  db = admin.firestore();
  FieldValue = admin.firestore.FieldValue;
  console.log("Firebase Admin initialized.");
} catch {
  console.warn(
    "Warning: serviceAccountKey.json not found — Firestore endpoints unavailable."
  );
}

// --- Utilities ---

function generateBuildingId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "BE";
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}


// Same shape as openrouter.py's event_text() - keeps the tagger and the
// embedder scoring the same textual representation of an event.
function eventEmbedText(event) {
  return `Name: ${event.name || ""}\nDate: ${event.date || ""}\nDescription: ${event.description || ""}`;
}

function reconcileEvent(event, building, tags, embedding) {
  return {
    // Firestore document fields
    buildingId: generateBuildingId(),
    buildingName: building.buildingName,
    schoolId: building.schoolId || "",
    schoolName: building.schoolName || "",
    eventName: event.name,
    eventType: "scheduled",
    date: event.date || null,
    description: event.description || "",
    tags,
    embedding: embedding || null,
    gainedCoins: 0,
    gainedKb: 0,
    imageUrl: event.imageUrl || null,
    eventUrl: event.eventUrl,
    attendees: [],
    interestedUsers: [],
    createdBy: "scraper",
    // Reconciliation metadata (not uploaded)
    _raw: {
      name: event.name,
      dateRaw: event.date,
      location: event.location,
      matchedKeyword: event.matchedKeyword,
    },
    _issues: [
      ...(!event.description ? ["no description"] : []),
      ...(!event.imageUrl ? ["no image"] : []),
    ],
  };
}

// --- Express setup ---

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Stream scrape progress via SSE
app.get("/api/scrape", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  const outputFile = timestampedEventsPath();
  try {
    const events = await scrapeEvents({
      onProgress: (msg) => send("progress", msg),
      checkpointFile: outputFile,
    });

    // The last description batch's checkpoint already wrote the complete
    // final data to outputFile - this just confirms it for the client.
    send("progress", `Saved ${events.length} events → ${path.basename(outputFile)}`);

    send("done", events);
  } catch (err) {
    send("error", `${err.message} (partial data, if any, saved to ${path.basename(outputFile)})`);
  } finally {
    res.end();
  }
});

// List schools from Firestore for the top-level "upload under" dropdown
app.get("/api/schools", async (req, res) => {
  console.log("Fetching schools...");
  if (!db) return res.status(503).json({ error: "Firebase not configured." });

  try {
    const snap = await db.collection("schools").get();
    const schools = snap.docs
      .map((doc) => {
        const data = doc.data();
        return { schoolId: data.schoolId || doc.id, schoolName: data.schoolName || "" };
      })
      .sort((a, b) => a.schoolName.localeCompare(b.schoolName));
    res.json({ schools });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Load buildings from Firestore and compute keyword matches
app.post("/api/match", async (req, res) => {
  const { events, schoolId } = req.body;
  if (!Array.isArray(events))
    return res.status(400).json({ error: "events must be an array" });
  if (!schoolId)
    return res.status(400).json({ error: "schoolId is required" });
  if (!db)
    return res.status(503).json({ error: "Firebase not configured." });

  try {
    delete require.cache[require.resolve("./keywords.json")];
    const snap = await db
      .collection("buildings")
      .where("schoolId", "==", schoolId)
      .get();
    const buildings = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const result = matchAll(events, buildings);

    const kw = require("./keywords.json");
    res.json({
      ...result,
      buildingCount: buildings.length,
      buildingDebug: buildings.map((b) => ({
        id: b.id,
        buildingName: b.buildingName,
        keywordCount: (
          kw[b.id] ||
          kw[b.buildingName] ||
          kw[(b.id || "").toLowerCase()] ||
          kw[(b.buildingName || "").toLowerCase()] ||
          []
        ).length,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Reconcile matched events and optionally upload to Firestore
// POST /api/upload  body: { buildings: [...matchAll result] }
// query: ?preview=true  → returns reconciled data without uploading
app.post("/api/upload", async (req, res) => {
  if (!db) return res.status(503).json({ error: "Firebase not configured." });

  const { buildings, schoolId, schoolName } = req.body;
  if (!Array.isArray(buildings))
    return res.status(400).json({ error: "buildings must be an array" });
  if (!schoolId)
    return res.status(400).json({ error: "schoolId is required" });

  const preview = req.query.preview === "true";

  try {
    // Fetch all existing eventUrls to detect duplicates
    const existingSnap = await db
      .collection("building-events")
      .where("eventUrl", "!=", null)
      .select("eventUrl")
      .get();
    const existingUrls = new Set(
      existingSnap.docs.map((d) => d.data().eventUrl).filter(Boolean)
    );

    // Flatten every event across all building groups, stamping the
    // dropdown-selected school onto each so it (not the possibly-unset
    // schoolId on the building doc) is what ends up on building-events and
    // event-import-batches.
    const flatEntries = [];
    for (const group of buildings) {
      const building = {
        buildingName: group.buildingName,
        schoolId,
        schoolName: schoolName || "",
      };
      for (const event of group.matched) {
        flatEntries.push({
          event,
          building,
          isDuplicate: existingUrls.has(event.eventUrl),
        });
      }
    }

    // Tag and embed only the non-duplicate events - duplicates are skipped
    // on upload below anyway, so there's no reason to spend model/embedding
    // calls on them. Duplicates must be computed first (above) so this
    // filter is accurate.
    const nonDuplicateEntries = flatEntries.filter((e) => !e.isDuplicate);
    const taggedEvents = nonDuplicateEntries.length
      ? await tagEventsWithModel(
          nonDuplicateEntries.map(({ event }) => ({
            name: event.name,
            date: event.date,
            description: event.description,
          }))
        )
      : [];
    // One batched embeddings call for the whole upload instead of one per
    // event - embedded once here and stored on the doc; recommend.js reads
    // it back rather than re-embedding events on every nightly run.
    const embeddings = nonDuplicateEntries.length
      ? await embedTexts(nonDuplicateEntries.map(({ event }) => eventEmbedText(event)))
      : [];

    let nonDuplicateIndex = 0;
    const reconciled = flatEntries.map(({ event, building, isDuplicate }) => {
      const tags = isDuplicate ? [] : taggedEvents[nonDuplicateIndex].modelTags;
      const embedding = isDuplicate ? null : embeddings[nonDuplicateIndex];
      if (!isDuplicate) nonDuplicateIndex++;
      const rec = reconcileEvent(event, building, tags, embedding);
      rec._duplicate = isDuplicate;
      return rec;
    });

    if (preview) {
      // Strip non-serialisable values and return for UI review
      return res.json({
        total: reconciled.length,
        ready: reconciled.filter((r) => r._issues.length === 0 && !r._duplicate).length,
        duplicates: reconciled.filter((r) => r._duplicate).length,
        withIssues: reconciled.filter((r) => r._issues.length > 0 && !r._duplicate).length,
        events: reconciled.map((r) => ({
          eventName: r.eventName,
          buildingName: r.buildingName,
          date: r.date,
          description: r.description ? r.description.slice(0, 80) : null,
          tags: r.tags,
          imageUrl: r.imageUrl,
          eventUrl: r.eventUrl,
          issues: r._issues,
          duplicate: r._duplicate,
        })),
      });
    }

    // Upload: skip duplicates, upload the rest
    let uploaded = 0;
    let skipped = 0;
    const errors = [];

    const bySchool = new Map(); // schoolId -> { schoolId, schoolName, count, eventIds }

    for (const rec of reconciled) {
      if (rec._duplicate) { skipped++; continue; }

      const doc = {
        buildingId: rec.buildingId,
        buildingName: rec.buildingName,
        schoolId: rec.schoolId,
        schoolName: rec.schoolName,
        eventName: rec.eventName,
        eventType: rec.eventType,
        date: rec.date || null,
        description: rec.description,
        tags: rec.tags,
        gainedCoins: rec.gainedCoins,
        gainedKb: rec.gainedKb,
        imageUrl: rec.imageUrl,
        eventUrl: rec.eventUrl,
        attendees: rec.attendees,
        interestedUsers: rec.interestedUsers,
        createdBy: rec.createdBy,
        createdAt: FieldValue.serverTimestamp(),
      };

      try {
        const docRef = await db.collection("building-events").add(doc);
        uploaded++;

        // Embeddings live in a separate collection, keyed by the same doc
        // id, instead of on the building-events doc itself - the mobile app
        // subscribes to building-events directly and never reads the
        // embedding, so keeping it there meant every launch downloaded and
        // parsed a multi-KB vector per event it was never going to use.
        if (rec.embedding) {
          await db.collection("event-embeddings").doc(docRef.id).set({ embedding: rec.embedding });
        }

        if (rec.schoolId) {
          const entry = bySchool.get(rec.schoolId) || {
            schoolId: rec.schoolId,
            schoolName: rec.schoolName || "",
            count: 0,
            eventIds: [],
          };
          entry.count++;
          entry.eventIds.push(docRef.id);
          bySchool.set(rec.schoolId, entry);
        }
      } catch (err) {
        errors.push({ event: rec.eventName, error: err.message });
      }
    }

    // Signal the batch instead of relying on per-event Firestore triggers,
    // so Cloud Functions can send one rollup notification per school rather
    // than one push per event (see notifyEventImportBatch in
    // Admin/new-functions/index.js, and notifyNewBuildingEventV2's
    // createdBy === "scraper" skip in the same file).
    if (uploaded > 0) {
      try {
        await db.collection("event-import-batches").add({
          createdAt: FieldValue.serverTimestamp(),
          totalUploaded: uploaded,
          totalSkipped: skipped,
          schools: Array.from(bySchool.values()),
        });
      } catch (err) {
        console.error("Failed to write event import batch signal:", err.message);
      }
    }

    res.json({ uploaded, skipped, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Run recommendation computation, stream progress via SSE
app.get("/api/recommend", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (type, payload) => {
    res.write(`data: ${JSON.stringify({ type, payload })}\n\n`);
  };

  try {
    const result = await computeRecommendations({
      onProgress: (msg) => send("progress", msg),
    });
    send("done", result);
  } catch (err) {
    send("error", err.message);
  } finally {
    res.end();
  }
});

// --- Manual tagging eval sample (used by annotate.html) ---

const EVAL_SAMPLE_FILE = path.join(__dirname, "eval-sample.json");

app.get("/api/eval-sample", (req, res) => {
  if (!fs.existsSync(EVAL_SAMPLE_FILE)) {
    return res.status(404).json({
      error: "eval-sample.json not found. Run: node build-eval-sample.js",
    });
  }
  const events = JSON.parse(fs.readFileSync(EVAL_SAMPLE_FILE, "utf8"));
  res.json({ tags: Object.keys(TAGS), events });
});

app.post("/api/eval-sample", (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events)) {
    return res.status(400).json({ error: "events must be an array" });
  }
  fs.writeFileSync(EVAL_SAMPLE_FILE, JSON.stringify(events, null, 2));
  res.json({ saved: events.length });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Scraper UI → http://localhost:${PORT}`));
