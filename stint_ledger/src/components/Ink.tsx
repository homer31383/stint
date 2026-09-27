import React from 'react';

// Small handcraft pieces: handwritten titles with a drawn-on squiggle,
// data-driven margin notes, ink circles around a figure, and the leaf
// fleuron. Handwriting never carries data the reader must read precisely.

interface PageTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function Squiggle() {
  return (
    <svg className="squiggle" viewBox="0 0 120 8" preserveAspectRatio="none" aria-hidden="true">
      <path pathLength={1} d="M2 5 Q 12 1 22 5 T 42 5 T 62 5 T 82 5 T 102 5 T 118 5" />
    </svg>
  );
}

export function PageTitle({ children, className = '' }: PageTitleProps) {
  return (
    <h1 className={`fj-title ${className}`}>
      {children}
      <Squiggle />
    </h1>
  );
}

interface NoteProps {
  children: React.ReactNode;
  tone?: 'forest' | 'clay' | 'desk';
  className?: string;
  style?: React.CSSProperties;
}

// Render a Note only when its condition is true, so notes never lie.
export function Note({ children, tone = 'forest', className = '', style }: NoteProps) {
  const toneClass = tone === 'clay' ? 'note-clay' : tone === 'desk' ? 'note-desk' : '';
  return <span className={`note ${toneClass} ${className}`} style={style}>{children}</span>;
}

export function InkCircle({ children }: { children: React.ReactNode }) {
  return (
    <span className="ink-circle-wrap">
      {children}
      <svg className="ink-circle" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
        <path pathLength={1} d="M12 22 C 10 6, 84 0, 93 16 C 99 30, 24 42, 9 30 C 2 24, 18 8, 44 6" />
      </svg>
    </span>
  );
}

export function Fleuron({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`fleuron ${className}`}
      width="14"
      height="16"
      viewBox="0 0 14 16"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M7 15 C 2 10, 2 4, 7 1 C 12 4, 12 10, 7 15 Z" opacity="0.9" />
      <path d="M7 14 L 7 3" stroke="rgba(0,0,0,0.28)" strokeWidth="1" fill="none" />
    </svg>
  );
}
