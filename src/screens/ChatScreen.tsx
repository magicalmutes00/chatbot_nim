import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  FlatList,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  Image,
  Clipboard,
  ToastAndroid,
  Alert,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
import { TypingDots } from '../components/TypingDots';
import { radius, spacing, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import type { ChatMessage } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

const PANEL_WIDTH = 290;

export default function ChatScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const passedChatId = route.params?.chatId;

  const {
    activeChatId,
    selectedModel,
    imageAspect,
    messages,
    streamingText,
    streamingReasoning,
    isStreaming,
    error,
    setActiveChatId,
    setSelectedModel,
    setImageAspect,
    setMessages,
    startStreaming,
    appendStreamToken,
    appendReasoningToken,
    finishStreaming,
    setError,
    reset,
  } = useChatStore();

  const isImageModel = getModelById(selectedModel)?.kind === 'image';

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
    if (isImageModel) {
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
          } catch {
            setError('Reply could not be saved.');
          }
        },
        onError: (err, partial) => {
          const cancelled = err.name === 'AbortError';
          if (cancelled) {
            // User-initiated stop — not an error; keep whatever arrived.
            finishStreaming();
          } else {
            setError(err.message);
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
              addMessage(user.uid, chatIdNow, partialPayload).catch(() => {});
            }
          }
        },
      },
      controller.signal,
    );
  };

  /** Image-model flow: one prompt in, one image back (no streaming tokens). */
  const runImageGeneration = async (prompt: string, chatId: string, uid: string) => {
    startStreaming();
    setImageBusy(true);
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const uri = await generateImage(
        {
          model: selectedModel,
          prompt,
          width: imageAspect.width,
          height: imageAspect.height,
        },
        controller.signal,
      );
      const assistantMsg: ChatMessage = {
        id: `local-assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        imageUri: uri,
        imageAspect: imageAspect.width / imageAspect.height,
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
          imageAspect?: number;
        } = {
          role: 'assistant',
          content: persistable ? '' : '(image shown this session only — too large to save)',
          model: selectedModel,
          imageAspect: imageAspect.width / imageAspect.height,
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

  const renderItem = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      const newDay =
        index === 0 || dayKey(visibleMessages[index - 1].createdAt) !== dayKey(item.createdAt);
      return (
        <View>
          {newDay ? <Text style={styles.dateSep}>{dayLabel(item.createdAt)}</Text> : null}
          <Pressable
            onLongPress={() => copyMessage(item.content)}
            style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}
          >
            {item.role === 'assistant' && !item.imageUri ? (
              <View style={styles.assistantAccent} />
            ) : null}
            {item.imageUri ? (
              <>
                <Image
                  source={{ uri: item.imageUri }}
                  style={[styles.messageImage, { aspectRatio: item.imageAspect ?? 1 }]}
                  resizeMode="cover"
                />
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
        </View>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [styles, visibleMessages, showReasoning, savingId],
  );

  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyGlyph}>{'✦'}</Text>
      <Text style={styles.emptyTitle}>How can I help today?</Text>
      <Text style={styles.emptyHint}>
        {isImageModel
          ? 'Describe an image, pick a ratio below, then tap Create.'
          : 'Ask anything — replies stream in as they are generated. Long-press a reply to copy it.'}
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
        {/* Top bar: back + model picker trigger */}
        <View style={styles.topBar}>
          <Pressable
            hitSlop={10}
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            style={styles.backChip}
          >
            <Text style={styles.backIcon}>{'‹'}</Text>
          </Pressable>
          <Pressable style={styles.modelBtn} onPress={openPanel}>
            {isImageModel ? <View style={styles.modelDot} /> : null}
            <Text numberOfLines={1} style={styles.modelLabel}>
              {getModelById(selectedModel)?.label ?? 'Model'}
            </Text>
            <Text style={styles.chevron}>{'▾'}</Text>
          </Pressable>
          <View style={styles.backChip} />
        </View>

        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          onContentSizeChange={scrollToEnd}
          ListEmptyComponent={isStreaming ? undefined : renderEmpty}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={11}
          removeClippedSubviews
        />

        {isStreaming && (
          <View style={[styles.bubble, styles.assistantBubble, styles.streamingBubble]}>
            <View style={styles.assistantAccent} />
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
            <TypingDots color={colors.accent2} />
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Aspect ratio picker for image models */}
        {isImageModel && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.ratioRow}
            contentContainerStyle={styles.ratioRowContent}
          >
            {(getModelById(selectedModel)?.aspectRatios ?? []).map((r) => (
              <Pressable
                key={r.label}
                onPress={() => setImageAspect(r)}
                style={[styles.ratioChip, imageAspect.label === r.label && styles.ratioChipActive]}
              >
                <Text
                  style={[
                    styles.ratioChipText,
                    imageAspect.label === r.label && styles.ratioChipTextActive,
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            placeholder={isImageModel ? 'Describe the image…' : 'Message'}
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
              <View style={styles.stopSquare} />
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}
              onPress={handleSend}
              accessibilityLabel="Send"
            >
              <LinearGradient
                colors={colors.gradientPrimary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.sendBtnText}>{'➤'}</Text>
            </Pressable>
          )}
        </View>

        {/* Model picker slide-over */}
        {panelOpen && <Pressable style={styles.backdrop} onPress={closePanel} />}
        <Animated.View
          style={[styles.panel, { transform: [{ translateX: panelX }] }]}
          pointerEvents={panelOpen ? 'auto' : 'none'}
        >
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

function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  if (dayKey(ts) === dayKey(now.getTime())) return 'Today';
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dayKey(ts) === dayKey(yesterday.getTime())) return 'Yesterday';
  return d.toLocaleDateString();
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
    backChip: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colors.surfaceMuted,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { color: colors.textPrimary, fontSize: 24, lineHeight: 28, marginTop: -2 },
    modelBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.borderSubtle,
      borderWidth: 1,
      borderRadius: radius.pill,
      paddingVertical: 7,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.sm,
    },
    modelDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent2,
      marginRight: 7,
    },
    modelLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', flexShrink: 1 },
    chevron: { color: colors.textMuted, marginLeft: 6, fontSize: 12 },
    dateSep: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      textAlign: 'center',
      marginVertical: spacing.md,
    },
    list: { padding: spacing.md, paddingBottom: spacing.lg },
    bubble: {
      borderRadius: radius.lg,
      padding: spacing.md + 2,
      marginVertical: 4,
      maxWidth: '88%',
    },
    userBubble: { alignSelf: 'flex-end' },
    assistantBubble: {
      alignSelf: 'flex-start',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    assistantAccent: {
      position: 'absolute',
      left: 0,
      top: spacing.md,
      bottom: spacing.md,
      width: 3,
      borderRadius: 2,
      backgroundColor: colors.accent2,
    },
    userText: { color: colors.textPrimary, lineHeight: 20 },
    assistantText: { color: colors.textPrimary, lineHeight: 20, paddingLeft: 5 },
    reasoning: {
      color: colors.textSecondary,
      fontStyle: 'italic',
      marginTop: 6,
      fontSize: 12,
      paddingLeft: 5,
    },
    reasoningToggle: { color: colors.accent2, fontSize: 12, marginTop: 6, fontWeight: '600' },
    streamingBubble: { width: '88%', alignSelf: 'flex-start' },
    time: { alignSelf: 'flex-end', color: colors.textMuted, fontSize: 10, marginTop: 4 },
    messageImage: {
      width: '100%',
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
    saveBtnText: { color: colors.accent2, fontSize: 12, fontWeight: '700' },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xxl * 2,
      paddingTop: 120,
    },
    emptyGlyph: { color: colors.accent2, fontSize: 34, marginBottom: spacing.md },
    emptyTitle: { color: colors.textPrimary, fontSize: 21, fontWeight: '800', textAlign: 'center' },
    emptyHint: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: 'center',
      marginTop: spacing.sm,
      lineHeight: 19,
    },
    emptyModel: {
      color: colors.accent2,
      fontSize: 12,
      fontWeight: '700',
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
    ratioRow: { maxHeight: 42, flexGrow: 0 },
    ratioRowContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingBottom: spacing.xs,
    },
    ratioChip: {
      paddingVertical: 6,
      paddingHorizontal: 13,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceMuted,
    },
    ratioChipActive: { backgroundColor: colors.accent, borderColor: colors.accentGlow },
    ratioChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
    ratioChipTextActive: { color: colors.textPrimary },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginHorizontal: spacing.sm,
      marginBottom: spacing.sm,
      padding: spacing.sm + 1,
      backgroundColor: colors.surfaceBar,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      paddingTop: Platform.OS === 'ios' ? 8 : 6,
      paddingBottom: Platform.OS === 'ios' ? 8 : 6,
      paddingHorizontal: 6,
      maxHeight: 120,
      fontSize: 15,
    },
    sendBtn: {
      marginLeft: spacing.sm,
      width: 40,
      height: 40,
      borderRadius: 20,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.accent,
      shadowOpacity: 0.5,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    sendBtnText: { color: colors.textPrimary, fontSize: 16 },
    stopBtn: {
      marginLeft: spacing.sm,
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,92,106,0.16)',
      borderWidth: 1,
      borderColor: colors.danger,
    },
    stopSquare: { width: 12, height: 12, borderRadius: 3, backgroundColor: colors.danger },
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
    panelItemSelected: {
      backgroundColor: colors.accentSoft,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    panelItemText: { flex: 1 },
    panelItemLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
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
