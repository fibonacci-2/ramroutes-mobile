import { getFirestore, collection, onSnapshot, QuerySnapshot, DocumentData } from '@react-native-firebase/firestore';
import { Building } from '../types/Building';

// Same "buildings" collection the Unity app reads/writes - no separate backend.
export function subscribeToBuildings(onChange: (buildings: Building[]) => void): () => void {
  const buildingsRef = collection(getFirestore(), 'buildings');

  return onSnapshot(buildingsRef, (snapshot: QuerySnapshot<DocumentData>) => {
    const buildings = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Building, 'id'>),
    }));
    onChange(buildings);
  });
}
