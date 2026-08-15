import { getFirestore, collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from '@react-native-firebase/firestore';
import { Building } from '../types/Building';

// Same "buildings" collection the Unity app reads/writes - no separate backend.
// schoolId scopes results to the signed-in student's campus (Admin/src/components/
// BuildingForm.js copies schoolId onto each building at creation) - pass null
// to leave unfiltered.
export function subscribeToBuildings(schoolId: string | null, onChange: (buildings: Building[]) => void): () => void {
  const buildingsRef = schoolId
    ? query(collection(getFirestore(), 'buildings'), where('schoolId', '==', schoolId))
    : collection(getFirestore(), 'buildings');

  return onSnapshot(buildingsRef, (snapshot: QuerySnapshot<DocumentData>) => {
    const buildings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Building, 'id'>),
    }));
    onChange(buildings);
  });
}
