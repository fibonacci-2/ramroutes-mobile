import { Pressable, StyleSheet, Text, View } from 'react-native';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation, hasLatLng } from '../hooks/useEvents';
import { UserLocation } from '../hooks/useUserLocation';
import { color, font, radius, shadow } from '../theme';
import { distanceMiles } from '../utils/distance';
import Icon from './Icon';

export const RAIL_CARD_WIDTH = 280;

type Props = {
  event: EventWithLocation;
  userLocation: UserLocation | null;
  selected: boolean;
  onPress: () => void;
};

export default function EventRailCard({ event, userLocation, selected, onPress }: Props) {
  const style = primaryTagStyle(event.tags);
  const dist = userLocation && hasLatLng(event) ? `${distanceMiles(userLocation, event).toFixed(1)} mi` : null;

  return (
    <Pressable style={[styles.card, selected && styles.cardSelected]} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: style.tint }]}>
        <Icon name={style.icon} size={24} color={style.ink} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.eventName}
        </Text>
        <Text style={styles.meta} numberOfLines={2}>
          {[event.date, event.buildingName, dist].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: RAIL_CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.md,
  },
  cardSelected: { borderColor: color.accent },
  icon: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: font.bodyBold, fontSize: 15, color: color.text, marginBottom: 2 },
  meta: { fontFamily: font.bodySemibold, fontSize: 11.5, color: color.neutral600, lineHeight: 15 },
});
