import { getFirestore, collection, query, where, onSnapshot, QuerySnapshot, DocumentData } from '@react-native-firebase/firestore';
import { BuildingEvent } from '../types/BuildingEvent';

// Same "building-events" collection the Unity app reads/writes - no separate backend.
export function subscribeToBuildingEvents(
  buildingName: string,
  onChange: (events: BuildingEvent[]) => void
): () => void {
  const eventsRef = query(collection(getFirestore(), 'building-events'), where('buildingName', '==', buildingName));

  return onSnapshot(eventsRef, (snapshot: QuerySnapshot<DocumentData>) => {
    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<BuildingEvent, 'id'>),
    }));
    onChange(events);
  });
}
