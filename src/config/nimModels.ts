// List of available NVIDIA NIM models the user can pick from per-conversation.
// Keeping this in its own file (rather than hardcoded in the picker component)
// means new models can be added without touching UI code. If you'd rather not
// ship a new build every time NVIDIA adds a model, swap this for a fetch from
// a Firestore `models` collection (see comment at the bottom).

export interface NimModel {
  id: string; // exact string sent to the NIM API "model" field
  label: string; // shown in the UI
  description?: string;
  supportsReasoning?: boolean; // whether it may return `reasoning_content`
}

export const NIM_MODELS: NimModel[] = [
  {
    id: 'deepseek-ai/deepseek-v4-flash-0731',
    label: 'DeepSeek V4 Flash',
    description: 'Fast, low-latency, good default',
    supportsReasoning: true,
  },
  {
    id: 'meta/llama-3.1-405b-instruct',
    label: 'Llama 3.1 405B Instruct',
    description: 'Largest Llama, strongest general reasoning',
  },
  {
    id: 'mistralai/mixtral-8x22b-instruct-v0.1',
    label: 'Mixtral 8x22B Instruct',
    description: 'Mixture-of-experts, strong multilingual',
  },
  {
    id: 'google/gemma-2-27b-it',
    label: 'Gemma 2 27B IT',
    description: 'Compact, efficient',
  },
];

export const DEFAULT_MODEL_ID = NIM_MODELS[0].id;

export function getModelById(id: string): NimModel | undefined {
  return NIM_MODELS.find((m) => m.id === id);
}

// --- Optional: Firestore-backed model list -------------------------------
// If you want to add/remove models without an app update, replace the static
// array above with a Firestore read, e.g.:
//
//   const snap = await firestore().collection('models').orderBy('order').get();
//   return snap.docs.map(d => ({ id: d.id, ...d.data() } as NimModel));
//
// and cache the result in the chat store on app start.
