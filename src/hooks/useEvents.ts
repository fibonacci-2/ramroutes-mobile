import { useEffect, useMemo, useState } from 'react';
import { subscribeToAllBuildingEvents } from '../services/buildingEvents';
import { subscribeToBuildings } from '../services/buildings';
import { Building, hasCoordinates } from '../types/Building';
import { BuildingEvent } from '../types/BuildingEvent';

// lat/lng are optional, not guaranteed: our schema only has coordinates on
// the building (the design's mockup gives every event its own lat/lng
// directly), so an event only gets them when its buildingName matches a
// building that has coordinates seeded. Building coordinates were previously
// treated as required - events at an unmatched/uncoordinated building were
// dropped from the app entirely. That's backwards: the event is the real
// thing a student cares about, the map pin is just one way of presenting it.
// So every event now always appears in this list; only the map (MapScreen)
// additionally filters down to hasLatLng(event) since a pin literally can't
// be placed without a location.
export type EventWithLocation = BuildingEvent & { lat?: number; lng?: number };

export function hasLatLng(event: EventWithLocation): event is EventWithLocation & { lat: number; lng: number } {
  return typeof event.lat === 'number' && typeof event.lng === 'number';
}

// schoolId scopes both subscriptions directly (each doc has its own
// schoolId field) - the buildingName join below exists purely to attach
// lat/lng where possible, not to scope or filter by it.
export function useEvents(schoolId: string | null): EventWithLocation[] {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [events, setEvents] = useState<BuildingEvent[]>([]);

  useEffect(() => subscribeToBuildings(schoolId, setBuildings), [schoolId]);
  useEffect(() => {
    if (!schoolId) {
      setEvents([]);
      return;
    }
    return subscribeToAllBuildingEvents(schoolId, setEvents);
  }, [schoolId]);

  return useMemo(() => {
    const buildingByName = new Map(buildings.filter(hasCoordinates).map((b) => [b.buildingName, b]));
    return events.map((event) => {
      const building = buildingByName.get(event.buildingName);
      return building ? { ...event, lat: building.lat, lng: building.lng } : event;
    });
  }, [buildings, events]);
}
