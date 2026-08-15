import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../components/Icon';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation } from '../hooks/useEvents';
import { scoutReply } from '../services/scout';
import { color, font, radius, shadow } from '../theme';
import { byId } from '../utils/byId';

type Message = { id: string; role: 'ai' | 'me'; text: string; eventIds?: string[]; typing?: boolean };

const QUICK_PROMPTS = ['What’s happening around campus?', 'Anything career related?', 'Something fun', 'Where can I volunteer?'];

// Module-level counter resets to 0 on every Fast Refresh reload without
// remounting the component, which collided with already-rendered message
// keys mid-session - stamp with time too so a reload can't reintroduce an id.
let nextId = 0;
const newId = () => `${Date.now()}-${nextId++}`;

type Props = {
  events: EventWithLocation[];
  userId: string;
  seedMessage: string | null;
  onSeedConsumed: () => void;
  onOpenDetail: (eventId: string) => void;
};

export default function ScoutScreen({ events, userId, seedMessage, onSeedConsumed, onOpenDetail }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    aiSay('Hey! I’m Scout — I know what’s happening around campus. Ask me for recommendations, or tap a suggestion below.');
  }, []);

  useEffect(() => {
    if (seedMessage) {
      sendMessage(seedMessage);
      onSeedConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedMessage]);

  const scrollToEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

  const aiSay = (text: string, eventIds: string[] = []) => {
    const typingId = newId();
    setMessages((prev) => [...prev, { id: typingId, role: 'ai', text: '', typing: true }]);
    scrollToEnd();
    setTimeout(() => {
      setMessages((prev) => prev.map((m) => (m.id === typingId ? { id: typingId, role: 'ai', text, eventIds } : m)));
      scrollToEnd();
    }, 600 + Math.random() * 400);
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { id: newId(), role: 'me', text }]);
    setInput('');
    scrollToEnd();
    setTimeout(() => {
      const savedIds = events.filter((e) => e.interestedUsers?.includes(userId)).map((e) => e.id);
      const reply = scoutReply(text, events, savedIds);
      aiSay(reply.text, reply.eventIds);
    }, 200);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Icon name="spark" size={20} color={color.accent2_800} />
        </View>
        <View>
          <Text style={styles.headerTitle}>Scout</Text>
          <Text style={styles.headerSub}>Your event assistant</Text>
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        renderItem={({ item }) => <MessageBubble message={item} events={events} onOpenDetail={onOpenDetail} />}
      />

      <FlatList
        horizontal
        data={QUICK_PROMPTS}
        keyExtractor={(q) => q}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickRow}
        renderItem={({ item }) => (
          <Pressable style={styles.quickChip} onPress={() => sendMessage(item)}>
            <Text style={styles.quickChipText}>{item}</Text>
          </Pressable>
        )}
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Ask for a recommendation…"
          placeholderTextColor={color.neutral500}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage(input)}
        />
        <Pressable style={styles.sendBtn} onPress={() => sendMessage(input)}>
          <Icon name="send" size={18} color="white" />
        </Pressable>
      </View>
    </View>
  );
}

function MessageBubble({ message, events, onOpenDetail }: { message: Message; events: EventWithLocation[]; onOpenDetail: (id: string) => void }) {
  if (message.typing) {
    return (
      <View style={[styles.bubble, styles.bubbleAi]}>
        <Text style={styles.typingDots}>• • •</Text>
      </View>
    );
  }

  return (
    <View>
      <View style={[styles.bubble, message.role === 'ai' ? styles.bubbleAi : styles.bubbleMe]}>
        <Text style={message.role === 'ai' ? styles.bubbleTextAi : styles.bubbleTextMe}>{message.text}</Text>
      </View>
      {message.eventIds?.map((id) => {
        const event = byId(events, id);
        if (!event) return null;
        const style = primaryTagStyle(event.tags);
        return (
          <Pressable key={id} style={styles.eventChip} onPress={() => onOpenDetail(id)}>
            <View style={[styles.eventChipIcon, { backgroundColor: style.tint }]}>
              <Icon name={style.icon} size={19} color={style.ink} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.eventChipTitle} numberOfLines={1}>
                {event.eventName}
              </Text>
              <Text style={styles.eventChipMeta} numberOfLines={1}>
                {[event.date, event.buildingName].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.accent2_200, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: font.heading, fontSize: 22, color: color.text },
  headerSub: { fontFamily: font.bodySemibold, fontSize: 11, color: color.accent2_700 },
  messages: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 10, gap: 10 },
  bubble: { maxWidth: '78%', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 22, marginBottom: 8 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: 'white', borderBottomLeftRadius: 8, ...shadow.sm },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: color.accent, borderBottomRightRadius: 8 },
  bubbleTextAi: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: color.text },
  bubbleTextMe: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: 'white' },
  typingDots: { color: color.neutral500, fontSize: 16, letterSpacing: 2 },
  eventChip: {
    alignSelf: 'flex-start',
    width: '82%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: color.divider,
    ...shadow.sm,
  },
  eventChipIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  eventChipTitle: { fontFamily: font.bodyBold, fontSize: 13.5, color: color.text },
  eventChipMeta: { fontFamily: font.bodySemibold, fontSize: 11, color: color.neutral600, marginTop: 2 },
  quickRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  quickChip: { borderWidth: 1.5, borderColor: color.accent300, backgroundColor: color.accent100, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13 },
  quickChipText: { fontFamily: font.bodyBold, fontSize: 12, color: color.accent800 },
  composer: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8, paddingBottom: 16 },
  composerInput: { flex: 1, backgroundColor: 'white', borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18, fontFamily: font.bodySemibold, fontSize: 13.5, color: color.text, ...shadow.sm },
  sendBtn: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
});
