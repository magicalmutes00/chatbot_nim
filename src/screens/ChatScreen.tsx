import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { useChatStore } from '../store/chatStore';
import { streamChatCompletion } from '../api/nimClient';
import { NIM_MODELS, getModelById } from '../config/nimModels';
import {
  addMessage,
  maybeSetTitleFromFirstMessage,
  subscribeToMessages,
} from '../services/firestoreChats';
import { GlassBackground } from '../components/GlassBackground';
import { colors, radius, spacing } from '../theme/glass';
import type { ChatMessage } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

const PANEL_WIDTH = 290;

export default function ChatScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const passedChatId = route.params?.chatId;

  const {
    activeChatId,
    selectedModel,
    messages,
    streamingText,
    streamingReasoning,
    isStreaming,
    error,
    setActiveChatId,
    setSelectedModel,
    setMessages,
    startStreaming,
    appendStreamToken,
    appendReasoningToken,
    finishStreaming,
    setError,
    reset,
  } = useChatStore();

  const [input, setInput] = useState('');
  const [showReasoning, setShowReasoning] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  /** Messages shown instantly before Firestore confirms them. */
  const [optimistic, setOptimistic] = useState<ChatMessage[]>([]);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const serverMessagesRef = useRef<ChatMessage[]>([]);
  const panelX = useRef(new Animated.Value(PANEL_WIDTH)).current;

  // Load or reset the active chat when navigating in
  useEffect(() => {
    reset();
    setOptimistic([]);
    if (passedChatId) setActiveChatId(passedChatId);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedChatId]);

  // Live message history from Firestore
  useEffect(() => {
    if (!user || !activeChatId) return;
    const unsubscribe = subscribeToMessages(user.uid, activeChatId, (msgs) => {
      serverMessagesRef.current = msgs;
      setMessages(msgs);
      // Drop optimistic copies once the persisted versions arrive.
      setOptimistic((pending) =>
        pending.filter((p) => !msgs.some((m) => m.role === p.role && m.content === p.content)),
      );
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeChatId]);

  const visibleMessages = useMemo(
    () => [
      ...messages,
      ...optimistic.filter((p) => !messages.some((m) => m.role === p.role && m.content === p.content)),
    ],
    [messages, optimistic],
  );

  const visibleRef = useRef<ChatMessage[]>([]);
  useEffect(() => {
    visibleRef.current = visibleMessages;
  }, [visibleMessages]);

  const scrollToEnd = () =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);

  const openPanel = () => {
    setPanelOpen(true);
    Animated.timing(panelX, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const closePanel = () => {
    Animated.timing(panelX, {
      toValue: PANEL_WIDTH,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setPanelOpen(false);
    });
  };

  const handleSend = async () => {
    if (!user || !input.trim() || isStreaming) return;
    const chatId = activeChatId ?? passedChatId;
    if (!chatId) return;

    const text = input.trim();
    setInput('');
    setError(null);

    const isFirstMessage =
      serverMessagesRef.current.length === 0 && !optimistic.some((m) => m.role === 'user');

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: text,
      model: selectedModel,
      createdAt: Date.now(),
    };
    setOptimistic((prev) => [...prev, userMsg]);
    scrollToEnd();

    try {
      if (isFirstMessage) {
        await maybeSetTitleFromFirstMessage(user.uid, chatId, text);
      }
      await addMessage(user.uid, chatId, {
        role: 'user',
        content: text,
        model: selectedModel,
      });
    } catch {
      setError('Could not save your message.');
    }

    const history = visibleRef.current.map((m) => ({ role: m.role, content: m.content }));

    startStreaming();
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChatCompletion(
      { model: selectedModel, messages: history },
      {
        onToken: appendStreamToken,
        onReasoningToken: appendReasoningToken,
        onDone: async (fullText, fullReasoning) => {
          finishStreaming();
          const assistantMsg: ChatMessage = {
            id: `local-assistant-${Date.now()}`,
            role: 'assistant',
            content: fullText || '(empty response)',
            reasoningContent: fullReasoning || undefined,
            model: selectedModel,
            createdAt: Date.now(),
          };
          setOptimistic((prev) => [...prev, assistantMsg]);
          scrollToEnd();
          try {
            await addMessage(user.uid, chatId, {
              role: 'assistant',
              content: fullText,
              reasoningContent: fullReasoning || undefined,
              model: selectedModel,
            });
          } catch {
            // Reply stays visible via the optimistic copy even if saving fails.
          }
        },
        onError: (err, partial) => {
          setError(err.message);
          if (partial.fullText) {
            setOptimistic((prev) => [
              ...prev,
              {
                id: `local-assistant-${Date.now()}`,
                role: 'assistant',
                content: partial.fullText,
                reasoningContent: partial.fullReasoning || undefined,
                model: selectedModel,
                createdAt: Date.now(),
              },
            ]);
          }
        },
      },
      controller.signal,
    );
  };

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
      <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>{item.content}</Text>
      {item.reasoningContent && showReasoning ? (
        <Text style={styles.reasoning}>{item.reasoningContent}</Text>
      ) : null}
    </View>
  );

  return (
    <GlassBackground>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Top bar: back + model picker trigger */}
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'‹'}</Text>
          </Pressable>
          <Pressable style={styles.modelBtn} onPress={openPanel}>
            <Text numberOfLines={1} style={styles.modelLabel}>
              {getModelById(selectedModel)?.label ?? 'Model'}
            </Text>
            <Text style={styles.chevron}>{'▾'}</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollToEnd}
        />

        {isStreaming && (
          <View style={[styles.bubble, styles.assistantBubble]}>
            {!!streamingText && <Text style={styles.assistantText}>{streamingText}</Text>}
            {streamingReasoning ? (
              <Pressable onPress={() => setShowReasoning((v) => !v)}>
                <Text style={styles.reasoningToggle}>
                  {showReasoning ? 'Hide reasoning' : 'Show reasoning'}
                </Text>
              </Pressable>
            ) : null}
            {showReasoning && streamingReasoning ? (
              <Text style={styles.reasoning}>{streamingReasoning}</Text>
            ) : null}
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 4 }} />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder="Message"
            placeholderTextColor="rgba(255,255,255,0.40)"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }]}
            onPress={handleSend}
            disabled={isStreaming}
          >
            <Text style={styles.sendBtnText}>{isStreaming ? '…' : 'Send'}</Text>
          </Pressable>
        </View>

        {/* Model picker slide-over */}
        {panelOpen && <Pressable style={styles.backdrop} onPress={closePanel} />}
        <Animated.View style={[styles.panel, { transform: [{ translateX: panelX }] }]} pointerEvents={panelOpen ? 'auto' : 'none'}>
          <Text style={styles.panelTitle}>Choose model</Text>
          {NIM_MODELS.map((m) => (
            <Pressable
              key={m.id}
              style={({ pressed }) => [
                styles.panelItem,
                m.id === selectedModel && styles.panelItemSelected,
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => {
                setSelectedModel(m.id);
                closePanel();
              }}
            >
              <View style={styles.panelItemText}>
                <Text style={styles.panelItemLabel} numberOfLines={1}>
                  {m.label}
                </Text>
                {m.description ? (
                  <Text style={styles.panelItemDesc} numberOfLines={2}>
                    {m.description}
                  </Text>
                ) : null}
              </View>
              {m.id === selectedModel ? <Text style={styles.check}>{'✓'}</Text> : null}
            </Pressable>
          ))}
        </Animated.View>
      </KeyboardAvoidingView>
    </GlassBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backIcon: { color: colors.textPrimary, fontSize: 30, lineHeight: 34, marginRight: spacing.md },
  modelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.glassLighter,
    borderColor: colors.glassBorderSubtle,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    maxWidth: '70%',
  },
  modelLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  chevron: { color: colors.textMuted, marginLeft: 6, fontSize: 12 },
  list: { padding: spacing.md, paddingBottom: spacing.lg },
  bubble: { borderRadius: radius.lg, padding: spacing.md, marginVertical: 4, maxWidth: '85%' },
  userBubble: {
    backgroundColor: colors.accentSoft,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  assistantBubble: {
    backgroundColor: colors.glassLighter,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.glassBorderSubtle,
  },
  userText: { color: colors.textPrimary },
  assistantText: { color: colors.textPrimary },
  reasoning: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 6, fontSize: 12 },
  reasoningToggle: { color: colors.accent, fontSize: 12, marginTop: 6 },
  error: { color: colors.danger, padding: spacing.sm, textAlign: 'center', fontSize: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    backgroundColor: colors.glassDark,
    borderTopWidth: 1,
    borderTopColor: colors.glassBorderSubtle,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    backgroundColor: colors.glassLighter,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnText: { color: colors.accent, fontWeight: '600' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: PANEL_WIDTH,
    backgroundColor: colors.bgBaseAlt,
    borderLeftWidth: 1,
    borderLeftColor: colors.glassBorderSubtle,
    paddingTop: spacing.xxl * 2,
    paddingHorizontal: spacing.md,
    elevation: 12,
  },
  panelTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: spacing.md,
  },
  panelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  panelItemSelected: { backgroundColor: colors.glassLighter, borderWidth: 1, borderColor: colors.glassBorder },
  panelItemText: { flex: 1 },
  panelItemLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  panelItemDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  check: { color: colors.accent, marginLeft: spacing.sm, fontSize: 16, fontWeight: '700' },
});
