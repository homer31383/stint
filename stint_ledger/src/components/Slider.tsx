import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  sub?: string;
  /** Handwritten value color: forest for income-side, oxblood for expense-side. */
  tone?: 'income' | 'expense' | 'neutral';
}

export function Slider({ label, value, min, max, step, format, onChange, sub, tone = 'neutral' }: SliderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-0.5">
        <span className="text-sm text-ink-3">{label}</span>
        <span className={`hand-value ${tone === 'neutral' ? '' : tone}`}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
      {sub && <div className="text-[11px] font-mono text-ink-dim mt-0.5">{sub}</div>}
    </div>
  );
}
