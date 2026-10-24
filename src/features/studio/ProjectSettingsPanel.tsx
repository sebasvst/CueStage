import { useEffect } from 'react';
import { Music, Play, Repeat, Timer } from 'lucide-react';
import { NumberField } from '../../components/common/NumberField';
import { Slider } from '../../components/common/Slider';
import { useProjectStore } from '../../stores/projectStore';
import { audioController } from '../live-mode/audioController';

/** Paso 1: la música de fondo de la presentación. */
export function MusicSettings() {
  const project = useProjectStore((state) => state.project);
  const mutate = useProjectStore((state) => state.mutate);

  if (!project) return null;

  const assets = project.assets;
  const musicAsset = assets.find((asset) => asset.id === project.musicAssetId) ?? null;

  return (
    <section className="card">
      <div className="card__header">
        <div className="card__heading">
          <h3 className="card__title">La música de fondo</h3>
          <p className="card__description">
            Sonará mientras actuas. Los sonidos que lances se oirán encima.
          </p>
        </div>
      </div>
      <div className="card__body">
        <div className="stack">
          <div className="field">
            <label className="field__label" htmlFor="music-asset">
              <Music size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Pista elegida
            </label>
            <select
              id="music-asset"
              className="select"
              value={project.musicAssetId ?? ''}
              onChange={(event) =>
                mutate((draft) => {
                  draft.musicAssetId = event.target.value || null;
                })
              }
            >
              <option value="">Ninguna por ahora</option>
              {assets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
            {musicAsset ? (
              <div className="row" style={{ marginTop: 'var(--space-2)' }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => void audioController.previewAsset(musicAsset)}
                >
                  <Play size={15} />
                  Escuchar
                </button>
                <span className="field__hint">
                  {musicAsset.format.toUpperCase()} ·{' '}
                  {musicAsset.sizeBytes
                    ? `${Math.round(musicAsset.sizeBytes / 1024)} KB`
                    : '—'}
                  {musicAsset.durationSec
                    ? ` · ${Math.round(musicAsset.durationSec)} s`
                    : ''}
                </span>
              </div>
            ) : (
              <span className="field__hint">
                Añade un archivo en el paso 2 y vuelve aquí para elegirlo.
              </span>
            )}
          </div>

          <div className="grid grid--three">
            <div className="field">
              <label className="field__label" htmlFor="fade-in">
                <Timer size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                Entra despacio (s)
              </label>
              <NumberField
                id="fade-in"
                value={project.playback.musicFadeInSec}
                min={0}
                max={30}
                step={0.1}
                label="Fundido de entrada de la música, en segundos"
                onChange={(value) =>
                  mutate((draft) => {
                    draft.playback.musicFadeInSec = value;
                  })
                }
              />
              <span className="field__hint">0 = empieza de golpe.</span>
            </div>

            <div className="field">
              <label className="field__label" htmlFor="fade-out">
                <Timer size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
                Termina despacio (s)
              </label>
              <NumberField
                id="fade-out"
                value={project.playback.musicFadeOutSec}
                min={0}
                max={30}
                step={0.1}
                label="Fundido de salida de la música, en segundos"
                onChange={(value) =>
                  mutate((draft) => {
                    draft.playback.musicFadeOutSec = value;
                  })
                }
              />
              <span className="field__hint">0 = termina de golpe.</span>
            </div>

            <div className="field">
              <span className="field__label">Volumen de la música</span>
              <Slider
                value={project.mixer.musicVolume}
                label="Volumen de la música"
                onChange={(next) =>
                  mutate((draft) => {
                    draft.mixer.musicVolume = next;
                  })
                }
              />
              <span className="field__hint">
                {Math.round(project.mixer.musicVolume * 100)} %
              </span>
            </div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={project.playback.loopMusic}
              onChange={(event) =>
                mutate((draft) => {
                  draft.playback.loopMusic = event.target.checked;
                })
              }
            />
            <span className="switch__control" aria-hidden="true" />
            <span className="switch__label">
              <Repeat size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
              Repetir la música cuando termine
            </span>
          </label>
        </div>
      </div>
    </section>
  );
}

/** Volúmenes generales y comportamiento de la lista de señales. */
export function MixerSettings() {
  const project = useProjectStore((state) => state.project);
  const mutate = useProjectStore((state) => state.mutate);
  const mixer = project?.mixer;

  useEffect(() => {
    if (mixer) audioController.applyMixer(mixer);
  }, [mixer]);

  if (!project) return null;

  return (
    <section className="card">
      <div className="card__header">
        <div className="card__heading">
          <h3 className="card__title">Volúmenes</h3>
          <p className="card__description">
            Puedes cambiarlos también durante la actuación, en la pantalla «En vivo».
          </p>
        </div>
      </div>
      <div className="card__body">
        <div className="stack">
          <div className="field">
            <span className="field__label">Volumen de la música</span>
            <Slider
              value={project.mixer.musicVolume}
              label="Volumen de la música"
              onChange={(next) =>
                mutate((draft) => {
                  draft.mixer.musicVolume = next;
                })
              }
            />
            <span className="field__hint">
              {Math.round(project.mixer.musicVolume * 100)} %
            </span>
          </div>

          <div className="field">
            <span className="field__label">Volumen de los sonidos</span>
            <Slider
              value={project.mixer.sfxVolume}
              label="Volumen general de los sonidos"
              onChange={(next) =>
                mutate((draft) => {
                  draft.mixer.sfxVolume = next;
                })
              }
            />
            <span className="field__hint">
              {Math.round(project.mixer.sfxVolume * 100)} %
            </span>
          </div>

          <div className="field">
            <span className="field__label">Volumen general</span>
            <Slider
              value={project.mixer.masterVolume}
              label="Volumen general de salida"
              onChange={(next) =>
                mutate((draft) => {
                  draft.mixer.masterVolume = next;
                })
              }
            />            <span className="field__hint">
              {Math.round(project.mixer.masterVolume * 100)} %
            </span>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={project.playback.autoAdvance}
              onChange={(event) =>
                mutate((draft) => {
                  draft.playback.autoAdvance = event.target.checked;
                })
              }
            />
            <span className="switch__control" aria-hidden="true" />
            <span className="switch__label">
              Pasar a la siguiente señal automáticamente
            </span>
          </label>
          <span className="field__hint">
            Desactivado por defecto: es más seguro avanzar a mano durante la función.
          </span>
        </div>
      </div>
    </section>
  );
}
