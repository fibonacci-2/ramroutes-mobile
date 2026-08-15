import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { AVAILABLE_TAGS, Tag } from '../constants/tags';
import { orderedTags } from '../hooks/useInterests';

type Props = {
  selected: Set<Tag>;
  onToggle: (tag: Tag) => void;
};

export default function InterestsDropdown({ selected, onToggle }: Props) {
  const [visible, setVisible] = useState(false);

  const label = selected.size > 0 ? orderedTags(selected).join(', ') : 'Select interests';

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setVisible(true)}>
        <Text style={styles.triggerText} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setVisible(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Interests</Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={12}>
                <Text style={styles.closeButton}>Close</Text>
              </Pressable>
            </View>

            <FlatList
              data={AVAILABLE_TAGS}
              keyExtractor={(tag) => tag}
              renderItem={({ item: tag }) => (
                <Pressable style={styles.tagRow} onPress={() => onToggle(tag)}>
                  <Text style={styles.checkbox}>{selected.has(tag) ? '✓' : ''}</Text>
                  <Text style={styles.tagLabel}>{tag}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  triggerText: { flex: 1, fontSize: 14, color: '#333' },
  chevron: { color: '#666', marginLeft: 8 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { maxHeight: '70%', backgroundColor: 'white', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  closeButton: { color: '#007AFF', fontSize: 16 },
  tagRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  checkbox: { width: 24, fontSize: 16, color: '#007AFF', fontWeight: '600' },
  tagLabel: { fontSize: 16, color: '#333' },
});
