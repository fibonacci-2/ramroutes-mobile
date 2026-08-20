import { useEffect, useRef, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import {
  getUserClassYear,
  getUserMajor,
  updateUserClassYear,
  updateUserMajor,
} from '../services/users';

// Same delay as useUserBio, for the same reason: long enough that a typing
// pause doesn't count as "done", since each save recomputes profileHash and
// fires functions/index.js's recompute trigger.
const SAVE_DELAY_MS = 2000;

// Same reasoning as useUserBio's bioCache: RootShell unmounts
// PreferencesScreen on every tab switch, which reset these fields to
// empty/null and refetched on every single visit - a real network round
// trip each time, flashing empty before repopulating. Cached so every visit
// after the first is instant; the fetch still runs to catch changes made
// elsewhere.
const majorCache = new Map<string, string>();
const classYearCache = new Map<string, string | null>();

// Mirrors useUserBio's load/save shape for the explicit major + class year
// fields - declared alongside the inferred interest tags so recommendations
// have a direct signal ("political science major") from day one.
//
// major is debounced + flushed on unmount for the same reason as bio -
// RootShell unmounts PreferencesScreen on tab switch, so a blur-only save
// can be dropped if the student switches tabs before blur fires. classYear
// doesn't need this: it saves immediately on tap, no blur/debounce involved,
// and (unlike bio/major/interests) isn't part of profileHash at all.
export function useStudentProfile() {
  const userId = getAuth().currentUser?.uid;
  const [major, setMajorState] = useState(() => (userId ? majorCache.get(userId) ?? '' : ''));
  const [classYear, setClassYearState] = useState<string | null>(() =>
    userId ? classYearCache.get(userId) ?? null : null
  );
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    getUserMajor(userId).then((value) => {
      majorCache.set(userId, value);
      setMajorState(value);
    });
    getUserClassYear(userId).then((value) => {
      classYearCache.set(userId, value);
      setClassYearState(value);
    });
  }, [userId]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (userId && pending.current !== null) {
        majorCache.set(userId, pending.current);
        updateUserMajor(userId, pending.current);
      }
    };
  }, [userId]);

  const setMajor = (next: string) => {
    setMajorState(next);
    pending.current = next;
    if (!userId) return;
    majorCache.set(userId, next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateUserMajor(userId, next);
      pending.current = null;
    }, SAVE_DELAY_MS);
  };

  const saveMajor = (next: string) => {
    setMajorState(next);
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    if (userId) {
      majorCache.set(userId, next);
      updateUserMajor(userId, next);
    }
  };

  const setClassYear = (next: string) => {
    setClassYearState(next);
    if (userId) {
      classYearCache.set(userId, next);
      updateUserClassYear(userId, next);
    }
  };

  return { major, setMajor, saveMajor, classYear, setClassYear };
}
