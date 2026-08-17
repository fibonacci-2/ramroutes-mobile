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

export function rankByTagOverlap(
  events: EventWithLocation[],
  tags: ReadonlySet<Tag> | Tag[],
  limit?: number
): EventWithLocation[] {
  const ranked = events
    .map((e) => ({ e, score: tagOverlapScore(e, tags) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return (limit ? ranked.slice(0, limit) : ranked).map((x) => x.e);
}

// Reconciles the two places recommendations get scored: scraper/recommend.js
// runs nightly server-side with the fuller tagOverlap + λ·cosine(embedding)
// score (PLAN.md's "personalization v2") and writes user.recommendedEvents;
// this app never calls the embedding API itself (that would ship the
// OpenRouter key in the bundle). So: prefer the server's ranking when it's
// there, and fall back to local tag-only ranking for users the nightly batch
// hasn't scored yet (brand new signup, or interests changed today).
export function rankRecommended(
  events: EventWithLocation[],
  recommendedEventIds: string[],
  tags: ReadonlySet<Tag> | Tag[],
  limit?: number
): EventWithLocation[] {
  if (recommendedEventIds.length > 0) {
    const byId = new Map(events.map((e) => [e.id, e]));
    const ranked = recommendedEventIds
      .map((id) => byId.get(id))
      .filter((e): e is EventWithLocation => e !== undefined);
    return limit ? ranked.slice(0, limit) : ranked;
  }
  return rankByTagOverlap(events, tags, limit);
}
