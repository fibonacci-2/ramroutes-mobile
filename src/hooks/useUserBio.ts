import { useEffect, useRef, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { getUserBio, updateUserBio } from '../services/users';

const SAVE_DELAY_MS = 600;

// Debounced + flush-on-unmount instead of blur-only: RootShell renders
// PreferencesScreen conditionally on the active tab ({tab === 'profile' &&
// ...}), so switching tabs *unmounts* it - a save that only fires on
// TextInput blur is silently dropped if the student switches tabs before
// blur ever fires. Saving shortly after each keystroke, and flushing
// immediately on unmount, means the edit persists either way.
export function useUserBio() {
  const [bio, setBioState] = useState('');
  const userId = getAuth().currentUser?.uid;
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;
    getUserBio(userId).then(setBioState);
  }, [userId]);

  // Flush a pending debounced edit immediately if the screen unmounts
  // before the timer fires.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (userId && pending.current !== null) {
        updateUserBio(userId, pending.current);
      }
    };
  }, [userId]);

  const setBio = (next: string) => {
    setBioState(next);
    pending.current = next;
    if (!userId) return;
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
      updateUserBio(userId, next);
    }
  };

  return { bio, setBio, saveBio };
}
