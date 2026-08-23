// List of available NVIDIA NIM models the user can pick from per-conversation.
// Model IDs verified against https://integrate.api.nvidia.com/v1/models on 2026-08-23.
// NVIDIA retires models regularly — if replies stop coming, re-check the list endpoint.

export interface NimModel {
  id: string; // exact string sent to the NIM API "model" field
  label: string; // shown in the UI
  description?: string;
  supportsReasoning?: boolean; // whether it may return `reasoning_content`
}

export const NIM_MODELS: NimModel[] = [
  {
    id: 'meta/llama-3.1-8b-instruct',
    label: 'Llama 3.1 8B',
    description: 'Fast, low-latency, good default',
  },
  {
    id: 'meta/llama-3.1-70b-instruct',
    label: 'Llama 3.1 70B',
    description: 'Stronger general reasoning',
  },
  {
    id: 'openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    description: 'Large open-weight model with reasoning',
    supportsReasoning: true,
  },
  {
    id: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
    label: 'Nemotron Super 49B',
    description: 'NVIDIA reasoning model',
    supportsReasoning: true,
  },
];

export const DEFAULT_MODEL_ID = NIM_MODELS[0].id;

export function getModelById(id: string): NimModel | undefined {
  return NIM_MODELS.find((m) => m.id === id);
}
