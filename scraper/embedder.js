const path = require("path");

// Loads scraper/.env into process.env, same pattern as modelTagger.js.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

const MODEL = "qwen/qwen3-embedding-8b";
// Qwen3-Embedding-8B is Matryoshka-trained (MRL) and natively returns 4096
// dims; OpenRouter honors a `dimensions` truncation param (verified live -
// requesting 1024 actually returns a 1024-length vector, not a padded/ignored
// 4096 one). 1024 is a 4x cut to storage/memory/transfer on every event and
// profile embedding - the thing that's been driving the client payload size
// and the recomputeRecommendationsOnProfileChange OOM - while keeping most
// of the retrieval quality MRL is designed to preserve at this cut.
const DIMENSIONS = 1024;

/**
 * Embeds a batch of strings with Qwen3-Embedding-8B via OpenRouter's
 * OpenAI-compatible /embeddings endpoint. One request for the whole batch,
 * not one per string - keeps this cheap to call from a nightly job.
 *
 * @param {string[]} texts
 * @returns {Promise<number[][]>} one vector per input, same order as texts.
 */
async function embedTexts(texts) {
  if (texts.length === 0) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy scraper/.env.example to .env and fill it in."
    );
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

// Both vectors come from the same model/dimensionality (event and profile
// text are embedded with the same call), so no normalization step is needed.
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
