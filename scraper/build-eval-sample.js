// One-off dev utility: builds a stratified sample from the latest scrape for
// manual tagging, so the v2 tagger can be scored against real ground truth
// instead of eyeballing it against its own heuristic output.
//
// Usage: node build-eval-sample.js
const fs = require("fs");
const path = require("path");
const { tagEvent } = require("./tagger");

const SAMPLE_SIZE = 100;
const SEED = 42; // fixed seed so the sample is reproducible across runs

const MONTH_ORDER = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function latestEventsFile() {
  const files = fs
    .readdirSync(__dirname)
    .filter((f) => /^events-.*\.json$/.test(f))
    .sort(); // ISO timestamps in the filename sort chronologically as strings
  if (files.length === 0) throw new Error("No events-*.json files found");
  return path.join(__dirname, files[files.length - 1]);
}

function parseMonth(dateStr) {
  const m = /^\w+, (\w+) \d+ at/.exec((dateStr || "").trim());
  return m ? m[1] : null;
}

function main() {
  const inputFile = latestEventsFile();
  const raw = JSON.parse(fs.readFileSync(inputFile, "utf8"));
  console.log(`Loaded ${raw.length} rows from ${path.basename(inputFile)}`);

  // Dedupe by name + description
  const seen = new Set();
  const unique = [];
  for (const e of raw) {
    const key = `${(e.name || "").trim()}|||${(e.description || "").trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }
  console.log(`${unique.length} unique events after deduping by name+description`);

  // Group by month (no year is present in the source date strings)
  const byMonth = {};
  for (const e of unique) {
    const month = parseMonth(e.date) || "Unknown";
    (byMonth[month] = byMonth[month] || []).push(e);
  }

  const months = MONTH_ORDER.filter((m) => byMonth[m] && byMonth[m].length > 0);
  if (byMonth["Unknown"]) {
    console.warn(`${byMonth["Unknown"].length} events had an unparseable date and were excluded from sampling`);
  }

  const rng = mulberry32(SEED);

  // Target per month: proportional to that month's share of the deduped
  // pool, with a floor of 1 for every represented month so rare months
  // (May-Nov) aren't zeroed out by rounding. Iterate because the floor can
  // push a small month's target above its actual pool size, in which case
  // the shortfall is redistributed to months that still have spare pool.
  const poolSize = Object.fromEntries(months.map((m) => [m, byMonth[m].length]));
  const totalUnique = unique.length;
  let target = Object.fromEntries(
    months.map((m) => [m, Math.max(1, Math.round((poolSize[m] / totalUnique) * SAMPLE_SIZE))])
  );

  for (let guard = 0; guard < 50; guard++) {
    let over = 0;
    for (const m of months) {
      if (target[m] > poolSize[m]) {
        over += target[m] - poolSize[m];
        target[m] = poolSize[m];
      }
    }
    const totalTarget = months.reduce((sum, m) => sum + target[m], 0);
    let diff = SAMPLE_SIZE - totalTarget;
    if (diff === 0) break;

    // Distribute diff (positive: add slots, negative: remove slots) across
    // months that have room to grow/shrink, largest pool first.
    const candidates = months
      .filter((m) => (diff > 0 ? target[m] < poolSize[m] : target[m] > 1))
      .sort((a, b) => poolSize[b] - poolSize[a]);
    if (candidates.length === 0) break;

    for (let i = 0; i < candidates.length && diff !== 0; i++) {
      const m = candidates[i];
      target[m] += diff > 0 ? 1 : -1;
      diff += diff > 0 ? -1 : 1;
    }
  }

  const sample = [];
  for (const m of months) {
    const picked = shuffle(byMonth[m], rng).slice(0, target[m]);
    sample.push(...picked);
  }

  console.log(`Sample size: ${sample.length} (target was ${SAMPLE_SIZE})`);
  console.log("Per-month breakdown:");
  for (const m of months) {
    console.log(`  ${m.padEnd(10)} pool=${poolSize[m]}  sampled=${target[m]}`);
  }

  // Carry forward manualTags from the existing eval-sample.json for any event
  // that gets resampled again, keyed the same way as the dedupe step, so
  // regenerating the sample doesn't discard already-completed annotation work.
  const outputFile = path.join(__dirname, "eval-sample.json");
  const previousTags = new Map();
  if (fs.existsSync(outputFile)) {
    const previous = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    for (const e of previous) {
      if (e.manualTags && e.manualTags.length) {
        const key = `${(e.name || "").trim()}|||${(e.description || "").trim()}`;
        previousTags.set(key, e.manualTags);
      }
    }
    console.log(`Found ${previousTags.size} previously-annotated events to carry forward`);
  }

  const output = sample.map((e, i) => {
    const key = `${(e.name || "").trim()}|||${(e.description || "").trim()}`;
    return {
      id: i + 1,
      name: e.name,
      month: parseMonth(e.date),
      date: e.date,
      description: e.description,
      eventUrl: e.eventUrl,
      heuristicTags: tagEvent({ eventName: e.name, description: e.description }),
      manualTags: previousTags.get(key) || [],
    };
  });

  const carriedOver = output.filter((e) => e.manualTags.length).length;
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`Wrote ${output.length} events → ${outputFile} (${carriedOver} annotations carried forward)`);
}

main();
