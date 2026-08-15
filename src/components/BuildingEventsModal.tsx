import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { subscribeToBuildingEvents } from '../services/buildingEvents';
import { Building } from '../types/Building';
import { BuildingEvent } from '../types/BuildingEvent';

type Props = {
  building: Building | null;
  onClose: () => void;
};

export default function BuildingEventsModal({ building, onClose }: Props) {
  const [events, setEvents] = useState<BuildingEvent[]>([]);

  useEffect(() => {
    if (!building) {
      setEvents([]);
      return;
    }
    return subscribeToBuildingEvents(building.buildingName, setEvents);
  }, [building]);

  return (
    <Modal visible={building !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{building?.buildingName}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.closeButton}>Close</Text>
            </Pressable>
          </View>

          <FlatList
            data={events}
            keyExtractor={(event) => event.id}
            ListEmptyComponent={<Text style={styles.emptyText}>No events at this building right now.</Text>}
            renderItem={({ item }) => (
              <View style={styles.eventRow}>
                <Text style={styles.eventName}>{item.eventName}</Text>
                {item.date ? <Text style={styles.eventDate}>{item.date}</Text> : null}
                {item.description ? <Text style={styles.eventDescription}>{item.description}</Text> : null}
              </View>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', flexShrink: 1 },
  closeButton: { color: '#007AFF', fontSize: 16 },
  emptyText: { color: '#666', paddingVertical: 24, textAlign: 'center' },
  eventRow: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  eventName: { fontSize: 16, fontWeight: '600' },
  eventDate: { fontSize: 13, color: '#666', marginTop: 2 },
  eventDescription: { fontSize: 14, color: '#333', marginTop: 4 },
});
