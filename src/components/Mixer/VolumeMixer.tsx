import { Slider } from '../common/Slider';

interface VolumeMixerProps {
  musicVolume: number;
  sfxVolume: number;
  masterVolume: number;
  onMusicChange: (value: number) => void;
  onSfxChange: (value: number) => void;
  onMasterChange: (value: number) => void;
}

export function VolumeMixer({
  musicVolume,
  sfxVolume,
  masterVolume,
  onMusicChange,
  onSfxChange,
  onMasterChange,
}: VolumeMixerProps) {
  return (
    <div className="live__volumes">
      <Channel
        label="Música"
        value={musicVolume}
        onChange={onMusicChange}
        hint="Volumen de la pista principal"
      />
      <Channel
        label="Efectos"
        value={sfxVolume}
        onChange={onSfxChange}
        hint="Volumen general de los pads"
      />
      <Channel
        label="Salida"
        value={masterVolume}
        onChange={onMasterChange}
        hint="Volumen general de la aplicación"
      />
    </div>
  );
}

function Channel({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint: string;
}) {
  return (
    <div className="volume-channel">
      <div className="volume-channel__head">
        <span className="volume-channel__label">{label}</span>
        <span className="volume-channel__value">{Math.round(value * 100)} %</span>
      </div>
      <Slider
        value={value}
        onChange={onChange}
        label={hint}
      />
    </div>
  );
}
