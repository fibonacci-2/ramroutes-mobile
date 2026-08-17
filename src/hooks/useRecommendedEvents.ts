import { useEffect, useState } from 'react';
import { getUserRecommendedEvents } from '../services/users';

// One-shot load, not a live subscription - recommendedEvents only changes
// once a night (scraper/recommend.js), so there's no need to keep a
// Firestore listener open for it like useInterests does for interests.
export function useRecommendedEvents(userId: string | null): string[] {
  const [recommendedEventIds, setRecommendedEventIds] = useState<string[]>([]);

  useEffect(() => {
    if (!userId) return;
    getUserRecommendedEvents(userId).then(setRecommendedEventIds);
  }, [userId]);

  return recommendedEventIds;
}
