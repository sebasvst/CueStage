import { useEffect, useRef, useState } from 'react';

interface NumberFieldProps {
  id?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  ariaLabel?: string;
  onChange: (value: number) => void;
}

/**
 * A numeric field that can be written comfortably.
 *
 * With a controlled `<input type="number">` the decimal point is lost: typing
 * "0.6" leaves a "0" because the intermediate value is not a valid number.
 * Here the text is kept while writing and only committed when it parses.
 */
export function NumberField({
  id,
  value,
  min = 0,
  max = 100,
  step = 0.1,
  label,
  ariaLabel,
  onChange,
}: NumberFieldProps) {
  const [text, setText] = useState(() => String(value));
  const editing = useRef(false);

  // When the value changes from the outside, it is reflected in the field.
  useEffect(() => {
    if (!editing.current) setText(String(value));
  }, [value]);

  const clamp = (candidate: number) => Math.min(max, Math.max(min, candidate));

  return (
    <input
      id={id}
      className="input"
      type="text"
      inputMode="decimal"
      role="spinbutton"
      aria-label={ariaLabel ?? label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      value={text}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        const parsed = Number(raw);
        if (raw.trim() !== '' && Number.isFinite(parsed)) {
          onChange(clamp(parsed));
        }
      }}
      onBlur={() => {
        editing.current = false;
        const parsed = Number(text);
        const next =
          text.trim() === '' || !Number.isFinite(parsed) ? value : clamp(parsed);
        setText(String(next));
        onChange(next);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }
      }}
      data-step={step}
    />
  );
}
