import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { openPath } from '@tauri-apps/plugin-opener';
import {
  ExternalLink,
  FolderOpen,
  HardDrive,
  Keyboard,
  MonitorSpeaker,
  RotateCcw,
} from 'lucide-react';
import { Switch } from '../../components/common/Controls';
import { NumberField } from '../../components/common/NumberField';
import { ShortcutInput } from '../studio/PadEditor';
import { useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUiStore } from '../../stores/uiStore';
import { projectService } from '../../services/projectService';
import { isTauri } from '../../services/bridge';
import { DEFAULT_GLOBAL_BINDINGS, GLOBAL_SHORTCUTS } from '../shortcuts/shortcutRegistry';
import type { ThemePreference } from '../../types';

interface AudioDevice {
  deviceId: string;
  label: string;
}

export function SettingsSection() {
  const settings = useSettingsStore((state) => state.settings);
  const patch = useSettingsStore((state) => state.patch);
  const reset = useSettingsStore((state) => state.reset);
  const project = useProjectStore((state) => state.project);
  const engineStatus = useAudioStore((state) => state.status);
  const preparation = useAudioStore((state) => state.preparation);
  const pushToast = useUiStore((state) => state.pushToast);
  const setSection = useUiStore((state) => state.setSection);

  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [sinkSupported] = useState(() => {
    const AudioCtor = typeof window !== 'undefined' ? window.AudioContext : undefined;
    return Boolean(AudioCtor && 'setSinkId' in AudioCtor.prototype);
  });
  const [appInfo, setAppInfo] = useState<{
    name: string;
    version: string;
    platform: string;
    arch: string;
  } | null>(null);

  useEffect(() => {
    if (!sinkSupported) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setDevices(
          list
            .filter((device) => device.kind === 'audiooutput')
            .map((device, index) => ({
              deviceId: device.deviceId,
              label: device.label || `Dispositivo de salida ${index + 1}`,
            })),
        );
      } catch {
        setDevices([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sinkSupported]);

  useEffect(() => {
    if (!isTauri()) return;
    void invoke<{ name: string; version: string; platform: string; arch: string }>(
      'app_info',
    )
      .then(setAppInfo)
      .catch(() => undefined);
  }, []);

  const prepared = Object.values(preparation).filter(
    (entry) => entry.state === 'ready',
  ).length;

  const openProjectsFolder = async () => {
    try {
      const dir = await projectService.projectsDirectory();
      await openPath(dir);
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudo abrir la carpeta.',
        'error',
      );
    }
  };

  const openResourcesFolder = async () => {
    if (!project) {
      pushToast('Abre un proyecto para ver su carpeta de recursos.', 'warning');
      return;
    }
    try {
      const dir = await projectService.projectDirectory(project.id);
      await openPath(`${dir}/assets`);
    } catch (error) {
      pushToast(
        error instanceof Error ? error.message : 'No se pudo abrir la carpeta.',
        'error',
      );
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__text">
          <span className="page-eyebrow">Configuración</span>
          <h1>Ajustes de la aplicación</h1>
          <p className="page-subtitle">
            Todo se guarda localmente en este equipo. CueStage no envía información a
            internet ni necesita conexión.
          </p>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn--secondary" onClick={reset}>
            <RotateCcw size={16} />
            Restaurar valores
          </button>
        </div>
      </header>

      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h2 className="card__title">Cómo se ve</h2>
            <p className="card__description">
              Se guarda al instante. Cambiar el aspecto no detiene el sonido.
            </p>
          </div>
        </div>
        <div className="card__body">
          <div className="settings-group">
            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">Colores</span>
                <span className="settings-row__description">
                  Claro, oscuro o el que tenga el sistema.
                </span>
              </div>
              <div className="settings-row__control">
                <div className="theme-picker">
                  {(['light', 'dark', 'system'] as ThemePreference[]).map((theme) => (
                    <button
                      key={theme}
                      type="button"
                      className="theme-picker__option"
                      aria-pressed={settings.theme === theme}
                      onClick={() => patch({ theme })}
                    >
                      {theme === 'light'
                        ? 'Claro'
                        : theme === 'dark'
                          ? 'Oscuro'
                          : 'Sistema'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">Tamaño de los botones</span>
                <span className="settings-row__description">
                  Para que resulten cómodos en tu pantalla.
                </span>
              </div>
              <div className="settings-row__control">
                <select
                  className="select"
                  value={settings.controlScale}
                  onChange={(event) =>
                    patch({ controlScale: event.target.value as 'compact' | 'normal' | 'large' })
                  }
                  aria-label="Tamaño de los controles"
                >
                  <option value="compact">Compacto</option>
                  <option value="normal">Normal</option>
                  <option value="large">Grande</option>
                </select>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">Mostrar la guía al preparar</span>
                <span className="settings-row__description">
                  Una guía corta que te dice el siguiente paso mientras preparas la
                  presentación.
                </span>
              </div>
              <div className="settings-row__control">
                <Switch
                  checked={settings.showTutorial}
                  onChange={(value) => patch({ showTutorial: value })}
                  label={settings.showTutorial ? 'Activado' : 'Desactivado'}
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">Menos movimiento</span>
                <span className="settings-row__description">
                  Quita las transiciones. También se respeta la preferencia del
                  sistema.
                </span>
              </div>
              <div className="settings-row__control">
                <Switch
                  checked={settings.reduceMotion}
                  onChange={(value) => patch({ reduceMotion: value })}
                  label={settings.reduceMotion ? 'Activado' : 'Desactivado'}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h2 className="card__title">El sonido</h2>
            <p className="card__description">
              Cómo suena CueStage y dónde se oye.
            </p>
          </div>
        </div>
        <div className="card__body">
          <div className="settings-group">
            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">Estado del sonido</span>
                <span className="settings-row__description">
                  {engineStatus === 'ready'
                    ? 'Listo: en cuanto pulses un botón se oirá.'
                    : engineStatus === 'suspended'
                      ? 'El motor está en pausa hasta que pulses algo.'
                      : `Estado actual: ${engineStatus}.`}
                </span>
              </div>
              <div className="settings-row__control">
                <span
                  className={`badge ${
                    engineStatus === 'ready'
                      ? 'badge--success'
                      : engineStatus === 'error'
                        ? 'badge--danger'
                        : 'badge--warning'
                  }`}
                >
                  {engineStatus}
                </span>
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">
                  <MonitorSpeaker size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                  Dónde se oye
                </span>
                <span className="settings-row__description">
                  {sinkSupported && devices.length > 0
                    ? 'Elige el dispositivo por el que sale el sonido.'
                    : 'El motor Web Audio usa el dispositivo predeterminado de Windows. Para cambiarlo, adjusts el volumen en el panel de sonido del sistema.'}
                </span>
              </div>
              <div className="settings-row__control">
                {sinkSupported && devices.length > 0 ? (
                  <select
                    className="select"
                    value={settings.outputDeviceId ?? ''}
                    onChange={(event) =>
                      patch({ outputDeviceId: event.target.value || null })
                    }
                    aria-label="Dónde se oye"
                  >
                    <option value="">Dispositivo predeterminado</option>
                    {devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="badge">Predeterminado del sistema</span>
                )}
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">La música empieza despacio (s)</span>
                <span className="settings-row__description">
                  Fundido de entrada de la música principal.
                </span>
              </div>
              <div className="settings-row__control">
                <NumberField
                  value={settings.fadeInSec}
                  min={0}
                  max={30}
                  step={0.1}
                  ariaLabel="Fundido de entrada por defecto, en segundos"
                  onChange={(value) => patch({ fadeInSec: value })}
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">La música termina despacio (s)</span>
                <span className="settings-row__description">
                  Se aplica al terminar la música principal.
                </span>
              </div>
              <div className="settings-row__control">
                <NumberField
                  value={settings.fadeOutSec}
                  min={0}
                  max={30}
                  step={0.1}
                  ariaLabel="Fundido de salida por defecto, en segundos"
                  onChange={(value) => patch({ fadeOutSec: value })}
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">Preparar los sonidos al abrir</span>
                <span className="settings-row__description">
                  Descarga los archivos en segundo plano para que los botones suenen al
                  instante. Hay {prepared} archivo(s) preparados ahora mismo.
                </span>
              </div>
              <div className="settings-row__control">
                <Switch
                  checked={settings.preloadEffects}
                  onChange={(value) => patch({ preloadEffects: value })}
                  label={settings.preloadEffects ? 'Activado' : 'Desactivado'}
                />
              </div>
            </div>

            <div className="settings-row">
              <div className="settings-row__body">
                <span className="settings-row__title">Pasar a la siguiente señal solo</span>
                <span className="settings-row__description">
                  Al ejecutar una señal se pasa a la siguiente. Desactivado por defecto.
                </span>
              </div>
              <div className="settings-row__control">
                <Switch
                  checked={settings.autoAdvanceCues}
                  onChange={(value) => patch({ autoAdvanceCues: value })}
                  label={settings.autoAdvanceCues ? 'Activado' : 'Desactivado'}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h2 className="card__title">
              <Keyboard size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
              El teclado
            </h2>
            <p className="card__description">
              Se aplican dentro de la ventana de CueStage. Las teclas de cada botón se
              editan en «Preparar».
            </p>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => patch({ globalBindings: { ...DEFAULT_GLOBAL_BINDINGS } })}
          >
            <RotateCcw size={15} />
            Restaurar
          </button>
        </div>
        <div className="card__body">
          <div className="shortcut-table">
            {GLOBAL_SHORTCUTS.map((definition) => (
              <div key={definition.action} className="shortcut-table__row">
                <div className="settings-row__body">
                  <span className="settings-row__title">{definition.label}</span>
                  <span className="settings-row__description">
                    {definition.description}
                  </span>
                </div>
                <ShortcutInput
                  value={settings.globalBindings[definition.action] ?? null}
                  onChange={(value) =>
                    patch({
                      globalBindings: {
                        ...settings.globalBindings,
                        [definition.action]: value ?? '',
                      },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card__header">
          <div className="card__heading">
            <h2 className="card__title">Archivos y datos</h2>
            <p className="card__description">
              Todo se guarda en este equipo. No hay cuentas ni servicios en la nube.
            </p>
          </div>
        </div>
        <div className="card__body">
          <div className="stack">
            <div className="row row--wrap">
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void openProjectsFolder()}
                disabled={!isTauri()}
              >
                <FolderOpen size={16} />
                Abrir la carpeta de proyectos
              </button>
              <button
                type="button"
                className="btn btn--secondary"
                onClick={() => void openResourcesFolder()}
                disabled={!isTauri()}
              >
                <HardDrive size={16} />
                Abrir la carpeta de recursos
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setSection('estudio')}
              >
                <ExternalLink size={16} />
                Ir al Estudio
              </button>
            </div>

            <div className="diagnostics">
              <div className="diagnostics__item">
                <span className="diagnostics__label">Versión</span>
                <span className="diagnostics__value">
                  {appInfo ? `${appInfo.name} ${appInfo.version}` : '0.1.0'}
                </span>
              </div>
              <div className="diagnostics__item">
                <span className="diagnostics__label">Plataforma</span>
                <span className="diagnostics__value">
                  {appInfo ? `${appInfo.platform} · ${appInfo.arch}` : '—'}
                </span>
              </div>
              <div className="diagnostics__item">
                <span className="diagnostics__label">Motor de audio</span>
                <span className="diagnostics__value">Web Audio API</span>
              </div>
              <div className="diagnostics__item">
                <span className="diagnostics__label">Estado</span>
                <span className="diagnostics__value">{engineStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
