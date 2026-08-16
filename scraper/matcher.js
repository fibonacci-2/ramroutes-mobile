// Ground truth building IDs as they exist in Firestore
const GROUND_TRUTH_BUILDINGS = [
  "tompkins",
  "corcoran",
  "deques",
  "gelman",
  "lerner",
  "district-house",
  "himmelfrab",
  "funger",
  "seh",
  "usc",
  "kogan-plaza",
  "monroe-hall",
  "shenkman-hall",
  "thurston-hall",
  "munson-hall",
  "amsterdam-hall",
  "hand-chapel",
  "elliott-school",
  "potomac-house",
  "somers-hall",
  "milken-institute",
  "fsk-hall",
  "west-hall",
  "fulbright-hall",
  "strong-hall",
  "phillips-hall",
  "smith-center",
  "smpa",
];

// keywords.json maps Firestore document ID → keyword strings
// A scraped location matches a building if it contains ANY keyword (case-insensitive)
const keywordsMap = require("./keywords.json");

function matchAll(events, buildings) {
  const groups = {};
  buildings.forEach((b) => {
    groups[b.id] = {
      buildingId: b.id,
      buildingName: b.buildingName,
      schoolName: b.schoolName || "",
      matched: [],
    };
  });

  const unmatched = [];

  events.forEach((event) => {
    const loc = (event.location || "").toLowerCase();
    if (!loc) {
      unmatched.push(event);
      return;
    }

    let matchedBuilding = null;
    let matchedKeyword = null;

    for (const building of buildings) {
      // Try id, then buildingName, then lowercase of each
      const keywords =
        keywordsMap[building.id] ||
        keywordsMap[building.buildingName] ||
        keywordsMap[(building.id || "").toLowerCase()] ||
        keywordsMap[(building.buildingName || "").toLowerCase()] ||
        [];
      for (const kw of keywords) {
        if (loc.includes(kw.toLowerCase())) {
          matchedBuilding = building;
          matchedKeyword = kw;
          break;
        }
      }
      if (matchedBuilding) break;
    }

    if (matchedBuilding) {
      groups[matchedBuilding.id].matched.push({ ...event, matchedKeyword });
    } else {
      unmatched.push(event);
    }
  });

  return {
    buildings: Object.values(groups).filter((g) => g.matched.length > 0),
    unmatched,
  };
}

module.exports = { matchAll, GROUND_TRUTH_BUILDINGS };
