// Phase 0 of the RamRoutes mobile migration: copies the real building GPS
// coordinates that already exist in Unity (BuildingProximityDetector's
// Inspector-authored data in Assets/Scenes/DCRPG.unity) onto the matching
// Firestore "buildings" docs, so both the Unity app and the new React Native
// app read coordinates from the same source instead of duplicating them.
//
// Run once: node migrate-building-coords.js
// Safe to re-run - it just overwrites the same fields with the same values.

const admin = require("firebase-admin");
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Extracted from DCRPG.unity's BuildingProximityDetector.buildings array.
// entranceGPS.x = latitude, entranceGPS.y = longitude (Unity Vector2 naming).
// "duques" here is spelled "deques" in the Firestore buildingName field -
// mapped explicitly below rather than assuming an exact string match.
const BUILDING_COORDS = [
  { buildingName: "seh", lat: 38.899933, lng: -77.049255, detectionRadiusMeters: 20, closeProximityRadiusMeters: 50 },
  { buildingName: "gelman", lat: 38.899223, lng: -77.04834, detectionRadiusMeters: 20, closeProximityRadiusMeters: 15 },
  { buildingName: "lerner", lat: 38.898598, lng: -77.050545, detectionRadiusMeters: 20, closeProximityRadiusMeters: 20 },
  { buildingName: "tompkins", lat: 38.899048, lng: -77.049866, detectionRadiusMeters: 20, closeProximityRadiusMeters: 20 },
  { buildingName: "funger", lat: 38.8986, lng: -77.04951, detectionRadiusMeters: 20, closeProximityRadiusMeters: 20 },
  { buildingName: "deques", lat: 38.89897, lng: -77.0492, detectionRadiusMeters: 20, closeProximityRadiusMeters: 20 },
  { buildingName: "corcoran", lat: 38.89914, lng: -77.046394, detectionRadiusMeters: 20, closeProximityRadiusMeters: 20 },
  { buildingName: "district-house", lat: 38.900097, lng: -77.047745, detectionRadiusMeters: 20, closeProximityRadiusMeters: 20 },
];

async function migrate() {
  const snap = await db.collection("buildings").get();
  const docsByName = new Map(snap.docs.map((doc) => [doc.data().buildingName, doc]));

  let updated = 0;
  const unmatched = [];

  for (const coord of BUILDING_COORDS) {
    const doc = docsByName.get(coord.buildingName);
    if (!doc) {
      unmatched.push(coord.buildingName);
      continue;
    }

    await doc.ref.update({
      lat: coord.lat,
      lng: coord.lng,
      detectionRadiusMeters: coord.detectionRadiusMeters,
      closeProximityRadiusMeters: coord.closeProximityRadiusMeters,
    });
    updated++;
  }

  console.log(`Updated ${updated}/${BUILDING_COORDS.length} building docs with GPS coordinates.`);
  if (unmatched.length > 0) {
    console.warn(`No matching Firestore doc for: ${unmatched.join(", ")}`);
  }

  const withoutCoords = snap.docs
    .map((doc) => doc.data().buildingName)
    .filter((name) => !BUILDING_COORDS.some((c) => c.buildingName === name));
  if (withoutCoords.length > 0) {
    console.log(`Buildings still without GPS coords (not in Unity's proximity list): ${withoutCoords.join(", ")}`);
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
