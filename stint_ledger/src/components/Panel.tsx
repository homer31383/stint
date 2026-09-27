import React from 'react';

type PaperVariant = 1 | 2 | 3 | 4;
type Tape = 'fern' | 'clay' | 'kraft';

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  /** Hand-cut edge and tilt variant. Derived from the title when omitted. */
  variant?: PaperVariant;
  /** Dense tables stay level: hand-cut edges, no rotation. */
  dense?: boolean;
  /** Decorative washi tape. Sprinkle sparingly. */
  tape?: Tape;
  tapeSide?: 'left' | 'right';
}

function variantFor(seed: string): PaperVariant {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return ((h % 4) + 1) as PaperVariant;
}

const TAPE_CLASS: Record<Tape, string> = {
  fern: '',
  clay: 'washi-clay',
  kraft: 'washi-kraft',
};

export function Panel({ title, children, className = '', action, variant, dense, tape, tapeSide = 'left' }: PanelProps) {
  const v = variant ?? variantFor(title ?? className);
  return (
    <div className={`paper paper-${v} paper-pad ${dense ? 'paper-flat' : ''} ${className}`}>
      {tape && <div className={`washi ${TAPE_CLASS[tape]} ${tapeSide === 'right' ? 'washi-r' : ''}`} />}
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 mb-4">
          {title ? <h2 className="paper-title">{title}</h2> : <span className="flex-1" />}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
