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
import { launchImageLibrary } from 'react-native-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { useChatStore } from '../store/chatStore';
import { streamChatCompletion } from '../api/nimClient';
import { generateImage } from '../api/nimImageClient';
import { uploadImage } from '../api/attachments';
import { NIM_MODELS, getModelById } from '../config/nimModels';
import {
  addMessage,
  maybeSetTitleFromFirstMessage,
  subscribeToMessages,
} from '../services/firestoreChats';
import { ensureGalleryPermission, saveImageToGallery } from '../services/imageSave';
import { rememberImageAspect } from '../services/imageAspects';
import { Background } from '../components/Background';
import { TypingDots } from '../components/TypingDots';
import { radius, spacing, type ThemeColors } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';
import type { ChatAttachment, ChatMessage } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

const PANEL_WIDTH = 290;

/** Uploaded image kept alongside a local preview URI for the optimistic bubble. */
interface PendingImage extends ChatAttachment {
  previewUri: string;
  width?: number;
  height?: number;
}

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
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [picking, setPicking] = useState(false);
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
    setPendingImage(null);
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
      setOptimistic((pending) => pending.filter((p) => !msgs.some((m) => isSameMessage(p, m))));
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activeChatId]);

  const visibleMessages = useMemo(
    () => [
      ...messages,
      ...optimistic.filter((p) => !messages.some((m) => isSameMessage(p, m))),
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

  /**
   * Picks one photo, uploads it to S3, and switches to a vision model.
   *
   * Upload happens on selection (like the web composer) so the send step only
   * has to forward the stored key. The picker returns base64 because React
   * Native cannot stream a gallery URI into an S3 PUT.
   */
  const pickImage = async () => {
    if (picking || isStreaming || isImageModel) return;
    setPicking(true);
    setError(null);

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
        includeBase64: true,
        assetRepresentationMode: 'compatible',
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        setError(
          result.errorMessage ??
            (result.errorCode === 'permission'
              ? 'Photo library access is needed to attach an image.'
              : 'Could not open the photo library.'),
        );
        return;
      }

      const asset = result.assets?.[0];
      if (!asset?.base64) {
        setError('That photo could not be read. Try another image.');
        return;
      }

      const mimeType = (asset.type ?? 'image/jpeg').toLowerCase();
      const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
      const uploaded = await uploadImage({
        base64: asset.base64,
        mimeType,
        filename: asset.fileName ?? `photo-${Date.now()}.${ext}`,
      });

      if (asset.width && asset.height) {
        rememberImageAspect(uploaded.key, asset.width / asset.height);
      }

      setPendingImage({
        ...uploaded,
        previewUri: asset.uri ?? `data:${uploaded.mimeType};base64,${asset.base64}`,
        width: asset.width,
        height: asset.height,
      });

      // Only vision models can read an attached picture.
      if (!getModelById(selectedModel)?.vision) {
        const visionModel = NIM_MODELS.find((m) => m.vision);
        if (visionModel) setSelectedModel(visionModel.id);
      }
    } catch (e: any) {
      setError(e?.message ?? 'Could not upload that image.');
    } finally {
      setPicking(false);
    }
  };

  const handleSend = async () => {
    if (!user || !input.trim() || isStreaming || picking) return;
    const chatId = activeChatId ?? passedChatId;
    if (!chatId) return;

    const text = input.trim();
    const sentImage = pendingImage;
    setInput('');
    setError(null);
    if (sentImage) setPendingImage(null);

    // Re-check at send time: the user may have switched back to a text model
    // after attaching, which the server would reject.
    let chatModel = selectedModel;
    if (sentImage && !getModelById(chatModel)?.vision) {
      const visionModel = NIM_MODELS.find((m) => m.vision);
      if (visionModel) {
        chatModel = visionModel.id;
        setSelectedModel(visionModel.id);
      }
    }

    const isFirstMessage =
      serverMessagesRef.current.length === 0 && !optimistic.some((m) => m.role === 'user');

    const userMsg: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: text,
      model: chatModel,
      createdAt: Date.now(),
    };
    if (sentImage) {
      userMsg.imageUri = sentImage.previewUri;
      if (sentImage.width && sentImage.height) {
        userMsg.imageAspect = sentImage.width / sentImage.height;
      }
    }
    setOptimistic((prev) => [...prev, userMsg]);
    scrollToEnd();

    try {
      if (isFirstMessage) {
        await maybeSetTitleFromFirstMessage(user.uid, chatId, text);
      }
      await addMessage(user.uid, chatId, {
        role: 'user',
        content: text,
        model: chatModel,
      });
    } catch {
      setError('Could not save your message.');
    }

    // Image models take a prompt, not chat history — run that flow instead.
    if (isImageModel) {
      await runImageGeneration(text, chatId);
      return;
    }

    const history = visibleRef.current.map((m) => ({ role: m.role, content: m.content }));

    startStreaming();
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChatCompletion(
      {
        model: chatModel,
        messages: history,
        conversationId: chatId.startsWith('temp-') ? undefined : chatId,
        ...(sentImage
          ? {
              attachments: [
                {
                  key: sentImage.key,
                  filename: sentImage.filename,
                  mimeType: sentImage.mimeType,
                  sizeBytes: sentImage.sizeBytes,
                },
              ],
            }
          : {}),
      },
      {
        onStart: (conversationId) => {
          // The first turn creates the conversation server-side; adopt its id so
          // later turns append to it and the history poll starts working.
          setActiveChatId(conversationId);
        },
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
            model: chatModel,
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
            } = { role: 'assistant', content: savedContent, model: chatModel };
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
                model: chatModel,
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
                model: chatModel,
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

  /** Image-model flow: one prompt in, one stored image back (no streaming tokens). */
  const runImageGeneration = async (prompt: string, chatId: string) => {
    startStreaming();
    setImageBusy(true);
    scrollToEnd();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await generateImage(
        {
          model: selectedModel,
          prompt,
          size: imageAspect.label,
          // A temp id means the conversation does not exist yet; the server
          // creates it and returns the real id.
          conversationId: chatId.startsWith('temp-') ? undefined : chatId,
        },
        controller.signal,
      );

      // Adopt the server's conversation id so later turns append to it and the
      // history poll picks up the generated image.
      setActiveChatId(result.conversationId);
      rememberImageAspect(result.image.key, imageAspect.width / imageAspect.height);

      const assistantMsg: ChatMessage = {
        // The server already persisted this reply; reusing its id lets the poll
        // replace the optimistic copy instead of rendering both.
        id: result.messageId,
        role: 'assistant',
        content: '',
        imageUri: result.image.url,
        imageAspect: imageAspect.width / imageAspect.height,
        model: result.model,
        createdAt: Date.now(),
      };
      setOptimistic((prev) => [...prev, assistantMsg]);
      scrollToEnd();
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
                {canSaveImage(item.imageUri) ? (
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
          ? 'Describe an image, pick a ratio below, then tap send.'
          : 'Ask anything, or attach a photo with + — replies stream in as they are generated. Long-press a reply to copy it.'}
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

        {/* Attachment preview (uploaded before send) */}
        {pendingImage ? (
          <View style={styles.attachRow}>
            <View style={styles.attachThumbWrap}>
              <Image
                source={{ uri: pendingImage.previewUri }}
                style={styles.attachThumb}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => setPendingImage(null)}
                hitSlop={8}
                style={styles.attachRemove}
                accessibilityLabel="Remove attached image"
              >
                <Text style={styles.attachRemoveText}>{'×'}</Text>
              </Pressable>
            </View>
            <View style={styles.attachInfo}>
              <Text style={styles.attachName} numberOfLines={1}>
                {pendingImage.filename}
              </Text>
              <Text style={styles.attachMeta} numberOfLines={1}>
                {formatBytes(pendingImage.sizeBytes)} · sent to{' '}
                {getModelById(selectedModel)?.label ?? 'a vision model'}
              </Text>
            </View>
          </View>
        ) : picking ? (
          <Text style={styles.attachHint}>Uploading image…</Text>
        ) : null}

        {/* Composer */}
        <View style={styles.composer}>
          {!isImageModel ? (
            <Pressable
              disabled={picking || isStreaming}
              onPress={pickImage}
              style={({ pressed }) => [
                styles.attachBtn,
                (picking || isStreaming) && { opacity: 0.45 },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityLabel={pendingImage ? 'Replace attached image' : 'Attach an image'}
            >
              <Text style={styles.attachBtnText}>{picking ? '…' : '＋'}</Text>
            </Pressable>
          ) : null}
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
              disabled={picking}
              style={({ pressed }) => [
                styles.sendBtn,
                picking && { opacity: 0.45 },
                pressed && { opacity: 0.8 },
              ]}
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
                if (m.kind === 'image') setPendingImage(null);
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
              {m.kind === 'image' ? (
                <Text style={styles.panelBadge}>{'IMG'}</Text>
              ) : m.vision ? (
                <Text style={styles.panelBadge}>{'VIS'}</Text>
              ) : null}
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

/** Local data URIs and stored (presigned) images can both be saved to the gallery. */
function canSaveImage(uri: string): boolean {
  return uri.startsWith('data:') || uri.startsWith('http://') || uri.startsWith('https://');
}

/** Compact attachment size for the composer chip. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'image';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Whether a persisted message already covers an optimistic one.
 *
 * User messages match by role+content: the server assigns a different id than
 * the local placeholder, and an attached photo must not block the match (the
 * polled copy has a presigned URL instead of the local preview). Assistant
 * images match only by id: their URLs are regenerated per request, and an
 * older image reply also has empty content, so either check alone would hide
 * or duplicate the new render.
 */
function isSameMessage(pending: ChatMessage, persisted: ChatMessage): boolean {
  if (pending.id === persisted.id) return true;
  if (pending.role === 'user') {
    return persisted.role === 'user' && pending.content === persisted.content;
  }
  if (pending.imageUri || persisted.imageUri) return false;
  return pending.role === persisted.role && pending.content === persisted.content;
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
    attachRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.md,
      marginBottom: spacing.xs,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.borderSubtle,
      backgroundColor: colors.surfaceMuted,
    },
    attachThumbWrap: { position: 'relative' },
    attachThumb: {
      width: 52,
      height: 52,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
    },
    attachRemove: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.bgBaseAlt,
      borderWidth: 1,
      borderColor: colors.border,
    },
    attachRemoveText: { color: colors.textPrimary, fontSize: 13, lineHeight: 15 },
    attachInfo: { flex: 1, marginLeft: spacing.sm },
    attachName: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
    attachMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
    attachHint: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    attachBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 2,
      marginBottom: Platform.OS === 'ios' ? 2 : 3,
    },
    attachBtnText: { color: colors.textSecondary, fontSize: 22, lineHeight: 24, marginTop: -2 },
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
