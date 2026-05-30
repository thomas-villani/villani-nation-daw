interface Props {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

/** A chunky labeled slider used throughout the instrument panel. */
export function Slider({ label, min, max, step = 0.01, value, onChange, format }: Props) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex justify-between text-[11px]">
        <span className="uppercase tracking-wide text-white/50 font-bold">{label}</span>
        <span className="tabular-nums text-white/70">{format ? format(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-hi"
      />
    </label>
  );
}
