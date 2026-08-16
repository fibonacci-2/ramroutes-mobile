import { StyleSheet, Text, View } from 'react-native';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation } from '../hooks/useEvents';
import { color, font, radius, shadow } from '../theme';
import Icon from './Icon';

type Props = {
  event: EventWithLocation;
  selected: boolean;
};

// Marker content for the map - a small card (icon + event name) instead of a
// bare icon pin, so what's actually happening is readable at a glance without
// tapping every marker.
export default function EventMapCard({ event, selected }: Props) {
  const style = primaryTagStyle(event.tags);

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <View style={[styles.icon, { backgroundColor: style.pinBg }]}>
        <Icon name={style.icon} size={12} color="white" strokeWidth={2.75} />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {event.eventName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 170,
    backgroundColor: 'white',
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 11,
    borderWidth: 1.5,
    borderColor: 'transparent',
    ...shadow.md,
  },
  cardSelected: { borderColor: color.accent },
  icon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1, fontFamily: font.bodyBold, fontSize: 11.5, color: color.text },
});
