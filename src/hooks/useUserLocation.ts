import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export type UserLocation = { lat: number; lng: number };

// Real device location, replacing the mockup's hardcoded HERE=[42.2770,-83.7382]
// (the Diag, Ann Arbor). null until permission is granted and a fix lands -
// callers should treat that as "distance unknown" rather than block on it.
export function useUserLocation(): UserLocation | null {
  const [location, setLocation] = useState<UserLocation | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const position = await Location.getCurrentPositionAsync({});
        if (!cancelled) {
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        }
      } catch {
        // No fix available (GPS off, emulator with no location set, etc.) -
        // callers already treat null as "distance unknown", so just leave it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return location;
}
