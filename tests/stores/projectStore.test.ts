import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { projectService } from '../../src/services/projectService';
import { useProjectStore } from '../../src/stores/projectStore';
import { createEmptyProject } from '../../src/features/projects/projectFactory';
import type { CueStageProject } from '../../src/types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('../../src/services/bridge', () => ({
  isTauri: () => true,
  isDesktopRuntime: () => true,
}));

vi.mock('../../src/services/projectService', () => ({
  projectService: {
    list: vi.fn(async () => []),
    read: vi.fn(async () => null),
    write: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    projectsDirectory: vi.fn(async () => 'C:/projects'),
    projectDirectory: vi.fn(async () => 'C:/projects/demo'),
    importFiles: vi.fn(async () => []),
  },
}));

const mockedService = vi.mocked(projectService);
const mockedInvoke = vi.mocked(invoke);

describe('project store', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: null,
      dirty: false,
      saving: false,
      error: null,
      lastSavedAt: null,
      recentProjects: [],
      missingAssetIds: [],
    });
    mockedService.write.mockClear();
    mockedService.read.mockClear();
    mockedInvoke.mockClear();
  });

  it('creates a project and stores it on disk', async () => {
    const project = await useProjectStore.getState().createProject('Mimos de Francia');

    expect(project.name).toBe('Mimos de Francia');
    expect(project.pads).toEqual([]);
    expect(mockedService.write).toHaveBeenCalledTimes(1);
    expect(useProjectStore.getState().project?.id).toBe(project.id);
  });

  it('saves the project and clears the pending flag', async () => {
    await useProjectStore.getState().createProject('Test');
    useProjectStore.getState().updatePad('missing', { name: 'x' });

    useProjectStore.setState({ dirty: true });
    await useProjectStore.getState().save();

    expect(mockedService.write).toHaveBeenCalledTimes(2);
    expect(useProjectStore.getState().dirty).toBe(false);
  });

  it('opens a project that was saved before', async () => {
    const stored = createEmptyProject('Guardado');
    mockedService.read.mockResolvedValueOnce(stored as unknown as CueStageProject);

    const ok = await useProjectStore.getState().openProject(stored.id);

    expect(ok).toBe(true);
    expect(useProjectStore.getState().project?.name).toBe('Guardado');
  });

  it('reports an error when the project does not exist', async () => {
    mockedService.read.mockResolvedValueOnce(null);
    const ok = await useProjectStore.getState().openProject('missing');
    expect(ok).toBe(false);
    expect(useProjectStore.getState().error).toMatch(/no se encontró/i);
  });

  it('refuses to open a project written by a newer format', async () => {
    const stored = { ...createEmptyProject('Futuro'), formatVersion: 42 };
    mockedService.read.mockResolvedValueOnce(stored as unknown as CueStageProject);

    const ok = await useProjectStore.getState().openProject('futuro');

    expect(ok).toBe(false);
    expect(useProjectStore.getState().error).toMatch(/versión más reciente/i);
  });

  it('detects the assets that are missing on disk', async () => {
    const project = createEmptyProject('Con archivos');
    project.assets = [
      {
        id: 'a1',
        name: 'musica.mp3',
        fileName: 'musica.mp3',
        storage: 'embedded',
        relativePath: 'assets/musica.mp3',
        absolutePath: 'C:/projects/demo/assets/musica.mp3',
        format: 'mp3',
        durationSec: 120,
        sizeBytes: 1024,
        addedAt: new Date().toISOString(),
      },
      {
        id: 'a2',
        name: 'paso.wav',
        fileName: 'paso.wav',
        storage: 'embedded',
        relativePath: 'assets/paso.wav',
        absolutePath: 'C:/projects/demo/assets/paso.wav',
        format: 'wav',
        durationSec: 1,
        sizeBytes: 2048,
        addedAt: new Date().toISOString(),
      },
    ];
    mockedService.read.mockResolvedValueOnce(project as unknown as CueStageProject);
    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === 'file_info') {
        return { exists: true };
      }
      return undefined;
    });

    await useProjectStore.getState().openProject(project.id);
    expect(useProjectStore.getState().missingAssetIds).toEqual([]);

    mockedInvoke.mockImplementation(async (command: string) => {
      if (command === 'file_info') {
        return { exists: false };
      }
      return undefined;
    });
    await useProjectStore.getState().verifyAssets();
    expect(useProjectStore.getState().missingAssetIds).toEqual(['a1', 'a2']);
  });

  it('keeps the pad configuration when an asset is removed', async () => {
    const project = createEmptyProject('Pads');
    project.pads = [
      {
        id: 'pad-1',
        name: 'Paso',
        assetId: 'a1',
        color: '#E0562D',
        icon: 'zap',
        volume: 1,
        shortcut: 'Digit1',
        mode: 'once',
        enabled: true,
      },
    ];
    project.assets = [
      {
        id: 'a1',
        name: 'paso.wav',
        fileName: 'paso.wav',
        storage: 'embedded',
        relativePath: 'assets/paso.wav',
        absolutePath: 'C:/x/paso.wav',
        format: 'wav',
        durationSec: 1,
        sizeBytes: 1,
        addedAt: new Date().toISOString(),
      },
    ];
    useProjectStore.setState({ project });

    useProjectStore.getState().removeAsset('a1');

    const current = useProjectStore.getState().project;
    expect(current?.assets).toHaveLength(0);
    // The pad survives, only its file reference is cleared.
    expect(current?.pads).toHaveLength(1);
    expect(current?.pads[0]?.assetId).toBeNull();
  });

  it('reorders the pads and the cues', async () => {
    const project = createEmptyProject('Orden');
    project.pads = [
      {
        id: 'p1',
        name: 'A',
        assetId: null,
        color: '#E0562D',
        icon: 'zap',
        volume: 1,
        shortcut: null,
        mode: 'once',
        enabled: true,
      },
      {
        id: 'p2',
        name: 'B',
        assetId: null,
        color: '#E0562D',
        icon: 'zap',
        volume: 1,
        shortcut: null,
        mode: 'once',
        enabled: true,
      },
    ];
    useProjectStore.setState({ project });

    useProjectStore.getState().movePad('p1', 1);
    expect(useProjectStore.getState().project?.pads.map((pad) => pad.id)).toEqual([
      'p2',
      'p1',
    ]);
  });

  it('releases the project when it is closed', async () => {
    await useProjectStore.getState().createProject('Temporal');
    await useProjectStore.getState().closeProject();

    expect(useProjectStore.getState().project).toBeNull();
    expect(useProjectStore.getState().dirty).toBe(false);
  });

  it('saves the pending changes when a project is closed', async () => {
    await useProjectStore.getState().createProject('Temporal');
    useProjectStore.setState({ dirty: true });
    await useProjectStore.getState().closeProject();

    expect(mockedService.write).toHaveBeenCalledTimes(2);
  });
});
