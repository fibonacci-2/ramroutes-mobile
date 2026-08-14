import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { subscribeToBuildings } from '../services/buildings';
import { Building, hasCoordinates } from '../types/Building';

// GWU campus, Foggy Bottom - matches the buildings seeded in Phase 0.
const INITIAL_REGION = {
  latitude: 38.899,
  longitude: -77.049,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapScreen() {
  const [buildings, setBuildings] = useState<Building[]>([]);

  useEffect(() => subscribeToBuildings(setBuildings), []);

  const mappedBuildings = buildings.filter(hasCoordinates);

  return (
    <View style={styles.container}>
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={INITIAL_REGION}
      >
        {mappedBuildings.map((building) => (
          <Marker
            key={building.id}
            coordinate={{ latitude: building.lat, longitude: building.lng }}
            title={building.buildingName}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
