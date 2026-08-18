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

// Scoped to one school, not unfiltered - powers the map/list/saved/chat
// screens, which all show every building's events for the student's own
// campus at once rather than one building at a time. Every building-events
// doc already has schoolId stamped on it at write time (both
// Admin/src/components/BuildingEventForm.js and the scraper set it), so this
// is a plain equality filter, no join required - previously this read the
// *entire* collection across every school and relied on useEvents.ts's
// building-name join to silently drop everything that didn't match, which
// meant downloading (and paying to deserialize) every other school's events
// on every launch.
export function subscribeToAllBuildingEvents(schoolId: string, onChange: (events: BuildingEvent[]) => void): () => void {
  const eventsRef = query(collection(getFirestore(), 'building-events'), where('schoolId', '==', schoolId));
  return onSnapshot(eventsRef, (snapshot: QuerySnapshot<DocumentData>) => {
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
