// Strips Google's default points-of-interest (businesses, restaurants, etc.) and
// transit icons so the map only shows the buildings/events we plot ourselves,
// and retints the base map toward the design system's warm cream/terracotta
// palette (design/ds/styles.css) instead of Google's default blue-and-gray -
// Google Maps has no equivalent to the mockup's Leaflet+OSM tiles, so this is
// the closest approximation available via Maps styling JSON. Roads, water, and
// parks stay visible for navigational context. Applies on both platforms
// since MapScreen always uses PROVIDER_GOOGLE.
export const mapStyle = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { elementType: 'geometry', stylers: [{ color: '#f5ead8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#645c50' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f9f4ed' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#ccdbb2' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5ead8' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#e1eecc' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#dcd3c4' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffe1d0' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#dcd3c4' }] },
];
