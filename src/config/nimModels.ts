// Models available in the app. Chat models use the OpenAI-compatible
// /v1/chat/completions endpoint; image models (kind: 'image') use the hosted
// visual-genai endpoints at https://ai.api.nvidia.com/v1/genai/{id}.
// NVIDIA retires models regularly — if replies stop coming, re-check the endpoint.

export interface NimModel {
  id: string; // exact string sent to the NIM API "model" field / hosted path
  label: string; // shown in the UI
  description?: string;
  supportsReasoning?: boolean; // whether it may return `reasoning_content`
  kind?: 'chat' | 'image'; // defaults to 'chat'
  steps?: number; // image models: diffusion steps
  cfgScale?: number; // image models: guidance scale
}

export const NIM_MODELS: NimModel[] = [
  {
    id: 'nvidia/nemotron-3-ultra-550b-a55b',
    label: 'Nemotron 3 Ultra 550B',
    description: 'Largest Nemotron reasoning model',
    supportsReasoning: true,
  },
  {
    id: 'meta/muse-glimmer-30b',
    label: 'Muse Glimmer 30B',
    description: 'Multimodal reasoning, native tool-calling',
    supportsReasoning: true,
  },
  {
    id: 'deepseek-ai/deepseek-v4.1-flash',
    label: 'DeepSeek V4.1 Flash',
    description: 'Fast MoE for coding & agentic chat',
  },
  // Image generation — hosted visual-genai endpoints (dot naming, e.g.
  // flux.1-dev). Verified live: SD 3.5 / schnell are not served for this
  // account (404 / hang), FLUX.1 Dev is. FLUX rejects `aspect_ratio`.
  {
    id: 'black-forest-labs/flux.1-dev',
    label: 'FLUX.1 Dev',
    description: 'High-quality image generation (~8s)',
    kind: 'image',
    steps: 50,
    cfgScale: 5,
  },
];

export const DEFAULT_MODEL_ID = NIM_MODELS[0].id;

export function getModelById(id: string): NimModel | undefined {
  return NIM_MODELS.find((m) => m.id === id);
}
