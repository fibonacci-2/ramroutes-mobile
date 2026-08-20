import { useEffect, useState } from 'react';
import { subscribeToUserRecommendedEvents } from '../services/users';

// RootShell unmounts EventsListScreen on every tab switch ({tab === 'list'
// && ...}), which tore down this subscription and restarted it from an
// empty array every time - the "For You" section visibly emptied out and
// repopulated on every visit to the Events tab, not just once at cold
// start. Cached module-level (not per-hook-instance) so every revisit
// after the first shows the last-known list immediately while the fresh
// subscription catches up in the background.
const recommendedCache = new Map<string, string[]>();

// Live subscription, not a one-shot load - functions/index.js's
// recomputeRecommendationsOnProfileChange updates recommendedEvents
// reactively within seconds of a bio/major/interests edit (not just once a
// night via scraper/recommend.js anymore), so a one-shot fetch on mount
// would keep showing a stale list until the app fully restarted.
export function useRecommendedEvents(userId: string | null): string[] {
  const [recommendedEventIds, setRecommendedEventIds] = useState<string[]>(() =>
    userId ? recommendedCache.get(userId) ?? [] : []
  );

  useEffect(() => {
    if (!userId) return;
    return subscribeToUserRecommendedEvents(userId, (ids) => {
      recommendedCache.set(userId, ids);
      setRecommendedEventIds(ids);
    });
  }, [userId]);

  return recommendedEventIds;
}
