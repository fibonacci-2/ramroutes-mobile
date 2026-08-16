const path = require("path");

// Loads Admin/scraper/.env into process.env (Node's built-in loader - no
// dotenv dependency needed). Silently no-ops if the file doesn't exist, so
// deployments that inject TAGGER_URL/TAGGER_API_KEY as real env vars work too.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

/**
 * Tags a batch of events by calling the remote tagging model.
 *
 * @param {Array<{name: string, date: string, description: string}>} events
 * @returns {Promise<Array<{name: string, date: string, description: string, modelTags: string[]}>>}
 *   Same length and order as the input.
 */
async function tagEventsWithModel(events) {
  const url = process.env.TAGGER_URL;
  if (!url) {
    throw new Error(
      "TAGGER_URL is not set. Copy Admin/scraper/.env.example to .env and fill it in."
    );
  }

  const response = await fetch(`${url}/tag`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.TAGGER_API_KEY,
    },
    body: JSON.stringify({ events }),
  });

  if (!response.ok) {
    throw new Error(
      `Tagging endpoint returned ${response.status}: ${await response.text()}`
    );
  }

  const data = await response.json();
  return data.events;
}

module.exports = { tagEventsWithModel };
