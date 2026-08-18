const MODEL = "qwen/qwen3-embedding-8b";
// Qwen3-Embedding-8B is Matryoshka-trained (MRL) and natively returns 4096
// dims; OpenRouter honors a `dimensions` truncation param (verified live -
// requesting 1024 actually returns a 1024-length vector, not a padded/ignored
// 4096 one). 1024 is a 4x cut to storage/memory/transfer - the thing that's
// been driving the client payload size and this function's own OOM - while
// keeping most of the retrieval quality MRL is designed to preserve at this
// cut. Must match scraper/embedder.js's DIMENSIONS exactly: cosineSimilarity
// requires both vectors to be the same length, and event embeddings (written
// by the scraper) get compared against profile embeddings (written here).
const DIMENSIONS = 1024;

// Mirrors scraper/embedder.js. Cloud Functions and the standalone scraper
// are separate deployable Node projects (own package.json, own deploy/run
// target), so this is duplicated rather than shared - keep both in sync if
// the embeddings API or model ever changes. Unlike scraper's Express server,
// no process.loadEnvFile() call is needed here: Cloud Functions (2nd gen)
// loads functions/.env into process.env automatically, for both the
// emulator and deployed runtime.

/**
 * Embeds a batch of strings with Qwen3-Embedding-8B via OpenRouter's
 * OpenAI-compatible /embeddings endpoint.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>} one vector per input, same order as texts.
 */
async function embedTexts(texts) {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to functions/.env.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, input: texts, dimensions: DIMENSIONS }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenRouter embeddings returned ${response.status}: ${await response.text()}`
    );
  }

  const { data } = await response.json();
  return data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

function cosineSimilarity(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

module.exports = { embedTexts, cosineSimilarity };
