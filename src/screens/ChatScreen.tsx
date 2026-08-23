import React, { useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { MainStackParamList } from '../navigation/AppNavigator';
import { useAuth } from '../contexts/AuthContext';
import { useChatStore } from '../store/chatStore';
import {
  addMessage,
  createChat,
  maybeSetTitleFromFirstMessage,
  subscribeToMessages,
} from '../services/firestoreChats';
import { streamChatCompletion } from '../api/nimClient';
import { NIM_MODELS, getModelById } from '../config/nimModels';
import type { ChatMessage } from '../types/chat';

type Props = NativeStackScreenProps<MainStackParamList, 'Chat'>;

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
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load or reset the active chat when navigating in
  useEffect(() => {
    reset();
    if (passedChatId) setActiveChatId(passedChatId);
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedChatId]);

  // Subscribe to messages for the active chat
  useEffect(() => {
    if (!user || !activeChatId) return;
    const unsubscribe = subscribeToMessages(user.uid, activeChatId, setMessages);
    return unsubscribe;
  }, [user, activeChatId, setMessages]);

  useEffect(() => {
    navigation.setOptions({
      title: getModelById(selectedModel)?.label ?? 'Chat',
      headerRight: () => (
        <Pressable onPress={() => setShowModelPicker((v) => !v)}>
          <Text style={styles.headerBtn}>Model</Text>
        </Pressable>
      ),
    });
  }, [navigation, selectedModel]);

  const scrollToEnd = () => setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

  const handleSend = async () => {
    if (!user || !input.trim() || isStreaming) return;
    const text = input.trim();
    setInput('');
    setError(null);

    // Read fresh state so a lagging snapshot can't send a stale conversation
    const { messages: freshMessages } = useChatStore.getState();

    let chatId = activeChatId;
    const isFirstMessage = freshMessages.length === 0;
    if (!chatId) {
      chatId = await createChat(user.uid, selectedModel);
      setActiveChatId(chatId);
    }

    await addMessage(user.uid, chatId, { role: 'user', content: text, model: selectedModel });
    if (isFirstMessage) {
      await maybeSetTitleFromFirstMessage(user.uid, chatId, text);
    }
    scrollToEnd();

    const conversation = [...freshMessages, { role: 'user' as const, content: text }].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    startStreaming();
    const controller = new AbortController();
    abortRef.current = controller;

    await streamChatCompletion(
      { model: selectedModel, messages: conversation, temperature: 1, top_p: 0.95, max_tokens: 4096 },
      {
        onToken: (delta) => {
          appendStreamToken(delta);
          scrollToEnd();
        },
        onReasoningToken: (delta) => {
          appendReasoningToken(delta);
        },
        onDone: async (fullText, fullReasoning) => {
          finishStreaming();
          if (fullText.trim()) {
            await addMessage(user.uid, chatId!, {
              role: 'assistant',
              content: fullText,
              reasoningContent: fullReasoning || undefined,
              model: selectedModel,
            });
          }
          scrollToEnd();
        },
        onError: async (err, partial) => {
          // Persist whatever arrived before the failure so partial replies
          // survive aborts/navigation/errors instead of being dropped.
          if (partial.fullText.trim() && chatId) {
            try {
              await addMessage(user.uid, chatId, {
                role: 'assistant',
                content: partial.fullText,
                reasoningContent: partial.fullReasoning || undefined,
                model: selectedModel,
              });
            } catch {
              // best-effort; surface the stream error below regardless
            }
          }
          if (err.name === 'AbortError') {
            finishStreaming();
          } else {
            finishStreaming();
            setError(err.message);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {showModelPicker && (
        <View style={styles.modelPicker}>
          {NIM_MODELS.map((m) => (
            <Pressable
              key={m.id}
              style={styles.modelOption}
              onPress={() => {
                setSelectedModel(m.id);
                setShowModelPicker(false);
              }}
            >
              <Text style={m.id === selectedModel ? styles.modelOptionSelected : styles.modelOptionText}>
                {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        onContentSizeChange={scrollToEnd}
      />

      {isStreaming && (
        <View style={[styles.bubble, styles.assistantBubble]}>
          <Text style={styles.assistantText}>{streamingText}</Text>
          {streamingReasoning ? (
            <Pressable onPress={() => setShowReasoning((v) => !v)}>
              <Text style={styles.reasoningToggle}>{showReasoning ? 'Hide reasoning' : 'Show reasoning'}</Text>
            </Pressable>
          ) : null}
          {showReasoning && streamingReasoning ? <Text style={styles.reasoning}>{streamingReasoning}</Text> : null}
          <ActivityIndicator size="small" style={{ marginTop: 4 }} />
        </View>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Message"
          value={input}
          onChangeText={setInput}
          multiline
        />
        <Pressable style={styles.sendBtn} onPress={handleSend} disabled={isStreaming}>
          <Text style={styles.sendBtnText}>{isStreaming ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12 },
  bubble: { borderRadius: 12, padding: 10, marginVertical: 4, maxWidth: '85%' },
  userBubble: { backgroundColor: '#007AFF', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#E9E9EB', alignSelf: 'flex-start' },
  userText: { color: '#fff' },
  assistantText: { color: '#000' },
  reasoning: { color: '#666', fontStyle: 'italic', marginTop: 6, fontSize: 12 },
  reasoningToggle: { color: '#007AFF', fontSize: 12, marginTop: 6 },
  error: { color: 'red', padding: 8, textAlign: 'center' },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, borderTopWidth: 1, borderTopColor: '#eee' },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, maxHeight: 120 },
  sendBtn: { marginLeft: 8, backgroundColor: '#007AFF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  sendBtnText: { color: '#fff', fontWeight: '600' },
  headerBtn: { color: '#007AFF', marginRight: 12 },
  modelPicker: { borderBottomWidth: 1, borderBottomColor: '#eee', backgroundColor: '#fafafa' },
  modelOption: { padding: 12 },
  modelOptionText: { color: '#333' },
  modelOptionSelected: { color: '#007AFF', fontWeight: '600' },
});
