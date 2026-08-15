type LatLng = { lat: number; lng: number };

// Haversine, ported from design/Quad Campus Events.html's dist() helper.
export function distanceMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
