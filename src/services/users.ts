import { getFirestore, doc, getDoc, updateDoc } from '@react-native-firebase/firestore';

// Same "users" collection / "interests" field the Unity app reads/writes
// (UserService.cs's RetrieveUserById / UpdateUserInterests) - no separate backend.
export async function getUserInterests(userId: string): Promise<string[]> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const interests = snapshot.data()?.interests;
  return Array.isArray(interests) ? interests : [];
}

export async function updateUserInterests(userId: string, interests: string[]): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), { interests });
}
