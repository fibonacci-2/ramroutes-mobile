const path = require("path");

// Loads scraper/.env into process.env, same pattern as modelTagger.js.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

const MODEL = "qwen/qwen3-embedding-8b";

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
    body: JSON.stringify({ model: MODEL, input: texts }),
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
