import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '../services/bridge';
import { projectService } from '../services/projectService';
import { createEmptyProject, createCue, createPad } from '../features/projects/projectFactory';
import { buildAutoButton } from '../features/projects/autoButton';
import { migrateProject } from '../features/projects/projectSchema';
import { createUuid } from '../utils/id';
import type {
  AudioAsset,
  Cue,
  CueStageProject,
  ProjectSummary,
  SoundPad,
} from '../types';

const AUTO_SAVE_DELAY_MS = 900;

interface ProjectState {
  project: CueStageProject | null;
  dirty: boolean;
  saving: boolean;
  error: string | null;
  lastSavedAt: string | null;
  recentProjects: ProjectSummary[];
  missingAssetIds: string[];

  refreshRecent: () => Promise<void>;
  createProject: (name: string) => Promise<CueStageProject>;
  openProject: (id: string) => Promise<boolean>;
  save: () => Promise<void>;
  saveAs: (name: string) => Promise<void>;
  closeProject: () => Promise<void>;
  /** Deletes a presentation and its copied resources. */
  removeProject: (id: string) => Promise<void>;
  mutate: (recipe: (draft: CueStageProject) => void) => void;
  setError: (message: string | null) => void;

  /**
   * Adds a file together with its sound button.
   *
   * The button is created automatically so nobody has to build it by hand.
   * If it is the first file of the project it also becomes the main music.
   */
  addAssetWithButton: (asset: AudioAsset) => void;
  removeAsset: (assetId: string) => void;
  setMusicAsset: (assetId: string | null) => void;

  addPad: (pad?: Partial<SoundPad>) => SoundPad;
  updatePad: (padId: string, changes: Partial<SoundPad>) => void;
  removePad: (padId: string) => void;
  duplicatePad: (padId: string) => void;
  movePad: (padId: string, direction: -1 | 1) => void;

  addCue: (cue?: Partial<Cue>) => Cue;
  updateCue: (cueId: string, changes: Partial<Cue>) => void;
  removeCue: (cueId: string) => void;
  moveCue: (cueId: string, direction: -1 | 1) => void;
  markCueExecuted: (cueId: string, executed: boolean) => void;
  resetCues: () => void;

  verifyAssets: () => Promise<void>;
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Number of changes applied to the open project.
 *
 * It allows `save()` to know whether the project changed while the write was
 * in flight, so a pending change is never marked as saved.
 */
let revision = 0;

function cloneProject(project: CueStageProject): CueStageProject {
  return structuredClone(project);
}

export const useProjectStore = create<ProjectState>()((set, get) => {
  const scheduleAutoSave = () => {
    if (autoSaveTimer !== null) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = null;
      void get().save();
    }, AUTO_SAVE_DELAY_MS);
  };

  const mutate = (recipe: (draft: CueStageProject) => void) => {
    const current = get().project;
    if (!current) return;
    const draft = cloneProject(current);
    recipe(draft);
    draft.updatedAt = new Date().toISOString();
    revision += 1;
    set({ project: draft, dirty: true });
    scheduleAutoSave();
  };

  return {
    project: null,
    dirty: false,
    saving: false,
    error: null,
    lastSavedAt: null,
    recentProjects: [],
    missingAssetIds: [],

    refreshRecent: async () => {
      try {
        const recent = await projectService.list();
        set({ recentProjects: recent });
      } catch (error) {
        set({ error: describe(error) });
      }
    },

    createProject: async (name) => {
      const project = createEmptyProject(name);
      await projectService.write(project);
      revision += 1;
      set({
        project,
        dirty: false,
        saving: false,
        error: null,
        lastSavedAt: new Date().toISOString(),
        missingAssetIds: [],
      });
      await get().refreshRecent();
      return project;
    },

    openProject: async (id) => {
      // Los cambios pendientes de la presentación actual se guardan antes de
      // abrir otra: si no, se perdían.
      if (get().dirty) {
        await get().save();
      }
      try {
        const raw = await projectService.read(id);
        if (!raw) {
          set({ error: 'No se encontró el proyecto solicitado.' });
          return false;
        }
        const project = migrateProject(raw);
        revision += 1;
        set({
          project,
          dirty: false,
          error: null,
          lastSavedAt: project.updatedAt,
          missingAssetIds: [],
        });
        await get().verifyAssets();
        return true;
      } catch (error) {
        set({ error: describe(error) });
        return false;
      }
    },

    save: async () => {
      const project = get().project;
      if (!project) return;
      if (autoSaveTimer !== null) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
      }
      const savedRevision = revision;
      set({ saving: true });
      try {
        await projectService.write(project);
        // Si el proyecto ha cambiado durante la escritura, los cambios
        // pendientes siguen sin guardar.
        const stillDirty = revision !== savedRevision;
        set({
          saving: false,
          dirty: stillDirty,
          lastSavedAt: new Date().toISOString(),
        });
        if (stillDirty) scheduleAutoSave();
        void get().refreshRecent();
      } catch (error) {
        set({ saving: false, error: describe(error) });
      }
    },

    saveAs: async (name) => {
      const project = get().project;
      if (!project) return;
      try {
        // Se guarda primero el estado actual: si no, la copia saldría con el
        // contenido que hay en disco y se perderían los cambios pendientes.
        await get().save();

        const newId = createUuid();
        const contents = await projectService.duplicate(project.id, newId);
        const copy = migrateProject(JSON.parse(contents) as unknown);
        copy.id = newId;
        copy.name = name.trim() || copy.name;
        copy.createdAt = new Date().toISOString();
        copy.updatedAt = copy.createdAt;
        await projectService.write(copy);
        revision += 1;
        set({
          project: copy,
          dirty: false,
          lastSavedAt: copy.updatedAt,
          missingAssetIds: [],
        });
        await get().refreshRecent();
      } catch (error) {
        set({ error: describe(error) });
      }
    },

    closeProject: async () => {
      if (autoSaveTimer !== null) {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = null;
      }
      if (get().dirty) await get().save();
      set({ project: null, dirty: false, missingAssetIds: [], error: null });
    },

    removeProject: async (id) => {
      // If it is the open project, it is closed first so nothing keeps
      // pointing at the deleted files.
      if (get().project?.id === id) {
        await get().closeProject();
      }
      await projectService.remove(id);
      set({ recentProjects: get().recentProjects.filter((item) => item.id !== id) });
    },

    mutate,

    setError: (message) => set({ error: message }),

    addAssetWithButton: (asset) =>
      mutate((draft) => {
        draft.assets = [...draft.assets, asset];

        // The first file of an empty project becomes the main music.
        const isFirstFile = draft.assets.length === 1;
        if (isFirstFile && !draft.musicAssetId) {
          draft.musicAssetId = asset.id;
        }

        // A file that already has a button does not need a second one.
        const alreadyHasButton = draft.pads.some(
          (pad) => pad.assetId === asset.id,
        );
        if (alreadyHasButton) return;

        draft.pads = [
          ...draft.pads,
          { id: createUuid(), ...buildAutoButton(asset, draft.pads) },
        ];
      }),

    removeAsset: (assetId) =>
      mutate((draft) => {
        draft.assets = draft.assets.filter((asset) => asset.id !== assetId);
        if (draft.musicAssetId === assetId) draft.musicAssetId = null;
        for (const pad of draft.pads) {
          if (pad.assetId === assetId) pad.assetId = null;
        }
        for (const cue of draft.cues) {
          if (cue.assetId === assetId) cue.assetId = null;
        }
      }),

    setMusicAsset: (assetId) =>
      mutate((draft) => {
        draft.musicAssetId = assetId;
      }),

    addPad: (partial) => {
      const pad = createPad(partial);
      mutate((draft) => {
        draft.pads = [...draft.pads, pad];
      });
      return pad;
    },

    updatePad: (padId, changes) =>
      mutate((draft) => {
        draft.pads = draft.pads.map((pad) =>
          pad.id === padId ? { ...pad, ...changes } : pad,
        );
      }),

    removePad: (padId) =>
      mutate((draft) => {
        draft.pads = draft.pads.filter((pad) => pad.id !== padId);
        for (const cue of draft.cues) {
          if (cue.padId === padId) cue.padId = null;
        }
      }),

    duplicatePad: (padId) =>
      mutate((draft) => {
        const index = draft.pads.findIndex((pad) => pad.id === padId);
        if (index < 0) return;
        const source = draft.pads[index];
        if (!source) return;
        const copy = createPad({
          ...source,
          id: undefined,
          name: `${source.name} (copia)`,
          shortcut: null,
        });
        draft.pads = [
          ...draft.pads.slice(0, index + 1),
          copy,
          ...draft.pads.slice(index + 1),
        ];
      }),

    movePad: (padId, direction) =>
      mutate((draft) => {
        const index = draft.pads.findIndex((pad) => pad.id === padId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= draft.pads.length) return;
        const pads = [...draft.pads];
        const [item] = pads.splice(index, 1);
        if (!item) return;
        pads.splice(target, 0, item);
        draft.pads = pads;
      }),

    addCue: (partial) => {
      const cue = createCue(partial);
      mutate((draft) => {
        draft.cues = [...draft.cues, cue];
      });
      return cue;
    },

    updateCue: (cueId, changes) =>
      mutate((draft) => {
        draft.cues = draft.cues.map((cue) =>
          cue.id === cueId ? { ...cue, ...changes } : cue,
        );
      }),

    removeCue: (cueId) =>
      mutate((draft) => {
        draft.cues = draft.cues.filter((cue) => cue.id !== cueId);
      }),

    moveCue: (cueId, direction) =>
      mutate((draft) => {
        const index = draft.cues.findIndex((cue) => cue.id === cueId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= draft.cues.length) return;
        const cues = [...draft.cues];
        const [item] = cues.splice(index, 1);
        if (!item) return;
        cues.splice(target, 0, item);
        draft.cues = cues;
      }),

    markCueExecuted: (cueId, executed) =>
      mutate((draft) => {
        draft.cues = draft.cues.map((cue) =>
          cue.id === cueId ? { ...cue, executed } : cue,
        );
      }),

    resetCues: () =>
      mutate((draft) => {
        draft.cues = draft.cues.map((cue) => ({ ...cue, executed: false }));
      }),

    verifyAssets: async () => {
      const project = get().project;
      if (!project || !isTauri()) {
        set({ missingAssetIds: [] });
        return;
      }
      const missing: string[] = [];
      for (const asset of project.assets) {
        if (!asset.absolutePath) {
          missing.push(asset.id);
          continue;
        }
        try {
          const info = await invoke<{ exists: boolean }>('file_info', {
            path: asset.absolutePath,
          });
          if (!info.exists) missing.push(asset.id);
        } catch {
          missing.push(asset.id);
        }
      }
      set({ missingAssetIds: missing });
    },
  };
});

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Se produjo un error inesperado.';
}

// While developing, the store is reachable from the browser console. The
// guard is removed from the production bundle at build time.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as { __cuestageProject?: unknown }).__cuestageProject =
    useProjectStore;
}
