import { useEffect, useMemo, useState } from 'react';
import { subscribeToAllBuildingEvents } from '../services/buildingEvents';
import { subscribeToBuildings } from '../services/buildings';
import { Building, hasCoordinates } from '../types/Building';
import { BuildingEvent } from '../types/BuildingEvent';

export type EventWithLocation = BuildingEvent & { lat: number; lng: number };

// The design's mockup gives every event its own lat/lng directly; our schema
// only has coordinates on the building, so events inherit their building's
// location by buildingName. Events whose building has no coordinates yet
// (Phase 0 - only 8/29 buildings seeded) are dropped, same as MapScreen
// already does for building markers.
//
// schoolId scopes this to the signed-in student's campus - building-events
// docs have no schoolId of their own, so scoping happens for free through the
// join below: subscribeToBuildings(schoolId) only returns that school's
// buildings, so events whose buildingName isn't in that set never match.
export function useEvents(schoolId: string | null): EventWithLocation[] {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [events, setEvents] = useState<BuildingEvent[]>([]);

  useEffect(() => subscribeToBuildings(schoolId, setBuildings), [schoolId]);
  useEffect(() => subscribeToAllBuildingEvents(setEvents), []);

  return useMemo(() => {
    const buildingByName = new Map(buildings.filter(hasCoordinates).map((b) => [b.buildingName, b]));
    const located: EventWithLocation[] = [];
    for (const event of events) {
      const building = buildingByName.get(event.buildingName);
      if (building) {
        located.push({ ...event, lat: building.lat, lng: building.lng });
      }
    }
    return located;
  }, [buildings, events]);
}
