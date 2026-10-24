import { create } from 'zustand';
import type {
  EngineError,
  EngineStatus,
  MusicState,
  PadRuntimeState,
} from '../audio/AudioTypes';

export type PreparationState = 'idle' | 'loading' | 'ready' | 'error' | 'missing';

export interface PreparationEntry {
  state: PreparationState;
  error?: string;
}

/** How much of the show is already loaded in memory. */
export interface PreparationProgress {
  total: number;
  ready: number;
  loading: number;
  errors: number;
  /** True when everything is ready and nothing is being decoded. */
  complete: boolean;
}

/** Summarises the state of the preparation of the audio files. */
export function preparationProgress(
  preparation: Record<string, PreparationEntry>,
): PreparationProgress {
  const entries = Object.values(preparation);
  const ready = entries.filter((entry) => entry.state === 'ready').length;
  const loading = entries.filter((entry) => entry.state === 'loading').length;
  const errors = entries.filter((entry) => entry.state === 'error').length;
  return {
    total: entries.length,
    ready,
    loading,
    errors,
    complete: entries.length > 0 && loading === 0 && errors === 0,
  };
}

interface AudioState {
  status: EngineStatus;
  error: EngineError | null;
  music: MusicState;
  volumes: { music: number; sfx: number; master: number };
  pads: Record<string, PadRuntimeState>;
  activeEffectCount: number;
  preparation: Record<string, PreparationEntry>;
  preparing: boolean;
  setStatus: (status: EngineStatus, error: EngineError | null) => void;
  setError: (error: EngineError | null) => void;
  setMusic: (music: MusicState) => void;
  setVolumes: (volumes: { music: number; sfx: number; master: number }) => void;
  setPads: (pads: Record<string, PadRuntimeState>) => void;
  setActiveEffectCount: (count: number) => void;
  setPreparation: (assetId: string, entry: PreparationEntry) => void;
  setPreparing: (preparing: boolean) => void;
  resetPreparation: () => void;
}

const EMPTY_MUSIC: MusicState = {
  status: 'idle',
  assetId: null,
  currentTime: 0,
  duration: 0,
  error: null,
};

export const useAudioStore = create<AudioState>()((set) => ({
  status: 'uninitialized',
  error: null,
  music: EMPTY_MUSIC,
  volumes: { music: 1, sfx: 1, master: 1 },
  pads: {},
  activeEffectCount: 0,
  preparation: {},
  preparing: false,

  setStatus: (status, error) => set({ status, error }),
  setError: (error) => set({ error }),
  setMusic: (music) => set({ music }),
  setVolumes: (volumes) => set({ volumes }),
  setPads: (pads) => set({ pads }),
  setActiveEffectCount: (count) => set({ activeEffectCount: count }),
  setPreparation: (assetId, entry) =>
    set((state) => ({
      preparation: { ...state.preparation, [assetId]: entry },
    })),
  setPreparing: (preparing) => set({ preparing }),
  resetPreparation: () => set({ preparation: {}, preparing: false }),
}));
