import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { AVAILABLE_TAGS, Tag } from '../constants/tags';
import { TAG_STYLES } from '../constants/tagStyles';
import { color, font, radius, shadow } from '../theme';
import Icon from './Icon';

type Category = Tag | 'all';

type Props = {
  selected: Category;
  onSelect: (category: Category) => void;
};

export default function CategoryChips({ selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Chip label="All" active={selected === 'all'} onPress={() => onSelect('all')} />
      {AVAILABLE_TAGS.map((tag) => (
        <Chip
          key={tag}
          label={tag}
          icon={TAG_STYLES[tag].icon}
          active={selected === tag}
          onPress={() => onSelect(tag)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({ label, icon, active, onPress }: { label: string; icon?: Parameters<typeof Icon>[0]['name']; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {icon ? <Icon name={icon} size={13} color={active ? color.bg : color.text} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingBottom: 2, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: color.divider,
    backgroundColor: 'white',
    ...shadow.sm,
  },
  chipActive: { backgroundColor: color.text, borderColor: color.text },
  chipText: { fontFamily: font.bodyBold, fontSize: 12.5, color: color.text },
  chipTextActive: { color: color.bg },
});
