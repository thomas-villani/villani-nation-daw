import { useEffect, useRef } from 'react';
import { engine } from '../../audio/engine';

// A live level meter for one channel. Reads the engine's Tone.Meter each frame and
// writes the fill height imperatively (no React state churn at 60fps) — the same
// "read the audio, draw it" pattern as the playhead. Pure read: never affects sound.

export function MeterBar({ instrumentId }: { instrumentId: string }) {
  const fillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = fillRef.current;
      if (el) {
        const level = engine.getMeterLevel(instrumentId); // 0..1 amplitude
        // A gentle perceptual curve so quiet sounds still read on the bar.
        const pct = Math.min(1, Math.sqrt(level) * 1.15);
        el.style.height = `${pct * 100}%`;
        el.style.backgroundColor =
          pct > 0.88 ? '#ff6b9d' : pct > 0.6 ? '#ffd34e' : '#4ee0ff';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [instrumentId]);

  return (
    <div className="relative w-2.5 h-full bg-ink rounded-full overflow-hidden border border-edge">
      <div
        ref={fillRef}
        className="absolute bottom-0 left-0 right-0 transition-[height] duration-75"
        style={{ height: 0 }}
      />
    </div>
  );
}
