const path = require("path");

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch {}

// Pinned, not the "openrouter/free" auto-router - same lesson
// scraper/openrouterTagger.js already learned: the router picks a different
// underlying free model per request, which breaks structured-output
// consistency. Same model as the tagger for now, since it's free and
// already proven to honor strict JSON schema mode reliably.
const MODEL = "openai/gpt-oss-20b:free";
const MAX_RATE_LIMIT_RETRIES = 5;
const DEFAULT_RETRY_AFTER_SECONDS = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildPrompt(message, history, events) {
  const eventList = events
    .map(
      (e) =>
        `- id: ${e.id}\n  name: ${e.eventName}\n  date: ${e.date || "unspecified"}\n  location: ${e.buildingName || "unspecified"}\n  tags: ${(e.tags || []).join(", ") || "none"}\n  description: ${(e.description || "").slice(0, 300)}`
    )
    .join("\n\n");

  const historyText = history.length
    ? history.map((m) => `${m.role === "me" ? "Student" : "Scout"}: ${m.text}`).join("\n") + "\n"
    : "";

  return `You are Scout, a friendly campus events assistant inside a student events app. Answer the student's question conversationally, in 1-3 short sentences.

You may ONLY reference events from this list - never invent events, names, dates, or locations that aren't in it:
${eventList || "(no events currently available)"}

${historyText}Student: ${message}

Reply with a short conversational answer plus the ids (if any) of events from the list above that are actually relevant to your answer. If nothing in the list fits what the student asked, say so honestly instead of forcing a match - leave eventIds empty.

Never include URLs, links, or website addresses in your reply. The event list above has no website field, so any link you write would be made up.`;
}

// enum: eventIds makes it structurally impossible for the model to
// reference an event outside the candidate list - not just asked for in the
// prompt, same "enforce it in the schema" approach as openrouterTagger.js's
// buildSchema. An empty enum is invalid JSON Schema for some validators, so
// fall back to a plain string type when there are no candidates at all.
function buildSchema(eventIds) {
  return {
    type: "json_schema",
    json_schema: {
      name: "scout_reply",
      strict: true,
      schema: {
        type: "object",
        properties: {
          text: { type: "string" },
          eventIds: {
            type: "array",
            items: eventIds.length ? { type: "string", enum: eventIds } : { type: "string" },
            maxItems: 5,
          },
        },
        required: ["text", "eventIds"],
        additionalProperties: false,
      },
    },
  };
}

function stripUrls(text) {
  return text
    .replace(/\(?\bhttps?:\/\/\S+\)?/gi, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,!?])/g, "$1")
    .trim();
}

class ParseError extends Error {}

/**
 * Gets Scout's reply to one message, grounded only in the given candidate
 * events.
 *
 * @param {string} message
 * @param {{role: 'me'|'ai', text: string}[]} history
 * @param {Array<{id: string, eventName: string, date?: string, buildingName?: string, tags?: string[], description?: string}>} events
 * @returns {Promise<{text: string, eventIds: string[]}>}
 */
async function getScoutReply(message, history, events) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to functions/.env.");
  }

  const eventIds = events.map((e) => e.id);
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
        messages: [{ role: "user", content: buildPrompt(message, history, events) }],
        temperature: 0.5,
        response_format: buildSchema(eventIds),
      }),
    });

    if (response.status !== 429) break;

    const bodyText = await response.text();
    if (attempt >= MAX_RATE_LIMIT_RETRIES) {
      throw new Error(`OpenRouter Scout call rate-limited after ${MAX_RATE_LIMIT_RETRIES} retries: ${bodyText}`);
    }
    const wait = retryAfterSeconds(response, bodyText);
    await sleep(wait * 1000 + 250);
  }

  if (!response.ok) {
    throw new Error(`OpenRouter Scout call returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ParseError(`Scout reply wasn't parseable JSON: ${content.slice(0, 200)}`);
  }

  if (typeof parsed.text !== "string") {
    throw new ParseError("Scout reply missing text field");
  }

  return {
    // Belt-and-suspenders: the prompt tells the model not to include links
    // (candidate events have no url field, so any link is hallucinated),
    // but small free models don't reliably follow that - strip stray
    // http(s) links here too.
    text: stripUrls(parsed.text),
    eventIds: Array.isArray(parsed.eventIds) ? parsed.eventIds.filter((id) => eventIds.includes(id)) : [],
  };
}

module.exports = { getScoutReply, ParseError, MODEL };
