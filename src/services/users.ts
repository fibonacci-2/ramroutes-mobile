import { Platform } from 'react-native';
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from '@react-native-firebase/firestore';

// Anonymous sign-in (useAuth.ts) gives every install a uid but no Firestore
// doc - creates the minimal users/{uid} profile this app actually reads/
// writes (bio, interests, schoolId). Unlike Unity's UserService.CreateUser,
// this skips the game-layer fields (coins, knowledgePoints, rank) - PLAN.md
// explicitly scopes those out ("no avatars/Rams, no game layer").
export async function ensureUserProfile(userId: string): Promise<void> {
  const ref = doc(getFirestore(), 'users', userId);
  const snapshot = await getDoc(ref);
  if (snapshot.exists()) {
    await updateDoc(ref, { lastLoginAt: serverTimestamp() });
    return;
  }
  await setDoc(ref, {
    bio: '',
    interests: [],
    major: '',
    classYear: null,
    schoolId: null,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });
}

export async function getUserSchoolId(userId: string): Promise<string | null> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const schoolId = snapshot.data()?.schoolId;
  return typeof schoolId === 'string' ? schoolId : null;
}

export async function setUserSchoolId(userId: string, schoolId: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), { schoolId });
}

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

// Same "bio" field the Unity app reads/writes (UserService.cs's UpdateUserBio) -
// reused here as the free-text "what are you looking for" preference field
// rather than introducing a separate undocumented field.
export async function getUserBio(userId: string): Promise<string> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const bio = snapshot.data()?.bio;
  return typeof bio === 'string' ? bio : '';
}

export async function updateUserBio(userId: string, bio: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), { bio });
}

// Explicit signal (declared major + class year) alongside the inferred one
// (tag interests, bio free text) - lets recommendations key off "I'm a
// political science major" even before the student has tagged/saved anything.
export async function getUserMajor(userId: string): Promise<string> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const major = snapshot.data()?.major;
  return typeof major === 'string' ? major : '';
}

export async function updateUserMajor(userId: string, major: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), { major });
}

export async function getUserClassYear(userId: string): Promise<string | null> {
  const snapshot = await getDoc(doc(getFirestore(), 'users', userId));
  const classYear = snapshot.data()?.classYear;
  return typeof classYear === 'string' ? classYear : null;
}

export async function updateUserClassYear(userId: string, classYear: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), { classYear });
}

// Same notificationToken/tokenLastUpdated/platform fields the Unity app's
// FirebaseManager.UpdateUserProfileToken writes to users/{uid}. Unity also
// mirrors the token to a devices/{deviceId} collection, but useAuth's stable
// per-install uid already serves as that device key here, so one write covers it.
export async function updateUserNotificationToken(userId: string, token: string): Promise<void> {
  await updateDoc(doc(getFirestore(), 'users', userId), {
    notificationToken: token,
    tokenLastUpdated: serverTimestamp(),
    platform: Platform.OS,
  });
}
