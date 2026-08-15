import { getFirestore, collection, doc, query, where, onSnapshot, updateDoc, arrayUnion, arrayRemove, QuerySnapshot, DocumentData } from '@react-native-firebase/firestore';
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

// Unfiltered - powers the map/list/saved/chat screens, which all show events
// across every building at once rather than one building at a time.
export function subscribeToAllBuildingEvents(onChange: (events: BuildingEvent[]) => void): () => void {
  return onSnapshot(collection(getFirestore(), 'building-events'), (snapshot: QuerySnapshot<DocumentData>) => {
    const events = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<BuildingEvent, 'id'>),
    }));
    onChange(events);
  });
}

// Same semantics as BuildingEventService.cs's RecordInterestAsync/RemoveInterestAsync -
// the "Saved"/RSVP toggle from PLAN.md's Phase 1.
export async function setInterested(eventId: string, userId: string, interested: boolean): Promise<void> {
  await updateDoc(doc(getFirestore(), 'building-events', eventId), {
    interestedUsers: interested ? arrayUnion(userId) : arrayRemove(userId),
  });
}
