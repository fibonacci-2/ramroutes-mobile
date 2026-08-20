import { useEffect, useRef, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { AVAILABLE_TAGS, Tag } from '../constants/tags';
import { getUserInterests, updateUserInterests } from '../services/users';

// Same delay as useUserBio/useStudentProfile: a student setting up their
// profile usually taps several tags in a row, and each write recomputes
// profileHash - without this, picking 4 tags fired functions/index.js's
// recompute trigger (and an OpenRouter call) 4 times instead of once.
const SAVE_DELAY_MS = 2000;

function isTag(value: string): value is Tag {
  return (AVAILABLE_TAGS as readonly string[]).includes(value);
}

// HashSet iteration order is unspecified, so any join over a Set of tags directly
// won't consistently match AVAILABLE_TAGS's order. Always project through
// AVAILABLE_TAGS's fixed order instead - mirrors UserInterestsDropdown.cs.
export function orderedTags(tags: Set<Tag>): Tag[] {
  return AVAILABLE_TAGS.filter((tag) => tags.has(tag));
}

// Each call site (PreferencesScreen and the events list) gets its own
// useState/fetch - React hooks don't share state across call sites, only
// the Firestore doc they read is shared. Both screens also unmount on tab
// switch, so without this cache both flashed an empty selection on every
// visit while refetching, same issue as useUserBio's bioCache. Module-level
// so PreferencesScreen writing a tag also warms EventsListScreen's copy.
const interestsCache = new Map<string, Set<Tag>>();

// Shared between PreferencesScreen (which writes the selection) and the
// building events list (which filters by it), so both stay in sync off one
// Firestore-backed source of truth instead of duplicating the load/save logic.
export function useInterests() {
  const userId = getAuth().currentUser?.uid;
  const [selected, setSelected] = useState<Set<Tag>>(() =>
    userId ? interestsCache.get(userId) ?? new Set() : new Set()
  );
  const pending = useRef<Tag[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    getUserInterests(userId).then((interests) => {
      const set = new Set(interests.filter(isTag));
      interestsCache.set(userId, set);
      setSelected(set);
    });
  }, [userId]);

  // Flush a pending debounced save immediately if the screen unmounts before
  // the timer fires (RootShell unmounts PreferencesScreen on tab switch) -
  // same reasoning as useUserBio/useStudentProfile.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (userId && pending.current !== null) {
        updateUserInterests(userId, pending.current);
      }
    };
  }, [userId]);

  const toggleTag = (tag: Tag) => {
    const next = new Set(selected);
    if (!next.delete(tag)) {
      next.add(tag);
    }
    setSelected(next);

    if (!userId) return;
    interestsCache.set(userId, next);
    const ordered = orderedTags(next);
    pending.current = ordered;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateUserInterests(userId, ordered);
      pending.current = null;
    }, SAVE_DELAY_MS);
  };

  return { selected, toggleTag };
}
