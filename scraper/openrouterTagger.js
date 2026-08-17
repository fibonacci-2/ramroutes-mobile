const path = require("path");
const { TAGS } = require("./tagger");

// Loads scraper/.env into process.env, same pattern as embedder.js/modelTagger.js.
try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

// A pinned model, not the "openrouter/free" router - that router picks a
// different underlying free model per request, so output format/reliability
// varies request to request (one call came back as a safety-classifier
// reply, "User Safety: safe", instead of the requested JSON array, because a
// different model got selected for it). gpt-oss-20b:free supports
// structured outputs and is the same model every call.
const MODEL = "openai/gpt-oss-20b:free";
const TAG_NAMES = Object.keys(TAGS);
const VOCAB = TAG_NAMES.map((tag) => `- ${tag}: e.g. ${TAGS[tag].slice(0, 6).join(", ")}`).join("\n");

// Events per request. With a pinned, structured-output-capable model the
// original failure mode (a random weaker model miscounting/misreading the
// batch) goes away, so batching is back - it's far fewer requests than one
// per event. Alignment itself is enforced structurally below (response_format's
// minItems/maxItems == batch size), not just asked for in the prompt.
const BATCH_SIZE = 20;
// The free shared pool rate-limits per-model across all OpenRouter users,
// not just this app, so even a modest concurrency can trip it (see
// MAX_RATE_LIMIT_RETRIES below for what happens when it does).
const CONCURRENCY = 3;
const MAX_RATE_LIMIT_RETRIES = 5;
const DEFAULT_RETRY_AFTER_SECONDS = 5;

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(events) {
  const numbered = events
    .map(
      (e, i) =>
        `${i + 1}. Name: ${e.name || ""}\n   Date: ${e.date || ""}\n   Description: ${(e.description || "").slice(0, 500)}`
    )
    .join("\n\n");

  return `You are tagging campus events with zero or more topic tags from this fixed vocabulary:
${VOCAB}

Only use tags from this exact list - never invent new ones. An event can have zero, one, or several tags.

Events:
${numbered}

Return exactly ${events.length} tag lists, one per event, in the same order.`;
}

// Enforces the reply shape structurally instead of just asking for it in the
// prompt: "results" must have exactly one tag-array per event (minItems ==
// maxItems == events.length), and each tag must be one of TAG_NAMES. A
// provider that honors strict JSON schema mode literally cannot return a
// miscounted or off-vocabulary response - the earlier positional-mismatch
// risk (an off-by-one silently shifting every later event) is closed at the
// schema level, not just validated after the fact.
function buildSchema(events) {
  return {
    type: "json_schema",
    json_schema: {
      name: "event_tags_batch",
      strict: true,
      schema: {
        type: "object",
        properties: {
          results: {
            type: "array",
            minItems: events.length,
            maxItems: events.length,
            items: {
              type: "array",
              items: { type: "string", enum: TAG_NAMES },
            },
          },
        },
        required: ["results"],
        additionalProperties: false,
      },
    },
  };
}

// Thrown only for a malformed model reply (bad/missing JSON, or a provider
// that ignored the schema) - distinct from request-level failures (network
// error, non-2xx, bad API key) so the caller can treat "this one batch's
// reply was garbage" as recoverable (leave that batch untagged) while still
// letting systemic failures propagate and fail the whole run.
class ParseError extends Error {}

// Reads how long OpenRouter says to wait before retrying a 429, from
// whichever of the Retry-After header or the error body's
// retry_after_seconds actually has it.
function retryAfterSeconds(response, bodyText) {
  const header = Number(response.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header;
  try {
    const parsed = JSON.parse(bodyText);
    const fromBody = parsed?.error?.metadata?.retry_after_seconds;
    if (Number.isFinite(fromBody) && fromBody > 0) return fromBody;
  } catch {}
  return DEFAULT_RETRY_AFTER_SECONDS;
}

// Tags a single batch (one OpenRouter request), retrying on 429s (the free
// shared pool's rate limit) using the wait time OpenRouter reports rather
// than failing the whole run over a transient, expected condition.
async function tagBatch(events, apiKey) {
  let response;
  for (let attempt = 0; ; attempt++) {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: buildPrompt(events) }],
        temperature: 0,
        response_format: buildSchema(events),
      }),
    });

    if (response.status !== 429) break;

    const bodyText = await response.text();
    if (attempt >= MAX_RATE_LIMIT_RETRIES) {
      throw new Error(`OpenRouter tagging rate-limited after ${MAX_RATE_LIMIT_RETRIES} retries: ${bodyText}`);
    }
    const wait = retryAfterSeconds(response, bodyText);
    console.warn(`OpenRouter tagging rate-limited, retrying in ${wait}s (attempt ${attempt + 1}/${MAX_RATE_LIMIT_RETRIES})...`);
    await sleep(wait * 1000 + 250);
  }

  if (!response.ok) {
    throw new Error(`OpenRouter tagging returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ParseError(`OpenRouter tagging response wasn't parseable JSON: ${content.slice(0, 200)}`);
  }

  const tagLists = parsed?.results;
  if (!Array.isArray(tagLists) || tagLists.length !== events.length) {
    throw new ParseError(
      `OpenRouter tagging returned ${Array.isArray(tagLists) ? tagLists.length : "a non-array"} result(s) for ${events.length} events (schema not honored)`
    );
  }

  return events.map((event, i) => ({
    ...event,
    modelTags: Array.isArray(tagLists[i]) ? tagLists[i].filter((t) => TAG_NAMES.includes(t)) : [],
  }));
}

/**
 * Tags events by prompting an OpenRouter-hosted model directly, batched
 * BATCH_SIZE events per request with a strict JSON schema enforcing exact
 * per-event alignment, using the same tag vocabulary as tagger.js's keyword
 * heuristic. Runs up to CONCURRENCY batches at once.
 *
 * @param {Array<{name: string, date: string, description: string}>} events
 * @returns {Promise<Array<{name: string, date: string, description: string, modelTags: string[]}>>}
 *   Same length and order as the input.
 */
async function tagEventsWithOpenRouter(events) {
  if (events.length === 0) return [];

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Copy scraper/.env.example to .env and fill it in."
    );
  }

  const batches = chunk(events, BATCH_SIZE);
  console.log(`Tagging ${events.length} events via OpenRouter in ${batches.length} batch(es) of up to ${BATCH_SIZE}...`);

  const results = new Array(batches.length);
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const i = next++;
      try {
        results[i] = await tagBatch(batches[i], apiKey);
      } catch (err) {
        if (!(err instanceof ParseError)) throw err;
        console.warn(`OpenRouter tagging: batch ${i} came back malformed, leaving it untagged: ${err.message}`);
        results[i] = batches[i].map((event) => ({ ...event, modelTags: [] }));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));

  return results.flat();
}

module.exports = { tagEventsWithOpenRouter, MODEL };
