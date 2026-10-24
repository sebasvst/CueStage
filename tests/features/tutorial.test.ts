import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  currentTutorialStep,
  isProjectReady,
  resolveTutorialSteps,
} from '../../src/features/tutorial/tutorialSteps';
import {
  autoButtonColor,
  autoButtonIcon,
  autoButtonName,
  buildAutoButton,
  nextFreeShortcut,
} from '../../src/features/projects/autoButton';
import { useProjectStore } from '../../src/stores/projectStore';
import { createEmptyProject } from '../../src/features/projects/projectFactory';
import type { AudioAsset } from '../../src/types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
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

function asset(id: string, name: string): AudioAsset {
  return {
    id,
    name,
    fileName: name,
    storage: 'embedded',
    relativePath: `assets/${name}`,
    absolutePath: `C:/demo/assets/${name}`,
    format: 'wav',
    durationSec: 2,
    sizeBytes: 1000,
    addedAt: new Date().toISOString(),
  };
}

describe('botón automático', () => {
  it('convierte el nombre del archivo en un nombre legible', () => {
    expect(autoButtonName('01 - Cancion de entrada.wav')).toBe('Cancion de entrada');
    expect(autoButtonName('pasos.wav')).toBe('Pasos');
    expect(autoButtonName('aplausos_final.mp3')).toBe('Aplausos final');
    expect(autoButtonName('.wav')).toBe('Sonido');
  });

  it('mantiene el mismo color y el mismo icono para el mismo archivo', () => {
    expect(autoButtonColor('musica.mp3')).toBe(autoButtonColor('musica.mp3'));
    expect(autoButtonIcon('musica.mp3')).toBe(autoButtonIcon('musica.mp3'));
    expect(autoButtonColor('musica.mp3')).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it('ofrece la primera tecla libre', () => {
    expect(nextFreeShortcut([])).toBe('Digit1');
    expect(
      nextFreeShortcut([
        {
          id: '1',
          name: 'A',
          assetId: null,
          color: '#E0562D',
          icon: 'zap',
          volume: 1,
          shortcut: 'Digit1',
          mode: 'once',
          enabled: true,
        },
      ]),
    ).toBe('Digit2');
  });

  it('crea el botón con los valores por defecto', () => {
    const button = buildAutoButton(asset('a1', 'aplausos.wav'), []);
    expect(button.name).toBe('Aplausos');
    expect(button.assetId).toBe('a1');
    expect(button.shortcut).toBe('Digit1');
    expect(button.mode).toBe('once');
    expect(button.volume).toBe(1);
  });
});

describe('botones automáticos en el proyecto', () => {
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
  });

  it('crea un botón por cada archivo importado', () => {
    useProjectStore.setState({ project: createEmptyProject('Prueba') });

    useProjectStore.getState().addAssetWithButton(asset('a1', 'pasos.wav'));
    useProjectStore.getState().addAssetWithButton(asset('a2', 'aplausos.wav'));

    const project = useProjectStore.getState().project;
    expect(project?.assets).toHaveLength(2);
    expect(project?.pads).toHaveLength(2);
    expect(project?.pads.map((pad) => pad.name)).toEqual(['Pasos', 'Aplausos']);
    expect(project?.pads.map((pad) => pad.shortcut)).toEqual(['Digit1', 'Digit2']);
  });

  it('asigna el primer archivo como música de fondo', () => {
    useProjectStore.setState({ project: createEmptyProject('Prueba') });

    useProjectStore.getState().addAssetWithButton(asset('a1', 'musica.mp3'));
    expect(useProjectStore.getState().project?.musicAssetId).toBe('a1');

    // El segundo archivo no cambia la música.
    useProjectStore.getState().addAssetWithButton(asset('a2', 'pasos.wav'));
    expect(useProjectStore.getState().project?.musicAssetId).toBe('a1');
  });

  it('no crea un segundo botón para el mismo archivo', () => {
    useProjectStore.setState({ project: createEmptyProject('Prueba') });
    useProjectStore.getState().addAssetWithButton(asset('a1', 'pasos.wav'));
    useProjectStore.getState().addAssetWithButton(asset('a1', 'pasos.wav'));

    expect(useProjectStore.getState().project?.pads).toHaveLength(1);
  });
});

describe('tutorial', () => {
  it('empieza por pedir los archivos', () => {
    const project = createEmptyProject('Prueba');
    const step = currentTutorialStep(project);
    expect(step.id).toBe('archivos');
    expect(step.index).toBe(1);
  });

  it('avanza solo a medida que el usuario prepara la presentación', () => {
    const project = createEmptyProject('Prueba');
    project.assets.push(asset('a1', 'musica.mp3'));
    expect(currentTutorialStep(project).id).toBe('musica');

    project.musicAssetId = 'a1';
    expect(currentTutorialStep(project).id).toBe('botones');

    project.pads.push({
      id: 'p1',
      name: 'Música',
      assetId: 'a1',
      color: '#E0562D',
      icon: 'zap',
      volume: 1,
      shortcut: 'Digit1',
      mode: 'once',
      enabled: true,
    });
    expect(currentTutorialStep(project).id).toBe('lista');

    project.cues.push({
      id: 'c1',
      name: 'Entrada',
      type: 'play-music',
      assetId: null,
      padId: null,
      notes: '',
      waitSec: 2,
      executed: false,
    });
    expect(currentTutorialStep(project).id).toBe('listo');
    expect(currentTutorialStep(project).title).toBe('¡Todo listo!');
  });

  it('marca los pasos completados', () => {
    const project = createEmptyProject('Prueba');
    project.assets.push(asset('a1', 'musica.mp3'));
    project.musicAssetId = 'a1';

    const steps = resolveTutorialSteps(project);
    expect(steps.find((step) => step.id === 'archivos')?.done).toBe(true);
    expect(steps.find((step) => step.id === 'musica')?.done).toBe(true);
    expect(steps.find((step) => step.id === 'botones')?.done).toBe(false);
  });

  it('considera la presentación lista cuando hay música y botones', () => {
    const project = createEmptyProject('Prueba');
    expect(isProjectReady(project)).toBe(false);

    project.assets.push(asset('a1', 'musica.mp3'));
    project.musicAssetId = 'a1';
    expect(isProjectReady(project)).toBe(false);

    project.pads.push({
      id: 'p1',
      name: 'Música',
      assetId: 'a1',
      color: '#E0562D',
      icon: 'zap',
      volume: 1,
      shortcut: null,
      mode: 'once',
      enabled: true,
    });
    expect(isProjectReady(project)).toBe(true);
  });
});
