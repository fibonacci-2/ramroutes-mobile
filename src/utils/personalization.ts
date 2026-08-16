import { Tag } from '../constants/tags';
import { EventWithLocation } from '../hooks/useEvents';

// score = number of tags in common - same overlap semantics as
// Admin/scraper/recommend.js's scoreEvent(). Shared between Scout's canned
// replies and the "For You" section so both rank events the same way.
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
