import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { CircleAlert, CircleStop, LoaderCircle, Maximize2, Minimize2, Radio, Settings } from 'lucide-react';
import { MusicTransport } from '../../components/AudioPlayer/MusicTransport';
import { CueRail } from '../../components/CueList/CueRail';
import { VolumeMixer } from '../../components/Mixer/VolumeMixer';
import { PadGrid } from '../../components/SoundPads/PadGrid';
import { audioController } from './audioController';
import { useShortcuts } from '../shortcuts/useShortcuts';
import { preparationProgress, useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useUiStore } from '../../stores/uiStore';
import { isTauri } from '../../services/bridge';
import type { Cue, SoundPad } from '../../types';

const DOUBLE_CLICK_GUARD_MS = 250;

export function LiveSection() {
  const project = useProjectStore((state) => state.project);
  const mutate = useProjectStore((state) => state.mutate);
  const markCueExecuted = useProjectStore((state) => state.markCueExecuted);
  const engineStatus = useAudioStore((state) => state.status);
  const engineError = useAudioStore((state) => state.error);
  const activeEffectCount = useAudioStore((state) => state.activeEffectCount);
  const preparation = useAudioStore((state) => state.preparation);
  const progress = useMemo(() => preparationProgress(preparation), [preparation]);

  const presentationMode = useUiStore((state) => state.presentationMode);
  const setPresentationMode = useUiStore((state) => state.setPresentationMode);
  const setSection = useUiStore((state) => state.setSection);

  const [activeCueId, setActiveCueId] = useState<string | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastExecution = useRef<{ id: string; at: number }>({ id: '', at: 0 });
  const runCueRef = useRef<(cue: Cue, advance: boolean) => void>(() => undefined);

  const pads = useMemo(
    () => project?.pads.filter((pad) => pad.enabled) ?? [],
    [project?.pads],
  );
  const cues = useMemo(() => project?.cues ?? [], [project?.cues]);

  const cancelAuto = useCallback(() => {
    if (autoTimer.current !== null) {
      clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, []);

  useEffect(() => cancelAuto, [cancelAuto]);

  const runCue = useCallback(
    (cue: Cue, advance: boolean) => {
      if (!project) return;

      setActiveCueId(cue.id);
      markCueExecuted(cue.id, true);

      const scheduleNext = () => {
        if (!advance || !project.playback.autoAdvance) return;
        const index = cues.findIndex((entry) => entry.id === cue.id);
        const next = cues[index + 1];
        if (!next) return;
        const delay = cue.type === 'wait' ? cue.waitSec * 1000 : 0;
        cancelAuto();
        autoTimer.current = setTimeout(() => {
          autoTimer.current = null;
          runCueRef.current(next, true);
        }, delay);
      };

      switch (cue.type) {
        case 'play-music':
          void audioController.playMusic();
          scheduleNext();
          break;
        case 'pause-music':
          audioController.pauseMusic();
          scheduleNext();
          break;
        case 'resume-music':
          audioController.resumeMusic();
          scheduleNext();
          break;
        case 'stop-music':
          audioController.stopMusic();
          scheduleNext();
          break;
        case 'play-pad': {
          const pad = pads.find((entry) => entry.id === cue.padId);
          if (pad) void audioController.triggerPad(pad);
          scheduleNext();
          break;
        }
        case 'stop-pad': {
          const pad = pads.find((entry) => entry.id === cue.padId);
          if (pad) audioController.stopPad(pad.id);
          scheduleNext();
          break;
        }
        case 'stop-all':
          cancelAuto();
          audioController.stopAll();
          break;
        case 'wait':
          scheduleNext();
          break;
      }
    },
    [cancelAuto, cues, markCueExecuted, pads, project],
  );

  useEffect(() => {
    runCueRef.current = runCue;
  }, [runCue]);

  const executeCue = useCallback(
    (cue: Cue) => {
      const now = Date.now();
      if (
        lastExecution.current.id === cue.id &&
        now - lastExecution.current.at < DOUBLE_CLICK_GUARD_MS
      ) {
        return;
      }
      lastExecution.current = { id: cue.id, at: now };
      runCue(cue, true);
    },
    [runCue],
  );

  const goToCue = useCallback(
    (direction: -1 | 1) => {
      if (cues.length === 0) return;
      const index = cues.findIndex((cue) => cue.id === activeCueId);
      const nextIndex =
        index < 0
          ? direction > 0
            ? 0
            : cues.length - 1
          : Math.min(cues.length - 1, Math.max(0, index + direction));
      const next = cues[nextIndex];
      if (next) setActiveCueId(next.id);
    },
    [activeCueId, cues],
  );

  const handleStopAll = useCallback(() => {
    cancelAuto();
    audioController.stopAll();
    setActiveCueId(null);
  }, [cancelAuto]);

  const toggleMusic = useCallback(() => {
    const status = useAudioStore.getState().music.status;
    if (status === 'loading') return;
    if (status === 'playing') audioController.pauseMusic();
    else if (status === 'paused') audioController.resumeMusic();
    else void audioController.playMusic();
  }, []);

  const triggerPad = useCallback((pad: SoundPad) => {
    void audioController.triggerPad(pad);
  }, []);

  const releasePad = useCallback((padId: string) => {
    audioController.stopPad(padId);
  }, []);

  const togglePresentation = useCallback(() => {
    const next = !presentationMode;
    setPresentationMode(next);
    if (isTauri()) {
      void getCurrentWindow()
        .setFullscreen(next)
        .catch(() => undefined);
    }
  }, [presentationMode, setPresentationMode]);

  useShortcuts(true, {
    onToggleMusic: toggleMusic,
    onStopAll: handleStopAll,
    onNextCue: () => goToCue(1),
    onPreviousCue: () => goToCue(-1),
    onTogglePresentation: togglePresentation,
    onTriggerPad: (padId) => {
      const pad = pads.find((entry) => entry.id === padId);
      if (pad) triggerPad(pad);
    },
    onReleasePad: releasePad,
  });

  // Al entrar en «En vivo» se cargan todos los archivos para que el primer
  // toque suene fluido y no haya que esperar.
  const projectId = project?.id;
  useEffect(() => {
    if (!projectId) return;
    void audioController.prepareAll();
  }, [projectId]);

  if (!project) {
    return (
      <div className="page">
        <div className="empty-state">
          <div className="empty-state__icon">
            <Radio size={22} />
          </div>
          <div className="empty-state__title">No hay ningún proyecto abierto</div>
          <p className="empty-state__text">
            Abre una presentación para entrar en modo En vivo.
          </p>
          <div className="empty-state__actions">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => setSection('inicio')}
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }

  const statusLabel =
    engineStatus === 'ready'
      ? 'Audio listo'
      : engineStatus === 'suspended'
        ? 'Audio suspendido · pulsa un control para activarlo'
        : engineStatus === 'error'
          ? 'Error del motor de audio'
          : 'Iniciando el motor de audio…';

  return (
    <div className="live">
      <header className="live__header">
        <div className="live__identity">
          <span className="live__title">{project.name}</span>
          <span className="live__status">
            <span
              className={`status-dot ${
                engineStatus === 'ready'
                  ? 'status-dot--live'
                  : engineStatus === 'error'
                    ? 'status-dot--danger'
                    : 'status-dot--warning'
              }`}
            />
            {statusLabel}
          </span>
        </div>
        <div className="live__actions">
          {activeEffectCount > 0 ? (
            <span className="badge badge--accent">
              {activeEffectCount} efecto(s) activo(s)
            </span>
          ) : null}
          <button
            type="button"
            className="icon-btn"
            onClick={() => setSection('configuracion')}
            aria-label="Abrir configuración"
            title="Configuración"
          >
            <Settings size={18} />
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={togglePresentation}
          >
            {presentationMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            {presentationMode ? 'Salir de presentación' : 'Modo presentación'}
          </button>
          <button
            type="button"
            className="btn btn--danger btn--lg"
            onClick={handleStopAll}
            title="Detiene la música y todos los efectos de CueStage. Atajo: Esc"
          >
            <CircleStop size={18} />
            Detener todo
          </button>
        </div>
      </header>

      {engineError ? (
        <p className="field__error">{engineError.message}</p>
      ) : null}

      {progress.loading > 0 ? (
        <div className="notice">
          <LoaderCircle size={16} className="notice__icon spin" />
          <span>
            Cargando los sonidos para que suenen a la primera: {progress.ready} de{' '}
            {progress.total} listos.
          </span>
        </div>
      ) : null}

      {progress.errors > 0 && progress.loading === 0 ? (
        <div className="notice notice--accent">
          <CircleAlert size={16} className="notice__icon" />
          <span>
            {progress.errors} archivo(s) no se han podido cargar. Volver a «Preparar» para
            revisarlo.
          </span>
        </div>
      ) : null}

      {!project.musicAssetId || pads.length === 0 ? (
        <div className="notice notice--accent">
          <CircleAlert size={16} className="notice__icon" />
          <span>
            {!project.musicAssetId && pads.length === 0
              ? 'Todavía no has preparado nada: vuelve a «Preparar» para añadir la música y los sonidos.'
              : !project.musicAssetId
                ? 'No has elegido la música de fondo. Puedes actuar solo con los sonidos.'
                : 'No hay botones de sonido. Añádelos en «Preparar».'}
          </span>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => setSection('estudio')}
          >
            Ir a Preparar
          </button>
        </div>
      ) : null}

      <div className="live__body">
        <div className="live__main">
          <section className="live__block">
            <h3 className="live__block-title">La música</h3>
            <MusicTransport
              onToggle={toggleMusic}
              onStop={() => audioController.stopMusic()}
              onSeek={(seconds) => audioController.seekMusic(seconds)}
            />
          </section>

          <section className="live__block">
            <h3 className="live__block-title">Los volúmenes</h3>
            <VolumeMixer
              musicVolume={project.mixer.musicVolume}
              sfxVolume={project.mixer.sfxVolume}
              masterVolume={project.mixer.masterVolume}
              onMusicChange={(value) => {
                mutate((draft) => {
                  draft.mixer.musicVolume = value;
                });
                audioController.applyMixer({ ...project.mixer, musicVolume: value });
              }}
              onSfxChange={(value) => {
                mutate((draft) => {
                  draft.mixer.sfxVolume = value;
                });
                audioController.applyMixer({ ...project.mixer, sfxVolume: value });
              }}
              onMasterChange={(value) => {
                mutate((draft) => {
                  draft.mixer.masterVolume = value;
                });
                audioController.applyMixer({ ...project.mixer, masterVolume: value });
              }}
            />
          </section>

          <section className="live__block live__block--grow">
            <h3 className="live__block-title">
              Los sonidos
              <span className="live__block-hint">
                Toca un botón para lanzarlo. Si tiene tecla, también funciona con ella.
              </span>
            </h3>
            <PadGrid pads={pads} onTrigger={triggerPad} onRelease={releasePad} />
          </section>
        </div>

        <aside className="live__side">
          <CueRail
            cues={cues}
            pads={pads}
            activeCueId={activeCueId}
            onExecute={executeCue}
            onNext={() => goToCue(1)}
            onPrevious={() => goToCue(-1)}
          />

          {project.playback.autoAdvance ? (
            <p className="field__hint">
              El avance automático está activo. «Detener todo» cancela la secuencia
              pendiente.
            </p>
          ) : (
            <p className="field__hint">
              Recorre la lista con las flechas del teclado o tocando una señal.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
