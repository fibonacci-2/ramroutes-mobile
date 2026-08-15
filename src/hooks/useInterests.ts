import { useEffect, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { AVAILABLE_TAGS, Tag } from '../constants/tags';
import { getUserInterests, updateUserInterests } from '../services/users';

function isTag(value: string): value is Tag {
  return (AVAILABLE_TAGS as readonly string[]).includes(value);
}

// HashSet iteration order is unspecified, so any join over a Set of tags directly
// won't consistently match AVAILABLE_TAGS's order. Always project through
// AVAILABLE_TAGS's fixed order instead - mirrors UserInterestsDropdown.cs.
export function orderedTags(tags: Set<Tag>): Tag[] {
  return AVAILABLE_TAGS.filter((tag) => tags.has(tag));
}

// Shared between PreferencesScreen (which writes the selection) and the
// building events list (which filters by it), so both stay in sync off one
// Firestore-backed source of truth instead of duplicating the load/save logic.
export function useInterests() {
  const [selected, setSelected] = useState<Set<Tag>>(new Set());
  const userId = getAuth().currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    getUserInterests(userId).then((interests) => {
      setSelected(new Set(interests.filter(isTag)));
    });
  }, [userId]);

  const toggleTag = (tag: Tag) => {
    const next = new Set(selected);
    if (!next.delete(tag)) {
      next.add(tag);
    }
    setSelected(next);

    if (userId) {
      updateUserInterests(userId, orderedTags(next));
    }
  };

  return { selected, toggleTag };
}
