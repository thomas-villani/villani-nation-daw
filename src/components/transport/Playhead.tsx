import { useRef } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { useTransportPosition } from '../../hooks/useTransportPosition';

// A vertical line that glides across the grid, driven by the audio clock (spec
// §4.1). It writes transform via a ref every frame — no React state per frame —
// so it stays locked to the sound with zero drift.

interface Props {
  stepWidth: number; // px per 16th-note column
  height: number; // px
}

export function Playhead({ stepWidth, height }: Props) {
  const lineRef = useRef<HTMLDivElement>(null);
  const isPlaying = useProjectStore((s) => s.transport.isPlaying);

  useTransportPosition((clock) => {
    const el = lineRef.current;
    if (!el) return;
    el.style.transform = `translateX(${clock.step * stepWidth}px)`;
  });

  if (!isPlaying) return null;
  return (
    <div
      ref={lineRef}
      className="pointer-events-none absolute left-0 top-0 z-20 w-0.5 bg-hi/90 shadow-[0_0_8px_2px] shadow-hi/60"
      style={{ height }}
    />
  );
}
