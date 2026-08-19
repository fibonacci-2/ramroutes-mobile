import { Dispatch, SetStateAction, useEffect, useRef, useState } from 'react';
import { Animated, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Icon from '../components/Icon';
import { primaryTagStyle } from '../constants/tagStyles';
import { EventWithLocation } from '../hooks/useEvents';
import { recordError, trackEvent } from '../services/analytics';
import { askScout, ScoutHistoryMessage } from '../services/scout';
import { color, font, radius, shadow } from '../theme';
import { byId } from '../utils/byId';

export type Message = { id: string; role: 'ai' | 'me'; text: string; eventIds?: string[]; typing?: boolean };

const QUICK_PROMPTS = ['What’s happening around campus?', 'Anything career related?', 'Something fun', 'Where can I volunteer?'];

// Module-level counter resets to 0 on every Fast Refresh reload without
// remounting the component, which collided with already-rendered message
// keys mid-session - stamp with time too so a reload can't reintroduce an id.
let nextId = 0;
const newId = () => `${Date.now()}-${nextId++}`;

type Props = {
  events: EventWithLocation[];
  messages: Message[];
  setMessages: Dispatch<SetStateAction<Message[]>>;
  seedMessage: string | null;
  onSeedConsumed: () => void;
  onOpenDetail: (eventId: string) => void;
};

export default function ScoutScreen({ events, messages, setMessages, seedMessage, onSeedConsumed, onOpenDetail }: Props) {
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  // messages is now owned by RootShell so it survives tab switches instead
  // of resetting every time this screen unmounts - guard the greeting on
  // the list being empty (not a mount-only ref) so it still only fires once
  // per real conversation, not once per remount.
  useEffect(() => {
    if (messages.length > 0) return;
    aiSay('Hey! I’m Scout — I know what’s happening around campus. Ask me for recommendations, or tap a suggestion below.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Recent turns only (not the whole conversation) - Scout doesn't need
  // full history to stay coherent, and it keeps the request small. Read
  // before this message's own state update below, so it correctly excludes
  // the message being sent (that goes to askScout separately).
  const recentHistory = (): ScoutHistoryMessage[] =>
    messages
      .filter((m) => !m.typing)
      .slice(-6)
      .map((m) => ({ role: m.role, text: m.text }));

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const history = recentHistory();

    setMessages((prev) => [...prev, { id: newId(), role: 'me', text }]);
    setInput('');
    scrollToEnd();

    const typingId = newId();
    setMessages((prev) => [...prev, { id: typingId, role: 'ai', text: '', typing: true }]);
    scrollToEnd();

    trackEvent('scout_message_sent');

    askScout(text, history)
      .then((reply) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === typingId ? { id: typingId, role: 'ai', text: reply.text, eventIds: reply.eventIds } : m))
        );
      })
      .catch((err) => {
        recordError(err, 'scout-reply');
        setMessages((prev) =>
          prev.map((m) =>
            m.id === typingId
              ? { id: typingId, role: 'ai', text: "Sorry, I couldn't come up with a reply just now — try again in a moment." }
              : m
          )
        );
      })
      .finally(scrollToEnd);
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
        style={styles.quickRowOuter}
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

// Three dots bouncing in a wave while Scout's reply is generating. Each
// dot's sequence (delay, up, down, delay) sums to the same 760ms cycle
// length with a different lead-in delay, so the stagger between dots stays
// locked in phase forever instead of drifting apart loop to loop.
const DOT_CYCLE_MS = 760;
const DOT_BOUNCE_MS = 200;
const DOT_OFFSETS_MS = [0, 120, 240];

function TypingDots() {
  const dots = useRef(DOT_OFFSETS_MS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = dots.map((value, i) => {
      const offset = DOT_OFFSETS_MS[i];
      const tail = DOT_CYCLE_MS - offset - DOT_BOUNCE_MS * 2;
      return Animated.loop(
        Animated.sequence([
          Animated.delay(offset),
          Animated.timing(value, { toValue: -5, duration: DOT_BOUNCE_MS, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: DOT_BOUNCE_MS, useNativeDriver: true }),
          Animated.delay(tail),
        ])
      );
    });
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [dots]);

  return (
    <View style={styles.typingRow}>
      {dots.map((value, i) => (
        <Animated.View key={i} style={[styles.typingDot, { transform: [{ translateY: value }] }]} />
      ))}
    </View>
  );
}

function MessageBubble({ message, events, onOpenDetail }: { message: Message; events: EventWithLocation[]; onOpenDetail: (id: string) => void }) {
  if (message.typing) {
    return (
      <View style={[styles.bubble, styles.bubbleAi]}>
        <TypingDots />
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
  // flexGrow + justifyContent anchor short conversations to the bottom of
  // the scroll area (right above the quick prompts) instead of floating at
  // the top and leaving a dead gap below - the FlatList still scrolls
  // normally once content overflows.
  messagesContent: { flexGrow: 1, justifyContent: 'flex-end', padding: 16, paddingBottom: 10, gap: 10 },
  bubble: { maxWidth: '78%', paddingVertical: 11, paddingHorizontal: 15, borderRadius: 22, marginBottom: 8 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: 'white', borderBottomLeftRadius: 8, ...shadow.sm },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: color.accent, borderBottomRightRadius: 8 },
  bubbleTextAi: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: color.text },
  bubbleTextMe: { fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: 'white' },
  typingRow: { flexDirection: 'row', gap: 5, paddingVertical: 3, paddingHorizontal: 2 },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: color.neutral500 },
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
  // ScrollView's default base style bakes in flexGrow:1/flexShrink:1 on the
  // outer scroll container - without this override, this horizontal
  // FlatList silently grows to fill the flex column right alongside
  // `messages` (also flex:1), leaving the actual chip row stranded, vertically
  // centered in a huge empty band instead of sitting content-height-tall
  // right above the composer.
  quickRowOuter: { flexGrow: 0, flexShrink: 0 },
  quickRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' },
  quickChip: { borderWidth: 1.5, borderColor: color.accent300, backgroundColor: color.accent100, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 13 },
  quickChipText: { fontFamily: font.bodyBold, fontSize: 12, color: color.accent800 },
  composer: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingVertical: 8, paddingBottom: 16 },
  composerInput: { flex: 1, backgroundColor: 'white', borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18, fontFamily: font.bodySemibold, fontSize: 13.5, color: color.text, ...shadow.sm },
  sendBtn: { width: 46, height: 46, borderRadius: radius.pill, backgroundColor: color.accent, alignItems: 'center', justifyContent: 'center' },
});
