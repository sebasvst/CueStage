import { useEffect } from 'react';
import { ToastStack } from './components/common/ToastStack';
import { NavRail } from './app/NavRail';
import { useVisualPreferences, useWindowTitle } from './app/useShellEffects';
import { HomeSection } from './features/home/HomeSection';
import { StudioSection } from './features/studio/StudioSection';
import { LiveSection } from './features/live-mode/LiveSection';
import { SettingsSection } from './features/settings/SettingsSection';
import { audioController } from './features/live-mode/audioController';
import { useAudioStore } from './stores/audioStore';
import { useProjectStore } from './stores/projectStore';
import { useSettingsStore } from './stores/settingsStore';
import { useUiStore } from './stores/uiStore';

/**
 * Makes sure the audio engine is running.
 *
 * Browsers keep an AudioContext suspended until the user interacts with the
 * page, so the first gesture of the operator activates the sound.
 */
function useAudioActivation(): void {
  const status = useAudioStore((state) => state.status);

  useEffect(() => {
    void audioController.init();
  }, []);

  useEffect(() => {
    if (status === 'ready') return;

    const activate = () => {
      void audioController.ensureRunning();
    };

    window.addEventListener('pointerdown', activate, { passive: true });
    window.addEventListener('keydown', activate);
    return () => {
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
    };
  }, [status]);
}

/** Applies the mixer of the open project to the engine. */
function useProjectMixer(): void {
  const project = useProjectStore((state) => state.project);
  const musicVolume = project?.mixer.musicVolume;
  const sfxVolume = project?.mixer.sfxVolume;
  const masterVolume = project?.mixer.masterVolume;

  useEffect(() => {
    if (musicVolume === undefined || sfxVolume === undefined || masterVolume === undefined) {
      return;
    }
    audioController.applyMixer({
      musicVolume,
      sfxVolume,
      masterVolume,
    });
  }, [musicVolume, sfxVolume, masterVolume]);
}

/** Prepares the audio of the project that has just been opened. */
function useProjectPreparation(): void {
  const projectId = useProjectStore((state) => state.project?.id);
  const preloadEffects = useSettingsStore((state) => state.settings.preloadEffects);

  useEffect(() => {
    if (!projectId || !preloadEffects) return;
    void audioController.prepareAll();
    // Preparation runs once per opened project.
  }, [projectId, preloadEffects]);
}

/**
 * Stops the audio when the presentation changes.
 *
 * Without this, the music of the previous presentation would keep playing
 * while the transport of the new one showed it as stopped.
 */
function useStopAudioOnProjectChange(): void {
  const projectId = useProjectStore((state) => state.project?.id ?? null);

  useEffect(() => {
    audioController.stopAll();
    useAudioStore.getState().resetPreparation();
  }, [projectId]);
}

/** Routes the output to the device chosen in the settings, when supported. */
function useOutputDevice(): void {
  const deviceId = useSettingsStore((state) => state.settings.outputDeviceId);

  useEffect(() => {
    void audioController.applyOutputDevice(deviceId);
  }, [deviceId]);
}

export default function App() {
  const section = useUiStore((state) => state.section);
  const presentationMode = useUiStore((state) => state.presentationMode);

  useVisualPreferences();
  useWindowTitle();
  useAudioActivation();
  useProjectMixer();
  useProjectPreparation();
  useStopAudioOnProjectChange();
  useOutputDevice();

  return (
    <div className="app-shell" data-presentation={presentationMode}>
      <NavRail />
      <main className="app-content">
        {section === 'inicio' ? <HomeSection /> : null}
        {section === 'estudio' ? <StudioSection /> : null}
        {section === 'en-vivo' ? <LiveSection /> : null}
        {section === 'configuracion' ? <SettingsSection /> : null}
      </main>
      <ToastStack />
    </div>
  );
}
