import { getFirestore, collection, onSnapshot, QuerySnapshot, DocumentData } from '@react-native-firebase/firestore';
import { School } from '../types/School';

// Same "schools" collection the Admin web app (Admin/src/components/School*.js)
// manages - buildings get schoolId/schoolName copied onto them from here when
// created. Read-only from this app; schools are added/edited by admins.
export function subscribeToSchools(onChange: (schools: School[]) => void): () => void {
  const schoolsRef = collection(getFirestore(), 'schools');

  return onSnapshot(schoolsRef, (snapshot: QuerySnapshot<DocumentData>) => {
    const schools = snapshot.docs.map((doc) => ({
      id: doc.id,
      schoolName: (doc.data().schoolName as string) ?? doc.id,
    }));
    onChange(schools);
  });
}
