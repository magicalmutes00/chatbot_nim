// Models available in the app. Chat models use the OpenAI-compatible
// /v1/chat/completions endpoint; image models (kind: 'image') use the hosted
// visual-genai endpoints at https://ai.api.nvidia.com/v1/genai/{id}.
// NVIDIA retires models regularly — if replies stop coming, re-check the endpoint.

export interface AspectRatioOption {
  label: string; // shown in the UI chip row, e.g. '1:1'
  width: number;
  height: number;
}

// Discrete dimensions the hosted FLUX endpoint accepts (validated live —
// it rejects anything outside this 768…1344 set, so ratios use nearest fits).
export const FLUX_ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '1:1', width: 1024, height: 1024 },
  { label: '4:3', width: 1024, height: 768 },
  { label: '3:4', width: 768, height: 1024 },
  { label: '16:9', width: 1344, height: 768 },
  { label: '9:16', width: 768, height: 1344 },
];

export interface NimModel {
  id: string; // exact string sent to the NIM API "model" field / hosted path
  label: string; // shown in the UI
  description?: string;
  supportsReasoning?: boolean; // whether it may return `reasoning_content`
  kind?: 'chat' | 'image'; // defaults to 'chat'
  steps?: number; // image models: diffusion steps
  cfgScale?: number; // image models: guidance scale
  aspectRatios?: AspectRatioOption[]; // image models: selectable sizes
}

export const NIM_MODELS: NimModel[] = [
  {
    id: 'nvidia/nemotron-3.5-lightning-30b-a3b',
    label: 'Nemotron 3.5 Lightning 30B',
    description: 'Fast chat model, deep thinking disabled',
    supportsReasoning: false,
  },
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    label: 'Nemotron 3 Ultra 550B',
    description: 'Deep thinking model',
    supportsReasoning: true,
  },
];

export const DEFAULT_MODEL_ID = NIM_MODELS[0].id;

export function getModelById(id: string): NimModel | undefined {
  return NIM_MODELS.find((m) => m.id === id);
}
