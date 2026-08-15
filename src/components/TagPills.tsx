import { StyleSheet, Text, View } from 'react-native';
import { TAG_STYLES } from '../constants/tagStyles';
import { Tag } from '../constants/tags';
import { color, font, radius } from '../theme';

type Props = {
  tags: string[];
};

export default function TagPills({ tags }: Props) {
  if (tags.length === 0) return null;

  return (
    <View style={styles.row}>
      {tags.map((tag) => {
        const style = tag in TAG_STYLES ? TAG_STYLES[tag as Tag] : null;
        return (
          <View key={tag} style={[styles.pill, { backgroundColor: style?.tint ?? color.neutral200 }]}>
            <Text style={[styles.pillText, { color: style?.ink ?? color.neutral800 }]}>{tag}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  pill: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  pillText: { fontFamily: font.bodyBold, fontSize: 11 },
});
