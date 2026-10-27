// Models available in the app. Every call goes through the Aurora backend so
// the NIM key stays server-side: chat models stream from POST /api/chat and
// image models (kind: 'image') are rendered by POST /api/images/generate.
// NVIDIA retires models regularly — if replies stop coming, re-check the endpoint.

export interface AspectRatioOption {
  label: string; // shown in the UI chip row, e.g. '1:1'
  width: number;
  height: number;
}

// Presets understood by the backend image route (server/src/ai/imagegen.ts).
// Keep the labels in sync with its IMAGE_SIZES keys — the label is the `size`
// sent with the request.
export const FLUX_ASPECT_RATIOS: AspectRatioOption[] = [
  { label: '1:1', width: 1024, height: 1024 },
  { label: '16:9', width: 1344, height: 768 },
  { label: '9:16', width: 768, height: 1344 },
];

export interface NimModel {
  id: string; // exact string sent to the NIM API "model" field / hosted path
  label: string; // shown in the UI
  description?: string;
  supportsReasoning?: boolean; // whether it may return `reasoning_content`
  vision?: boolean; // whether it can read image attachments
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
  {
    id: 'nvidia/nemotron-3.5-super-vl-120b-a12b',
    label: 'Nemotron Super VL 120B',
    description: 'Reads images, charts, and screenshots — fast',
    vision: true,
  },
  {
    id: 'minimaxai/minimax-m3.1-flash',
    label: 'MiniMax M3.1 Flash',
    description: 'Careful image understanding for complex scenes',
    supportsReasoning: true,
    vision: true,
  },
  {
    id: 'black-forest-labs/flux.1-dev',
    label: 'FLUX.1 Dev',
    description: 'Paints detailed, art-directed images from a prompt',
    kind: 'image',
    steps: 20,
    aspectRatios: FLUX_ASPECT_RATIOS,
  },
];

export const DEFAULT_MODEL_ID = NIM_MODELS[0].id;

export function getModelById(id: string): NimModel | undefined {
  return NIM_MODELS.find((m) => m.id === id);
}
