import { Pressable, StyleSheet, Text, View } from 'react-native';
import { primaryTagStyle } from '../constants/tagStyles';
import { color, font, radius, shadow } from '../theme';
import { EventWithLocation } from '../hooks/useEvents';
import { UserLocation } from '../hooks/useUserLocation';
import { distanceMiles } from '../utils/distance';
import Icon from './Icon';

type Props = {
  event: EventWithLocation;
  userLocation: UserLocation | null;
  saved: boolean;
  onPress: () => void;
  onToggleSave: () => void;
};

export default function EventRow({ event, userLocation, saved, onPress, onToggleSave }: Props) {
  const style = primaryTagStyle(event.tags);
  const dist = userLocation ? `${distanceMiles(userLocation, event).toFixed(1)} mi` : null;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: style.tint }]}>
        <Icon name={style.icon} size={21} color={style.ink} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {event.eventName}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {[event.date, event.buildingName, dist].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Pressable style={styles.bookmark} onPress={onToggleSave} hitSlop={10}>
        <Icon name="bookmark" size={18} color={saved ? color.accent : color.neutral500} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 20 },
  icon: { width: 46, height: 46, borderRadius: radius.md + 1, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: font.bodyBold, fontSize: 15, color: color.text },
  meta: { fontFamily: font.bodySemibold, fontSize: 11.5, color: color.neutral600, marginTop: 2 },
  bookmark: { padding: 8, borderRadius: radius.pill, ...shadow.sm },
});
