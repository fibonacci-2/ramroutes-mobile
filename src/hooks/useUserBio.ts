import { useEffect, useRef, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { getUserBio, updateUserBio } from '../services/users';

// Long enough that a normal typing pause (thinking mid-sentence) doesn't
// count as "done editing" - each save also recomputes profileHash, which
// fires functions/index.js's recomputeRecommendationsOnProfileChange, so a
// short delay meant one bio edit could trigger that (and an OpenRouter call)
// several times over.
const SAVE_DELAY_MS = 2000;

// RootShell unmounts PreferencesScreen on every tab switch ({tab ===
// 'profile' && ...}), which reset bio back to '' and refetched from
// scratch on every single visit - a real network round trip each time, so
// the field visibly flashed empty then repopulated on every tab revisit,
// not just once at cold start. This module-level cache makes every visit
// after the first instant (read synchronously as the initial state below);
// the fetch below still runs to catch changes made elsewhere (e.g. another
// device), it just no longer has to be waited on to show *something*.
const bioCache = new Map<string, string>();

// Debounced + flush-on-unmount instead of blur-only: RootShell renders
// PreferencesScreen conditionally on the active tab ({tab === 'profile' &&
// ...}), so switching tabs *unmounts* it - a save that only fires on
// TextInput blur is silently dropped if the student switches tabs before
// blur ever fires. Saving shortly after each keystroke, and flushing
// immediately on unmount, means the edit persists either way.
export function useUserBio() {
  const userId = getAuth().currentUser?.uid;
  const [bio, setBioState] = useState(() => (userId ? bioCache.get(userId) ?? '' : ''));
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    getUserBio(userId).then((value) => {
      bioCache.set(userId, value);
      setBioState(value);
    });
  }, [userId]);

  // Flush a pending debounced edit immediately if the screen unmounts
  // before the timer fires.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (userId && pending.current !== null) {
        bioCache.set(userId, pending.current);
        updateUserBio(userId, pending.current);
      }
    };
  }, [userId]);

  const setBio = (next: string) => {
    setBioState(next);
    pending.current = next;
    if (!userId) return;
    bioCache.set(userId, next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateUserBio(userId, next);
      pending.current = null;
    }, SAVE_DELAY_MS);
  };

  const saveBio = (next: string) => {
    setBioState(next);
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    if (userId) {
      bioCache.set(userId, next);
      updateUserBio(userId, next);
    }
  };

  return { bio, setBio, saveBio };
}
