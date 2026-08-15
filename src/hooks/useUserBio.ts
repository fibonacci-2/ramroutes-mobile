import { useEffect, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import { getUserBio, updateUserBio } from '../services/users';

// Mirrors useInterests's load/save shape for the free-text "what are you
// looking for" preference field.
export function useUserBio() {
  const [bio, setBio] = useState('');
  const userId = getAuth().currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    getUserBio(userId).then(setBio);
  }, [userId]);

  const saveBio = (next: string) => {
    setBio(next);
    if (userId) {
      updateUserBio(userId, next);
    }
  };

  return { bio, setBio, saveBio };
}
