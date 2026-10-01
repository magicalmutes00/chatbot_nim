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
  Image,
  Clipboard,
  ToastAndroid,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { useChatStore } from '../store/chatStore';
import { streamChatCompletion } from '../api/nimClient';
import { generateImage } from '../api/nimImageClient';
import { NIM_MODELS, getModelById } from '../config/nimModels';
import {
  addMessage,
  maybeSetTitleFromFirstMessage,
  subscribeToMessages,
} from '../services/firestoreChats';
import { ensureGalleryPermission, saveImageToGallery } from '../services/imageSave';
import { Background } from '../components/Background';
import { radius, spacing, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import Logo from '../assets/logo.png';
import type { ChatMessage } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

const PANEL_WIDTH = 290;

export default function ChatScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const passedChatId = route.params?.chatId;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const [imageBusy, setImageBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
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

    // Image models take a prompt, not chat history — run that flow instead.
    if (getModelById(selectedModel)?.kind === 'image') {
      await runImageGeneration(text, chatId, user.uid);
      return;
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
          const savedContent = fullText || fullReasoning?.trim() || '(empty response)';
          const assistantMsg: ChatMessage = {
            id: `local-assistant-${Date.now()}`,
            role: 'assistant',
            content: savedContent,
            reasoningContent: fullReasoning || undefined,
            model: selectedModel,
            createdAt: Date.now(),
          };
          setOptimistic((prev) => [...prev, assistantMsg]);
          scrollToEnd();
          try {
            // NOTE: never pass explicit `undefined` fields to firestore —
            // RNFirebase throws "Unsupported field value: undefined".
            const assistantPayload: {
              role: 'assistant';
              content: string;
              model: string;
              reasoningContent?: string;
            } = { role: 'assistant', content: savedContent, model: selectedModel };
            if (fullReasoning) assistantPayload.reasoningContent = fullReasoning;
            await addMessage(user.uid, chatId, assistantPayload);
            console.log('[ChatScreen] assistant reply persisted');
          } catch (e: any) {
            console.log('[ChatScreen] assistant save FAILED:', e?.code ?? e?.message ?? e);
            setError('Reply could not be saved.');
          }
        },
        onError: (err, partial) => {
          const cancelled = err.name === 'AbortError';
          if (cancelled) {
            // User-initiated stop — not an error; keep whatever arrived.
            finishStreaming();
            console.log('[ChatScreen] stream stopped by user');
          } else {
            setError(err.message);
            console.log('[ChatScreen] stream error:', err.message);
          }
          if (partial.fullText || partial.fullReasoning) {
            setOptimistic((prev) => [
              ...prev,
              {
                id: `local-assistant-${Date.now()}`,
                role: 'assistant',
                content: partial.fullText || partial.fullReasoning?.trim() || '(partial response)',
                reasoningContent: partial.fullReasoning || undefined,
                model: selectedModel,
                createdAt: Date.now(),
              },
            ]);
            // Persist whatever arrived so it survives app restarts.
            const chatIdNow = activeChatId ?? passedChatId;
            if (user && chatIdNow) {
              const partialPayload: {
                role: 'assistant';
                content: string;
                model: string;
                reasoningContent?: string;
              } = {
                role: 'assistant',
                content: partial.fullText || partial.fullReasoning?.trim() || '(partial response)',
                model: selectedModel,
              };
              if (partial.fullReasoning) partialPayload.reasoningContent = partial.fullReasoning;
              addMessage(user.uid, chatIdNow, partialPayload).catch((e) =>
                console.log('[ChatScreen] partial save FAILED:', e?.code ?? e),
              );
            }
          }
        },
      },
      controller.signal,
    );
  };

  const copyMessage = (text: string) => {
    if (!text) return;
    Clipboard.setString(text);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Copied to clipboard', ToastAndroid.SHORT);
    }
  };

  const handleSaveImage = async (item: ChatMessage) => {
    if (!item.imageUri || savingId) return;
    setSavingId(item.id);
    try {
      const allowed = await ensureGalleryPermission();
      if (!allowed) {
        if (Platform.OS === 'android') {
          ToastAndroid.show('Storage permission needed to save', ToastAndroid.LONG);
        }
        return;
      }
      await saveImageToGallery(item.imageUri);
      if (Platform.OS === 'android') {
        ToastAndroid.show('Saved to gallery', ToastAndroid.SHORT);
      } else {
        Alert.alert('Saved', 'Image added to your photo library.');
      }
    } catch (e: any) {
      const msg = e?.message ?? 'Could not save image';
      if (Platform.OS === 'android') {
        ToastAndroid.show(msg, ToastAndroid.LONG);
      } else {
        Alert.alert('Could not save image', msg);
      }
    } finally {
      setSavingId(null);
    }
  };

  /** Image-model flow: one prompt in, one image back (no streaming tokens). */
  const runImageGeneration = async (prompt: string, chatId: string, uid: string) => {
    startStreaming();
    setImageBusy(true);
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const uri = await generateImage({ model: selectedModel, prompt }, controller.signal);
      const assistantMsg: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        imageUri: uri,
        model: selectedModel,
        createdAt: Date.now(),
      };
      setOptimistic((prev) => [...prev, assistantMsg]);
      scrollToEnd();

      // Firestore docs cap at 1 MiB — skip persisting oversized images.
      const persistable = uri.length <= 700_000;
      try {
        const payload: {
          role: 'assistant';
          content: string;
          model: string;
          imageUri?: string;
        } = {
          role: 'assistant',
          content: persistable ? '' : '(image shown this session only — too large to save)',
          model: selectedModel,
        };
        if (persistable) payload.imageUri = uri;
        await addMessage(uid, chatId, payload);
      } catch {
        setError('Image could not be saved.');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setError(e?.message ?? 'Image generation failed');
      }
    } finally {
      setImageBusy(false);
      finishStreaming();
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => (
    <Pressable
      onLongPress={() => copyMessage(item.content)}
      style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}
    >
      {item.imageUri ? (
        <>
          <Image source={{ uri: item.imageUri }} style={styles.messageImage} resizeMode="cover" />
          {item.imageUri.startsWith('data:') ? (
            <Pressable
              disabled={savingId === item.id}
              onPress={() => handleSaveImage(item)}
              style={styles.saveBtn}
            >
              <Text style={styles.saveBtnText}>
                {savingId === item.id ? 'Saving…' : 'Save image'}
              </Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {item.content ? (
        <Text style={item.role === 'user' ? styles.userText : styles.assistantText}>
          {item.role === 'assistant' ? stripMarkdown(item.content) : item.content}
        </Text>
      ) : null}
      {item.reasoningContent && showReasoning ? (
        <Text style={styles.reasoning}>{item.reasoningContent}</Text>
      ) : null}
      <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
    </Pressable>
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>How can I help today?</Text>
      <Text style={styles.emptyHint}>
        Ask anything — replies stream in as they're generated. Long-press a reply to copy it.
      </Text>
      <Text style={styles.emptyModel}>Model: {getModelById(selectedModel)?.label ?? selectedModel}</Text>
    </View>
  );

  return (
    <Background>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Top bar: back + logo + model picker trigger */}
        <View style={styles.topBar}>
          <Pressable hitSlop={10} onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'‹'}</Text>
          </Pressable>
          <Image source={Logo} style={styles.headerLogo} resizeMode="contain" />
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
          ListEmptyComponent={isStreaming ? undefined : renderEmpty}
        />

        {isStreaming && (
          <View style={[styles.bubble, styles.assistantBubble]}>
            {imageBusy ? <Text style={styles.assistantText}>Generating image…</Text> : null}
            {!!streamingText && <Text style={styles.assistantText}>{stripMarkdown(streamingText)}</Text>}
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
            <ActivityIndicator size="small" color={colors.accent2} style={{ marginTop: 4 }} />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.input}
            placeholder={
              getModelById(selectedModel)?.kind === 'image' ? 'Describe the image…' : 'Message'
            }
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
          />
          {isStreaming ? (
            <Pressable
              style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.7 }]}
              onPress={() => abortRef.current?.abort()}
              accessibilityLabel="Stop generating"
            >
              <Text style={styles.stopBtnText}>Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }]}
              onPress={handleSend}
            >
              <Text style={styles.sendBtnText}>
                {getModelById(selectedModel)?.kind === 'image' ? 'Create' : 'Send'}
              </Text>
            </Pressable>
          )}
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
              {m.kind === 'image' ? <Text style={styles.panelBadge}>{'IMG'}</Text> : null}
              {m.id === selectedModel ? <Text style={styles.check}>{'✓'}</Text> : null}
            </Pressable>
          ))}
        </Animated.View>
      </KeyboardAvoidingView>
    </Background>
  );
}

/** Removes markdown bold markers (and stray **) that models emit in plain text. */
function stripMarkdown(text: string): string {
  return text.replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\*\*/g, '');
}

/** Manual HH:MM am/pm — avoids Hermes Intl quirks on some Android devices. */
function formatTime(ts: number): string {
  const d = new Date(ts);
  const h24 = d.getHours();
  const h = h24 % 12 || 12;
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m} ${h24 >= 12 ? 'pm' : 'am'}`;
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  backIcon: { color: colors.textPrimary, fontSize: 30, lineHeight: 34, marginRight: 4 },
  headerLogo: { width: 80, height: 24 },
  modelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
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
    borderColor: colors.border,
  },
  assistantBubble: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  userText: { color: colors.textPrimary },
  assistantText: { color: colors.textPrimary },
  reasoning: { color: colors.textSecondary, fontStyle: 'italic', marginTop: 6, fontSize: 12 },
  reasoningToggle: { color: colors.accent2, fontSize: 12, marginTop: 6 },
  time: { alignSelf: 'flex-end', color: colors.textMuted, fontSize: 10, marginTop: 4 },
  messageImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.sm,
    marginTop: 2,
  },
  saveBtn: {
    alignSelf: 'flex-end',
    marginTop: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  saveBtnText: { color: colors.accent2, fontSize: 12, fontWeight: '600' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl * 2, paddingTop: 120 },
  emptyTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center' },
  emptyHint: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: spacing.sm, lineHeight: 19 },
  emptyModel: {
    color: colors.accent2,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.lg,
    backgroundColor: colors.accent2Soft,
    borderColor: colors.borderSubtle,
    borderWidth: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  error: { color: colors.danger, padding: spacing.sm, textAlign: 'center', fontSize: 12 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: spacing.sm,
    backgroundColor: colors.surfaceBar,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    maxHeight: 120,
    fontSize: 15,
  },
  sendBtn: {
    marginLeft: spacing.sm,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accentGlow,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendBtnText: { color: colors.textPrimary, fontWeight: '600' },
  stopBtn: {
    marginLeft: spacing.sm,
    backgroundColor: 'rgba(255,92,106,0.14)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  stopBtnText: { color: colors.danger, fontWeight: '600' },
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
    borderLeftColor: colors.borderSubtle,
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
  panelItemSelected: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.accent },
  panelItemText: { flex: 1 },
  panelItemLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  panelItemDesc: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  panelBadge: {
    color: colors.accent2,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginLeft: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent2,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  check: { color: colors.accent2, marginLeft: spacing.sm, fontSize: 16, fontWeight: '700' },
});
