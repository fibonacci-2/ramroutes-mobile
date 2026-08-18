import { Tag } from '../constants/tags';
import { EventWithLocation } from '../hooks/useEvents';

// score = number of tags in common - same overlap semantics as
// scraper/recommend.js's scoreEvent() (its tagOverlap term). Shared between
// Scout's canned replies and rankRecommended's fallback below so all three
// rank by tags the same way.
export function tagOverlapScore(event: EventWithLocation, tags: ReadonlySet<Tag> | Tag[]): number {
  const tagSet = tags instanceof Set ? tags : new Set(tags);
  return (event.tags ?? []).filter((t) => tagSet.has(t as Tag)).length;
}

// Recurring events (e.g. a weekly "Tango Practica") get one Firestore doc per
// occurrence, all sharing the same eventName - they score identically on tag
// overlap, so without this a ranked list could be the same title repeated
// several times instead of N distinct events. Must run after sorting and
// before slicing to a limit, so it keeps each name's best-ranked occurrence
// and doesn't shrink the final count below the limit.
function dedupeByName<T>(items: T[], nameOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = nameOf(item).trim().toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(item);
  }
  return out;
}

export function rankByTagOverlap(
  events: EventWithLocation[],
  tags: ReadonlySet<Tag> | Tag[],
  limit?: number
): EventWithLocation[] {
  const ranked = dedupeByName(
    events
      .map((e) => ({ e, score: tagOverlapScore(e, tags) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score),
    (x) => x.e.eventName
  );
  return (limit ? ranked.slice(0, limit) : ranked).map((x) => x.e);
}

// Reconciles the two places recommendations get scored: scraper/recommend.js
// (nightly) and functions/index.js's recomputeRecommendationsOnProfileChange
// (reactive, on every profile edit) both run server-side with the fuller
// tagOverlap + λ·cosine(embedding) score (PLAN.md's "personalization v2")
// and write user.recommendedEvents; this app never calls the embedding API
// itself (that would ship the OpenRouter key in the bundle). So: prefer the
// server's ranking when it resolves to real events, and fall back to local
// tag-only ranking otherwise - not just when recommendedEventIds is empty,
// but also when it's non-empty but none of its ids match anything in the
// currently-loaded events (e.g. the two haven't caught up with each other
// yet). A student with real recommendedEvents on file should always see a
// "For you" section, never a silent empty one.
export function rankRecommended(
  events: EventWithLocation[],
  recommendedEventIds: string[],
  tags: ReadonlySet<Tag> | Tag[],
  limit?: number
): EventWithLocation[] {
  if (recommendedEventIds.length > 0) {
    const byId = new Map(events.map((e) => [e.id, e]));
    // dedupeByName here is a safety net for lists already written before
    // recommend.js/the Cloud Function started deduping server-side - once
    // those recompute, the server list itself won't contain repeats either.
    const ranked = dedupeByName(
      recommendedEventIds.map((id) => byId.get(id)).filter((e): e is EventWithLocation => e !== undefined),
      (e) => e.eventName
    );
    if (ranked.length > 0) {
      return limit ? ranked.slice(0, limit) : ranked;
    }
  }
  return rankByTagOverlap(events, tags, limit);
}
