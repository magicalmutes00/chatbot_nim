import { create } from 'zustand';
import { DEFAULT_MODEL_ID } from '../config/nimModels';
import type { ChatMessage } from '../types/chat';

interface ChatUiState {
  activeChatId: string | null;
  selectedModel: string;
  messages: ChatMessage[];
  streamingText: string;
  streamingReasoning: string;
  isStreaming: boolean;
  error: string | null;

  setActiveChatId: (id: string | null) => void;
  setSelectedModel: (model: string) => void;
  setMessages: (messages: ChatMessage[]) => void;
  startStreaming: () => void;
  appendStreamToken: (delta: string) => void;
  appendReasoningToken: (delta: string) => void;
  finishStreaming: () => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

export const useChatStore = create<ChatUiState>((set) => ({
  activeChatId: null,
  selectedModel: DEFAULT_MODEL_ID,
  messages: [],
  streamingText: '',
  streamingReasoning: '',
  isStreaming: false,
  error: null,

  setActiveChatId: (id) => set({ activeChatId: id }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setMessages: (messages) => set({ messages }),
  startStreaming: () => set({ isStreaming: true, streamingText: '', streamingReasoning: '', error: null }),
  appendStreamToken: (delta) => set((s) => ({ streamingText: s.streamingText + delta })),
  appendReasoningToken: (delta) => set((s) => ({ streamingReasoning: s.streamingReasoning + delta })),
  finishStreaming: () => set({ isStreaming: false, streamingText: '', streamingReasoning: '' }),
  setError: (error) => set({ error, isStreaming: false }),
  reset: () =>
    set({
      activeChatId: null,
      messages: [],
      streamingText: '',
      streamingReasoning: '',
      isStreaming: false,
      error: null,
    }),
}));
