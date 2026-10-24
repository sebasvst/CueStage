import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AudioEngine } from '../../src/audio/AudioEngine';
import { setAudioEngine } from '../../src/audio/audioEngineInstance';
import { audioController } from '../../src/features/live-mode/audioController';
import { LiveSection } from '../../src/features/live-mode/LiveSection';
import { useProjectStore } from '../../src/stores/projectStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useUiStore } from '../../src/stores/uiStore';
import { useAudioStore } from '../../src/stores/audioStore';
import { registerInMemoryFile } from '../../src/services/assetService';
import { FakeAudioContext } from '../fakes/FakeAudioContext';
import type { CueStageProject } from '../../src/types';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    setTitle: vi.fn(async () => undefined),
    setFullscreen: vi.fn(async () => undefined),
  }),
}));

function buildProject(): CueStageProject {
  const now = new Date().toISOString();
  return {
    formatVersion: 1,
    id: 'project-1',
    name: 'Mimos de Francia',
    createdAt: now,
    updatedAt: now,
    musicAssetId: 'music-1',
    assets: [
      {
        id: 'music-1',
        name: 'musica.mp3',
        fileName: 'musica.mp3',
        storage: 'embedded',
        relativePath: 'assets/musica.mp3',
        absolutePath: 'C:/demo/assets/musica.mp3',
        format: 'mp3',
        durationSec: 120,
        sizeBytes: 4096,
        addedAt: now,
      },
      {
        id: 'sfx-1',
        name: 'pasos.wav',
        fileName: 'pasos.wav',
        storage: 'embedded',
        relativePath: 'assets/pasos.wav',
        absolutePath: 'C:/demo/assets/pasos.wav',
        format: 'wav',
        durationSec: 1,
        sizeBytes: 512,
        addedAt: now,
      },
    ],
    pads: [
      {
        id: 'pad-1',
        name: 'Caminata',
        assetId: 'sfx-1',
        color: '#E0562D',
        icon: 'footprints',
        volume: 1,
        shortcut: 'Digit1',
        mode: 'once',
        enabled: true,
      },
    ],
    cues: [
      {
        id: 'cue-1',
        name: 'Entrada',
        type: 'play-music',
        assetId: null,
        padId: null,
        notes: '',
        waitSec: 2,
        executed: false,
      },
      {
        id: 'cue-2',
        name: 'Caminata',
        type: 'play-pad',
        assetId: null,
        padId: 'pad-1',
        notes: '',
        waitSec: 2,
        executed: false,
      },
    ],
    mixer: { musicVolume: 0.9, sfxVolume: 1, masterVolume: 1 },
    playback: {
      loopMusic: false,
      musicFadeInSec: 0,
      musicFadeOutSec: 0,
      stopMusicAtEnd: false,
      autoAdvance: false,
    },
    theme: 'system',
  };
}

describe('Live mode', () => {
  let context: FakeAudioContext;
  let engine: AudioEngine;

  beforeEach(async () => {
    context = new FakeAudioContext({ bufferDuration: 30 });
    engine = new AudioEngine(() => context);
    setAudioEngine(engine);

    audioController.dispose();
    await audioController.init();

    // Pre-decode the assets so the pads respond instantly.
    await engine.decode('music-1', new ArrayBuffer(8));
    await engine.decode('sfx-1', new ArrayBuffer(8));

    useProjectStore.setState({
      project: buildProject(),
      dirty: false,
      saving: false,
      error: null,
      lastSavedAt: null,
      recentProjects: [],
      missingAssetIds: [],
    });
    useUiStore.setState({ section: 'en-vivo', presentationMode: false, toasts: [] });
    useAudioStore.setState({
      status: 'ready',
      error: null,
      music: {
        status: 'idle',
        assetId: null,
        currentTime: 0,
        duration: 0,
        error: null,
      },
      volumes: { music: 1, sfx: 1, master: 1 },
      pads: {},
      activeEffectCount: 0,
      preparation: {},
      preparing: false,
    });
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        globalBindings: {
          'toggle-music': 'Space',
          'stop-all': 'Escape',
          'next-cue': 'ArrowRight',
          'previous-cue': 'ArrowLeft',
          'toggle-presentation': 'F11',
        },
      },
    });
  });

  it('shows the project and its pads', () => {
    render(<LiveSection />);
    expect(screen.getByText('Mimos de Francia')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reproducir Caminata/i })).toBeTruthy();
  });

  it('triggers an effect when a pad is pressed', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    await user.click(screen.getByRole('button', { name: /Reproducir Caminata/i }));

    await waitFor(() => {
      expect(engine.playback.getActiveEffectCount()).toBe(1);
    });
  });

  it('triggers an effect with the keyboard when the pad has the focus', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    const pad = screen.getByRole('button', { name: /Reproducir Caminata/i });
    pad.focus();
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(engine.playback.getActiveEffectCount()).toBe(1);
    });
  });

  it('stops every source with the emergency button', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    await user.click(screen.getByRole('button', { name: /Reproducir Caminata/i }));
    await waitFor(() => expect(engine.playback.getActiveEffectCount()).toBe(1));

    await user.click(screen.getByRole('button', { name: /Detener todo/i }));

    await waitFor(() => {
      expect(engine.playback.getActiveEffectCount()).toBe(0);
    });
    expect(engine.playback.getMusicState().status).toBe('idle');
  });

  it('toggles the music with the space bar', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    await user.keyboard(' ');
    await waitFor(() => {
      expect(engine.playback.getMusicState().status).toBe('playing');
    });

    await user.keyboard(' ');
    await waitFor(() => {
      expect(engine.playback.getMusicState().status).toBe('paused');
    });
  });

  it('stops everything with the escape key', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    await user.keyboard('1');
    await waitFor(() => expect(engine.playback.getActiveEffectCount()).toBe(1));

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(engine.playback.getActiveEffectCount()).toBe(0);
    });
  });

  it('ignores the shortcuts while the operator is typing', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <input aria-label="notes" />
        <LiveSection />
      </div>,
    );

    const input = screen.getByLabelText('notes');
    await user.click(input);
    await user.keyboard('1');

    expect(engine.playback.getActiveEffectCount()).toBe(0);
  });

  it('pauses the sound when the same button is touched again', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    const pad = screen.getByRole('button', { name: /Reproducir Caminata/i });

    await user.click(pad);
    await waitFor(() => {
      expect(engine.playback.isPadActive('pad-1')).toBe(true);
    });

    // El segundo toque para el sonido.
    await user.click(pad);
    await waitFor(() => {
      expect(engine.playback.isPadActive('pad-1')).toBe(false);
    });
    expect(engine.playback.getActiveEffectCount()).toBe(0);
  });

  it('pauses the sound with its key, without touching the mouse', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    await user.keyboard('1');
    await waitFor(() => {
      expect(engine.playback.isPadActive('pad-1')).toBe(true);
    });

    await user.keyboard('1');
    await waitFor(() => {
      expect(engine.playback.isPadActive('pad-1')).toBe(false);
    });
  });

  it('keeps the keyboard working after moving a volume slider', async () => {
    const user = userEvent.setup();
    const { container } = render(<LiveSection />);

    // El deslizador de volumen se queda con el foco al arrastrarlo.
    const slider = container.querySelector(
      '.live__volumes input[type="range"]',
    ) as HTMLInputElement;
    expect(slider).toBeTruthy();
    slider.focus();
    expect(document.activeElement).toBe(slider);

    // Aun con el deslizador enfocado, el atajo del botón debe funcionar.
    await user.keyboard('1');
    await waitFor(() => {
      expect(engine.playback.isPadActive('pad-1')).toBe(true);
    });
  });

  it('leaves the arrow keys to the focused slider', async () => {
    const user = userEvent.setup();
    const { container } = render(<LiveSection />);

    const slider = container.querySelector(
      '.live__volumes input[type="range"]',
    ) as HTMLInputElement;
    slider.focus();

    await user.keyboard('{ArrowRight}');
    // La flecha ajusta el deslizador y no dispara ningún atajo.
    expect(engine.playback.isPadActive('pad-1')).toBe(false);
    expect(Number(slider.value)).toBeGreaterThan(0);
  });

  it('does not start the music twice when the button is pressed quickly', async () => {
    // El botón se puede pulsar varias veces seguidas: solo debe sonar una copia.
    await Promise.all([
      audioController.playMusic(),
      audioController.playMusic(),
      audioController.playMusic(),
    ]);

    expect(engine.playback.getMusicState().status).toBe('playing');
    const playing = context.sources.filter((source) => source.started && !source.ended);
    expect(playing).toHaveLength(1);
  });

  it('pauses and resumes the music from the same position', async () => {
    const user = userEvent.setup();
    const { container } = render(<LiveSection />);

    const play = container.querySelector('.transport__play') as HTMLButtonElement;
    await user.click(play);
    await waitFor(() => {
      expect(engine.playback.getMusicState().status).toBe('playing');
    });

    context.advance(2);
    await user.click(play);
    expect(engine.playback.getMusicState().status).toBe('paused');
    expect(engine.playback.getMusicPosition()).toBeCloseTo(2, 1);

    await user.click(play);
    expect(engine.playback.getMusicState().status).toBe('playing');

    context.advance(1);
    expect(engine.playback.getMusicPosition()).toBeCloseTo(3, 1);
  });

  it('does not repeat the shortcut when the key is held down', async () => {
    render(<LiveSection />);

    const event = new KeyboardEvent('keydown', {
      code: 'Digit1',
      key: '1',
      repeat: true,
      bubbles: true,
    });
    await act(async () => {
      window.dispatchEvent(event);
    });

    expect(engine.playback.getActiveEffectCount()).toBe(0);
  });

  it('does not leave a held sound playing when it is released before loading', async () => {
    // El archivo todavía se está decodificando cuando el operador suelta el
    // botón: el sonido no debe empezar después.
    registerInMemoryFile(
      'sfx-hold',
      new File([new Uint8Array(16)], 'lento.wav', { type: 'audio/wav' }),
    );

    const project = useProjectStore.getState().project;
    expect(project).not.toBeNull();
    useProjectStore.setState({
      project: {
        ...project!,
        assets: [
          ...project!.assets,
          {
            id: 'sfx-hold',
            name: 'lento.wav',
            fileName: 'lento.wav',
            storage: 'external',
            relativePath: null,
            absolutePath: 'lento.wav',
            format: 'wav',
            durationSec: 1,
            sizeBytes: 16,
            addedAt: new Date().toISOString(),
          },
        ],
        pads: [
          ...project!.pads,
          {
            id: 'pad-hold',
            name: 'Mantener',
            assetId: 'sfx-hold',
            color: '#E0562D',
            icon: 'zap',
            volume: 1,
            shortcut: null,
            mode: 'hold',
            enabled: true,
          },
        ],
      },
    });

    const pad = useProjectStore
      .getState()
      .project!.pads.find((entry) => entry.id === 'pad-hold')!;

    const triggering = audioController.triggerPad(pad);
    audioController.stopPad('pad-hold');
    await triggering;

    await waitFor(() => {
      expect(engine.playback.getActiveEffectCount()).toBe(0);
    });
    expect(engine.playback.isPadActive('pad-hold')).toBe(false);
  });

  it('runs the cues of the script manually', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    await user.click(screen.getByRole('button', { name: /Entrada/ }));
    await waitFor(() => {
      expect(engine.playback.getMusicState().status).toBe('playing');
    });

    // The automatic advance is disabled, so the next cue is not executed.
    expect(engine.playback.getActiveEffectCount()).toBe(0);
  });

  it('cancels a pending automatic sequence with the emergency stop', async () => {
    const project = buildProject();
    project.playback.autoAdvance = true;
    useProjectStore.setState({ project });

    const user = userEvent.setup();
    render(<LiveSection />);

    await user.click(screen.getByRole('button', { name: /Entrada/ }));
    await waitFor(() => {
      expect(engine.playback.getMusicState().status).toBe('playing');
    });

    // The automatic advance would trigger the second cue.
    await user.click(screen.getByRole('button', { name: /Detener todo/i }));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(engine.playback.getActiveEffectCount()).toBe(0);
  });

  it('keeps the engine alive when the appearance changes', async () => {
    const user = userEvent.setup();
    render(<LiveSection />);

    await user.click(screen.getByRole('button', { name: /Reproducir Caminata/i }));
    await waitFor(() => expect(engine.playback.getActiveEffectCount()).toBe(1));

    const settings = useSettingsStore.getState();
    act(() => {
      useSettingsStore.setState({
        settings: { ...settings.settings, theme: 'dark' },
      });
    });

    expect(useAudioStore.getState().status).toBe('ready');
    expect(engine.playback.getActiveEffectCount()).toBe(1);
  });
});
