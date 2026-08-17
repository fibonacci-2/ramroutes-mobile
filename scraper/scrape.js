const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const EVENTS_URL =
  "https://gwu.campuslabs.com/engage/events?showpastevents=true";
const MAX_LOAD_MORE = 50;
const DESCRIPTION_CONCURRENCY = 20;

// Each scrape writes its own timestamped file instead of overwriting a fixed
// events.json, so a stale file never silently masquerades as fresh data.
function timestampedEventsPath() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(__dirname, `data/gwu/events-${ts}.json`);
}

async function fetchDescription(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    const description = await page.evaluate(() => {
      const el = document.querySelector(".DescriptionText");
      return el ? el.innerText.trim() : null;
    });
    return description;
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {});
  }
}

async function scrapeEvents({ onProgress, checkpointFile } = {}) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  onProgress?.("Navigating to GWU events page...");
  await page.goto(EVENTS_URL, { waitUntil: "networkidle", timeout: 60000 });

  let clicks = 0;
  while (clicks < MAX_LOAD_MORE) {
    const btn = page.locator('button:has-text("Load more")');
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) break;

    clicks++;
    onProgress?.(`Clicking "Load more" (${clicks})...`);
    await btn.click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState("networkidle").catch(() => {});
  }

  onProgress?.("Parsing event cards...");

  const events = await page.evaluate(() => {
    const cards = document.querySelectorAll('a[href^="/engage/event/"]');
    const results = [];

    cards.forEach((card) => {
      const nameEl = card.querySelector("h3");
      const name = nameEl ? nameEl.textContent.trim() : null;

      const dateEl = card.querySelector('[aria-label^="happening on"]');
      const dateRaw = dateEl ? dateEl.getAttribute("aria-label") : null;
      const date = dateRaw ? dateRaw.replace(/^happening on\s*/i, "") : null;

      const locationEl = card.querySelector('[aria-label^="located at"]');
      const locationRaw = locationEl
        ? locationEl.getAttribute("aria-label")
        : null;
      const location = locationRaw
        ? locationRaw.replace(/^located at\s*/i, "")
        : null;

      const imgDiv = card.querySelector('[role="img"]');
      let imageUrl = null;
      if (imgDiv) {
        const m = imgDiv.style.backgroundImage.match(/url\("?([^")\s]+)"?\)/);
        if (m) imageUrl = m[1];
      }

      const eventUrl =
        "https://gwu.campuslabs.com" + card.getAttribute("href");

      if (name) results.push({ name, date, location, imageUrl, eventUrl });
    });

    return results;
  });

  // Fetch descriptions in parallel batches
  onProgress?.(`Fetching descriptions for ${events.length} events...`);
  for (let i = 0; i < events.length; i += DESCRIPTION_CONCURRENCY) {
    const batch = events.slice(i, i + DESCRIPTION_CONCURRENCY);
    const descriptions = await Promise.all(
      batch.map((e) => fetchDescription(browser, e.eventUrl))
    );
    descriptions.forEach((desc, j) => {
      events[i + j].description = desc;
    });
    onProgress?.(
      `Descriptions: ${Math.min(i + DESCRIPTION_CONCURRENCY, events.length)}/${events.length}`
    );

    // Checkpoint after every batch so a crash/timeout partway through a long
    // scrape leaves real partial data on disk instead of losing the whole run.
    if (checkpointFile) {
      fs.writeFileSync(checkpointFile, JSON.stringify(events, null, 2));
    }
  }

  await browser.close().catch(() => {});
  return events;
}

// Standalone mode
if (require.main === module) {
  const outputFile = timestampedEventsPath();
  scrapeEvents({ onProgress: console.log, checkpointFile: outputFile })
    .then((events) => {
      // The last description batch's checkpoint already wrote the complete
      // final data to outputFile - this just confirms completion.
      console.log(`Scraped ${events.length} events → ${outputFile}`);
    })
    .catch((err) => {
      console.error(`Scraper failed (partial data, if any, is in ${outputFile}):`, err);
      process.exit(1);
    });
}

module.exports = { scrapeEvents, timestampedEventsPath };
