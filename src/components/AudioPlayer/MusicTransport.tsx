import { LoaderCircle, Pause, Play, Square } from 'lucide-react';
import { useAudioStore } from '../../stores/audioStore';
import { useProjectStore } from '../../stores/projectStore';
import { useMusicPosition } from '../../hooks/useMusicPosition';
import { Slider } from '../common/Slider';
import { formatTime } from '../../utils/format';

interface MusicTransportProps {
  onToggle: () => void;
  onStop: () => void;
  onSeek: (seconds: number) => void;
}

export function MusicTransport({ onToggle, onStop, onSeek }: MusicTransportProps) {
  const music = useAudioStore((state) => state.music);
  const engineStatus = useAudioStore((state) => state.status);
  const assets = useProjectStore((state) => state.project?.assets ?? []);
  const assignedId = useProjectStore((state) => state.project?.musicAssetId ?? null);

  const position = useMusicPosition(music.status === 'playing');
  const duration = music.duration;

  // While nothing is playing the transport shows the music assigned to the
  // project, so the operator always knows which track is loaded.
  const showingId = music.assetId ?? assignedId;
  const name = showingId
    ? (assets.find((asset) => asset.id === showingId)?.name ?? null)
    : null;
  const isAssigned = Boolean(assignedId);

  const isPlaying = music.status === 'playing';
  const isPaused = music.status === 'paused';
  const isLoading = music.status === 'loading';

  return (
    <div className="transport">
      <div className="transport__top">
        <span className="transport__art" aria-hidden="true">
          {isLoading ? <LoaderCircle size={20} className="spin" /> : <Play size={20} />}
        </span>
        <div className="transport__meta">
          <span className="transport__name">{name ?? 'Sin música principal'}</span>
          <span className="transport__sub">
            {isLoading
              ? 'Preparando la música…'
              : isPlaying
                ? 'Reproduciendo'
                : isPaused
                  ? 'En pausa'
                  : music.status === 'error'
                    ? 'Error de reproducción'
                    : isAssigned
                      ? 'Asignada al proyecto · detenida'
                      : 'Detenido'}
            {engineStatus === 'suspended' ? ' · motor suspendido' : ''}
          </span>
        </div>
        <div className="transport__controls">
          <button
            type="button"
            className="transport__play"
            onClick={onToggle}
            disabled={isLoading}
            aria-label={
              isLoading
                ? 'Preparando la música'
                : isPlaying
                  ? 'Pausar la música'
                  : 'Reproducir la música'
            }
            aria-busy={isLoading}
            title={
              isLoading
                ? 'Preparando la música…'
                : isPlaying
                  ? 'Pausar'
                  : isPlaying || isPaused
                    ? 'Reanudar'
                    : 'Reproducir'
            }
          >
            {isLoading ? (
              <LoaderCircle size={20} className="spin" />
            ) : isPlaying ? (
              <Pause size={20} />
            ) : (
              <Play size={20} />
            )}
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={onStop}
            aria-label="Detener la música"
            title="Detener la música"
          >
            <Square size={18} />
          </button>
        </div>
      </div>

      <div className="transport__progress">
        <span className="transport__time">{formatTime(position)}</span>
        <Slider
          value={Math.min(position, duration)}
          min={0}
          max={Math.max(duration, 0.01)}
          step={0.05}
          onChange={onSeek}
          label="Posición de la música"
          disabled={duration <= 0}
        />
        <span className="transport__time transport__time--end">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
