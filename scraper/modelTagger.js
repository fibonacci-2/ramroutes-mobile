const path = require("path");
const { tagEventsWithOpenRouter } = require("./openrouterTagger");

// Loads Admin/scraper/.env into process.env (Node's built-in loader - no
// dotenv dependency needed). Silently no-ops if the file doesn't exist, so
// deployments that inject TAGGER_URL/TAGGER_API_KEY as real env vars work too.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

/**
 * Tags a batch of events via the externally-hosted tagging model
 * (TAGGER_URL) - the original tagging path, now used as a fallback.
 *
 * @param {Array<{name: string, date: string, description: string}>} events
 * @returns {Promise<Array<{name: string, date: string, description: string, modelTags: string[]}>>}
 */
async function tagEventsViaApi(events) {
  const url = process.env.TAGGER_URL;
  console.log(`Using TAGGER_URL=${url} to tag ${events.length} events...`);
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

/**
 * Tags a batch of events by calling the OpenRouter model (openrouter/free),
 * falling back to the externally-hosted TAGGER_URL model if OpenRouter is
 * unconfigured or the call fails.
 *
 * @param {Array<{name: string, date: string, description: string}>} events
 * @returns {Promise<Array<{name: string, date: string, description: string, modelTags: string[]}>>}
 *   Same length and order as the input.
 */
async function tagEventsWithModel(events) {
  try {
      return await tagEventsViaApi(events);
    } catch (apiErr) {
      throw new Error(
        `Both OpenRouter and TAGGER_URL tagging failed. OpenRouter:  | API: ${apiErr.message}`
      );
    }
  // try {
  //   return await tagEventsWithOpenRouter(events);
  // } catch (openRouterErr) {
  //   console.warn(`OpenRouter tagging failed, falling back to TAGGER_URL: ${openRouterErr.message}`);
    
  // }
}

module.exports = { tagEventsWithModel, tagEventsViaApi };
