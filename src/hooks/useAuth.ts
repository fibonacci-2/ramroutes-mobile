import { useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, signInAnonymously } from '@react-native-firebase/auth';

// Anonymous auth, not the Unity app's GuestLoginManager.cs (which still makes
// students pick a username+password behind a fake email) - "accessible to
// everyone, no restricted access" means no signup UI at all. Every install
// gets a stable uid the moment the app opens, which is what the Firestore
// writes (interests, bio, RSVPs) and FCM notifications need on the backend.
export function useAuth() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        signInAnonymously(auth).catch(setError);
      }
    });
    return unsubscribe;
  }, []);

  return { userId, error };
}
