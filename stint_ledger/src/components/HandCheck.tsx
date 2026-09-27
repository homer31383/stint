import React from 'react';

interface HandCheckProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  className?: string;
  title?: string;
}

// Hand-drawn checkbox: an ink box with irregular corners and a forest check
// mark that draws on (stroke-dashoffset) when checked.
export function HandCheck({ checked, onChange, label, disabled, className = '', title }: HandCheckProps) {
  const box = (
    <span className={`hand-check ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`} title={title}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <svg viewBox="0 0 26 24" aria-hidden="true">
        <path pathLength={1} d="M4 12 C 7 14, 9 17, 10.5 19 C 13 13, 17 7, 24 3" />
      </svg>
    </span>
  );
  if (label === undefined) return <span className={className}>{box}</span>;
  return (
    <label className={`hand-check-label ${className}`}>
      {box}
      <span>{label}</span>
    </label>
  );
}
