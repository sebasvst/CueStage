interface SliderProps {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  /** Texto accesible del control. */
  label: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Volume slider.
 *
 * When the drag finishes the control returns the focus to the application:
 * if it kept the focus, the keyboard shortcuts would stay blocked after
 * moving a volume, which is very annoying during a show.
 *
 * The arrow keys always belong to the slider while it has the focus; the rest
 * of the keys keep working as application shortcuts.
 */
export function Slider({
  id,
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  label,
  className,
  disabled = false,
}: SliderProps) {
  return (
    <input
      id={id}
      className={className ?? 'range'}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerUp={(event) => {
        event.currentTarget.blur();
      }}
      onKeyUp={(event) => {
        // After adjusting with the keyboard the focus is released too, so the
        // space bar is not used to scroll the page.
        if (event.key.startsWith('Arrow')) {
          event.currentTarget.blur();
        }
      }}
    />
  );
}
