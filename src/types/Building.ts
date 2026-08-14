export type Building = {
  id: string;
  buildingName: string;
  schoolId?: string;
  schoolName?: string;
  lat?: number;
  lng?: number;
  detectionRadiusMeters?: number;
};

export function hasCoordinates(building: Building): building is Building & { lat: number; lng: number } {
  return typeof building.lat === 'number' && typeof building.lng === 'number';
}
