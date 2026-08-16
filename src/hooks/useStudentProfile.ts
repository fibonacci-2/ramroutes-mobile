import { useEffect, useState } from 'react';
import { getAuth } from '@react-native-firebase/auth';
import {
  getUserClassYear,
  getUserMajor,
  updateUserClassYear,
  updateUserMajor,
} from '../services/users';

// Mirrors useUserBio's load/save shape for the explicit major + class year
// fields - declared alongside the inferred interest tags so recommendations
// have a direct signal ("political science major") from day one.
export function useStudentProfile() {
  const [major, setMajor] = useState('');
  const [classYear, setClassYearState] = useState<string | null>(null);
  const userId = getAuth().currentUser?.uid;

  useEffect(() => {
    if (!userId) return;
    getUserMajor(userId).then(setMajor);
    getUserClassYear(userId).then(setClassYearState);
  }, [userId]);

  const saveMajor = (next: string) => {
    setMajor(next);
    if (userId) {
      updateUserMajor(userId, next);
    }
  };

  const setClassYear = (next: string) => {
    setClassYearState(next);
    if (userId) {
      updateUserClassYear(userId, next);
    }
  };

  return { major, setMajor, saveMajor, classYear, setClassYear };
}
