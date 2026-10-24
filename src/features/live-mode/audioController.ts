import { getAudioEngine } from '../../audio/audioEngineInstance';
import type { AudioEngine } from '../../audio/AudioEngine';
import type { DecodedAudioBuffer } from '../../audio/AudioTypes';
import {
  getInMemoryFile,
  readAudioBytes,
} from '../../services/assetService';
import { isTauri } from '../../services/bridge';
import { useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import type { AudioAsset, ProjectMixerSettings, SoundPad } from '../../types';

/** Identifier used for the preview playback of the library. */
const PREVIEW_PAD_ID = '__preview__';

/** State of a trigger that is still decoding its file. */
interface PendingTrigger {
  cancelled: boolean;
}


/**
 * Bridges the interface, the current project and the audio engine.
 *
 * All the commands that can start or stop sound go through this controller,
 * so there is a single place where the "is this sound ready?" question is
 * answered before triggering a pad.
 */
class AudioController {
  private unsubscribe: (() => void) | null = null;
  private started = false;
  /** Triggers that are still decoding their file. */
  private readonly pendingTriggers = new Map<string, PendingTrigger>();
  /** True while the main music is being prepared. */
  private musicStarting = false;
  /** Preparation in progress, reused if it is asked for again. */
  private preparePromise: Promise<{ prepared: number; failed: number }> | null = null;
  /** Guards the preview so the last request always wins. */
  private previewToken = 0;

  /** The engine is resolved on every call so it can be replaced safely. */
  private get engine(): AudioEngine {
    return getAudioEngine();
  }

  async init(): Promise<void> {
    if (this.started) return;
    this.started = true;

    this.unsubscribe = this.engine.subscribe((event) => {
      const store = useAudioStore.getState();
      switch (event.type) {
        case 'status':
          store.setStatus(event.status, event.error);
          break;
        case 'music':
          store.setMusic(event.music);
          break;
        case 'pads':
          store.setPads(event.pads);
          store.setActiveEffectCount(Object.keys(event.pads).length);
          break;
        case 'error':
          store.setError(event.error);
          break;
      }
    });

    try {
      await this.engine.init();
    } catch {
      // The status is already published through the engine events.
    }
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.started = false;
  }

  /** Called from a user gesture so the browser allows audio output. */
  async ensureRunning(): Promise<boolean> {
    const running = await this.engine.ensureRunning();
    if (!running) {
      const status = this.engine.engineStatus;
      if (status === 'error') {
        useUiStore
          .getState()
          .pushToast(
            'El motor de audio no está disponible en este entorno.',
            'error',
          );
      }
    }
    return running;
  }

  applyMixer(mixer: ProjectMixerSettings): void {
    this.engine.setMusicVolume(mixer.musicVolume);
    this.engine.setSfxVolume(mixer.sfxVolume);
    this.engine.setMasterVolume(mixer.masterVolume);
  }

  /**
   * Routes the output to the chosen device.
   *
   * Returns `false` when the host does not support choosing the device, in
   * which case the system default is used.
   */
  async applyOutputDevice(deviceId: string | null): Promise<boolean> {
    await this.init();
    return this.engine.setOutputDevice(deviceId);
  }

  // ---------------------------------------------------------- preparation ---

  /** Decodes an asset and stores the PCM data in the engine cache. */
  async decodeAsset(asset: AudioAsset): Promise<DecodedAudioBuffer | null> {
    const cached = this.engine.getBuffer(asset.id);
    if (cached) return cached;

    const store = useAudioStore.getState();
    store.setPreparation(asset.id, { state: 'loading' });

    try {
      const bytes = await this.loadBytes(asset);
      const buffer = await this.engine.decode(asset.id, bytes);
      store.setPreparation(asset.id, { state: 'ready' });
      return buffer;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'No se pudo preparar el archivo.';
      store.setPreparation(asset.id, { state: 'error', error: message });
      return null;
    }
  }

  /**
   * Prepares every audio file of the presentation.
   *
   * The music goes first, then the sounds of the buttons and finally the rest,
   * so the most important files are ready the soonest. The decoding happens in
   * the background and does not block the interface. If a preparation is
   * already running, the same one is reused instead of decoding twice.
   */
  async prepareAll(): Promise<{ prepared: number; failed: number }> {
    if (this.preparePromise) return this.preparePromise;

    this.preparePromise = this.runPreparation().finally(() => {
      this.preparePromise = null;
    });
    return this.preparePromise;
  }

  private async runPreparation(): Promise<{ prepared: number; failed: number }> {
    const project = useProjectStore.getState().project;
    if (!project) return { prepared: 0, failed: 0 };

    const store = useAudioStore.getState();
    store.setPreparing(true);

    const targets: AudioAsset[] = [];
    const seen = new Set<string>();
    const push = (asset: AudioAsset | undefined) => {
      if (!asset || seen.has(asset.id)) return;
      seen.add(asset.id);
      targets.push(asset);
    };

    push(project.assets.find((asset) => asset.id === project.musicAssetId));
    for (const pad of project.pads) {
      push(project.assets.find((asset) => asset.id === pad.assetId));
    }
    for (const asset of project.assets) push(asset);

    let prepared = 0;
    let failed = 0;
    for (const asset of targets) {
      const buffer = await this.decodeAsset(asset);
      if (buffer) prepared += 1;
      else failed += 1;
    }

    useAudioStore.getState().setPreparing(false);
    return { prepared, failed };
  }

  private async loadBytes(asset: AudioAsset): Promise<ArrayBuffer> {
    if (isTauri()) {
      if (!asset.absolutePath) {
        throw new Error('El archivo no tiene una ruta asociada.');
      }
      return readAudioBytes(asset.absolutePath);
    }

    const file = getInMemoryFile(asset.id);
    if (!file) {
      throw new Error(
        'El archivo no está disponible. Vuelve a importarlo desde la biblioteca.',
      );
    }
    return file.arrayBuffer();
  }

  // -------------------------------------------------------------- playback ---

  async playMusic(): Promise<void> {
    const project = useProjectStore.getState().project;
    if (!project) return;
    if (!project.musicAssetId) {
      useUiStore.getState().pushToast('No hay música principal asignada.', 'warning');
      return;
    }
    const asset = project.assets.find((entry) => entry.id === project.musicAssetId);
    if (!asset) {
      useUiStore.getState().pushToast('El archivo de música no está disponible.', 'error');
      return;
    }

    // While the file is being prepared the music is already "starting":
    // a second click must not start a second copy on top of this one.
    if (this.musicStarting) return;
    this.musicStarting = true;
    const store = useAudioStore.getState();
    store.setMusic({ ...store.music, status: 'loading', assetId: asset.id });

    try {
      const buffer = await this.decodeAsset(asset);
      if (!buffer) {
        useUiStore
          .getState()
          .pushToast('No se pudo preparar la música principal.', 'error');
        const current = useAudioStore.getState();
        current.setMusic({ ...current.music, status: 'error' });
        return;
      }

      this.engine.playback.playMusic({
        assetId: asset.id,
        buffer,
        loop: project.playback.loopMusic,
        fadeInSec: project.playback.musicFadeInSec,
        fadeOutSec: project.playback.musicFadeOutSec,
      });
    } finally {
      this.musicStarting = false;
    }
  }

  pauseMusic(): void {
    this.musicStarting = false;
    this.engine.playback.pauseMusic();
  }

  resumeMusic(): void {
    this.musicStarting = false;
    this.engine.playback.resumeMusic();
  }

  stopMusic(): void {
    this.engine.playback.stopMusic();
  }

  seekMusic(seconds: number): void {
    this.engine.playback.seekMusic(seconds);
  }

  /**
   * Triggers a pad. Previous instances of the same pad are faded out first so
   * repeated presses never stack several sources.
   *
   * If the pad is already sounding, the press stops it: touching the same
   * button again is the way to pause it, without having to look for another
   * control. It works the same with the mouse and with the keyboard.
   */
  async triggerPad(pad: SoundPad): Promise<void> {
    const project = useProjectStore.getState().project;
    if (!project) return;
    if (!pad.assetId) {
      useUiStore.getState().pushToast(`«${pad.name}» no tiene archivo asignado.`, 'warning');
      return;
    }
    const asset = project.assets.find((entry) => entry.id === pad.assetId);
    if (!asset) {
      useUiStore.getState().pushToast(`El archivo de «${pad.name}» no está disponible.`, 'error');
      return;
    }

    // Second touch: the sound is paused.
    if (pad.mode !== 'hold' && this.engine.playback.isPadActive(pad.id)) {
      this.engine.playback.stopPad(pad.id, 0.03);
      return;
    }

    // While the file is being decoded the operator may already have released
    // the pad. This marker makes sure a sound that is no longer wanted does
    // not start playing afterwards.
    const pending: PendingTrigger = { cancelled: false };
    this.pendingTriggers.set(pad.id, pending);

    try {
      let buffer: DecodedAudioBuffer | null | undefined =
        this.engine.getBuffer(asset.id);
      if (!buffer) {
        useUiStore
          .getState()
          .pushToast(`Preparando «${pad.name}»…`, 'info');
        buffer = await this.decodeAsset(asset);
        if (!buffer) {
          useUiStore
            .getState()
            .pushToast(`No se pudo preparar «${pad.name}».`, 'error');
          return;
        }
      }

      if (pending.cancelled) return;

      this.engine.playback.triggerPad({
        padId: pad.id,
        assetId: asset.id,
        buffer,
        volume: pad.volume,
        mode: pad.mode === 'hold' ? 'loop' : pad.mode,
      });
    } finally {
      if (this.pendingTriggers.get(pad.id) === pending) {
        this.pendingTriggers.delete(pad.id);
      }
    }
  }

  stopPad(padId: string): void {
    const pending = this.pendingTriggers.get(padId);
    if (pending) {
      // The sound has not started yet: it must not start at all.
      pending.cancelled = true;
      return;
    }
    this.engine.playback.stopPad(padId);
  }

  /** Plays a library file so the operator can hear it before using it. */
  async previewAsset(asset: AudioAsset): Promise<void> {
    // If two previews overlap, only the last one may be heard.
    this.previewToken += 1;
    const token = this.previewToken;

    const buffer = await this.decodeAsset(asset);
    if (token !== this.previewToken) return;
    if (!buffer) {
      useUiStore
        .getState()
        .pushToast(`No se pudo reproducir «${asset.name}».`, 'error');
      return;
    }
    this.engine.playback.triggerPad({
      padId: PREVIEW_PAD_ID,
      assetId: asset.id,
      buffer,
      volume: 1,
      mode: 'once',
    });
  }

  stopPreview(): void {
    this.previewToken += 1;
    this.engine.playback.stopPad(PREVIEW_PAD_ID);
  }

  /** Emergency stop: silences the output and stops every CueStage source. */
  stopAll(): void {
    this.engine.stopAll();
  }

  getMusicPosition(): number {
    return this.engine.musicPosition;
  }
}

export const audioController = new AudioController();
