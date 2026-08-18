import { useEffect, useState } from 'react';
import { subscribeToUserRecommendedEvents } from '../services/users';

// Live subscription, not a one-shot load - functions/index.js's
// recomputeRecommendationsOnProfileChange updates recommendedEvents
// reactively within seconds of a bio/major/interests edit (not just once a
// night via scraper/recommend.js anymore), so a one-shot fetch on mount
// would keep showing a stale list until the app fully restarted.
export function useRecommendedEvents(userId: string | null): string[] {
  const [recommendedEventIds, setRecommendedEventIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    return subscribeToUserRecommendedEvents(userId, setRecommendedEventIds);
  }, [userId]);

  return recommendedEventIds;
}
