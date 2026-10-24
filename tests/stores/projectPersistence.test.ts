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
    duplicate: vi.fn(async () => '{}'),
    remove: vi.fn(async () => undefined),
    projectsDirectory: vi.fn(async () => 'C:/projects'),
    projectDirectory: vi.fn(async () => 'C:/projects/demo'),
    importFiles: vi.fn(async () => []),
  },
}));

const mockedService = vi.mocked(projectService);
const mockedInvoke = vi.mocked(invoke);

describe('guardado del proyecto', () => {
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
    mockedService.duplicate.mockClear();
    mockedService.read.mockClear();
    mockedService.remove.mockClear();
    mockedInvoke.mockClear();
  });

  it('guarda los cambios pendientes antes de abrir otra presentación', async () => {
    const first = createEmptyProject('Primera');
    mockedService.read.mockResolvedValueOnce(first as unknown as CueStageProject);
    await useProjectStore.getState().openProject(first.id);

    useProjectStore.getState().mutate((draft) => {
      draft.name = 'Primera renombrada';
    });
    expect(useProjectStore.getState().dirty).toBe(true);

    const second = createEmptyProject('Segunda');
    mockedService.read.mockResolvedValueOnce(second as unknown as CueStageProject);
    await useProjectStore.getState().openProject(second.id);

    // La primera se guardó antes de cambiar.
    const written = mockedService.write.mock.calls.at(-1);
    expect(written?.[0].name).toBe('Primera renombrada');
    expect(useProjectStore.getState().project?.name).toBe('Segunda');
  });

  it('no marca como guardado si el proyecto cambió durante la escritura', async () => {
    await useProjectStore.getState().createProject('Prueba');

    let release: () => void = () => undefined;
    mockedService.write.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );

    const saving = useProjectStore.getState().save();
    // El usuario edita mientras se está escribiendo.
    useProjectStore.getState().mutate((draft) => {
      draft.name = 'Cambiada';
    });
    release();
    await saving;

    expect(useProjectStore.getState().dirty).toBe(true);
  });

  it('«Guardar como» copia el contenido actual, no el que hay en disco', async () => {    const project = createEmptyProject('Original');
    useProjectStore.setState({ project });

    useProjectStore.getState().mutate((draft) => {
      draft.name = 'Original editado';
    });

    const copy = { ...project, id: 'copia', name: 'Copia' };
    mockedService.duplicate.mockResolvedValueOnce(JSON.stringify(copy));

    await useProjectStore.getState().saveAs('Copia');

    // Se guardó el estado actual antes de duplicar.
    const written = mockedService.write.mock.calls.at(-1);
    expect(written?.[0].name).toBe('Copia');
    expect(mockedService.duplicate).toHaveBeenCalledTimes(1);
    // La copia es una presentación nueva, con su propio identificador.
    expect(useProjectStore.getState().project?.id).not.toBe(project.id);
    expect(useProjectStore.getState().project?.name).toBe('Copia');
  });

  it('elimina una presentación y sus copias', async () => {
    const project = createEmptyProject('Para borrar');
    useProjectStore.setState({ project });
    mockedService.read.mockResolvedValueOnce(project as unknown as CueStageProject);

    await useProjectStore.getState().removeProject(project.id);

    expect(mockedService.remove).toHaveBeenCalledWith(project.id);
    // La presentación abierta se cierra antes de borrarla.
    expect(useProjectStore.getState().project).toBeNull();
  });

  it('elimina una presentación que no está abierta', async () => {
    useProjectStore.setState({ project: null });

    await useProjectStore.getState().removeProject('otro');

    expect(mockedService.remove).toHaveBeenCalledWith('otro');
  });
});
