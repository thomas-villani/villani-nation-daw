import { useEffect, useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { useProjectStore } from '../../store/useProjectStore';

// Audio visualizer (spec §5.8, "for Louie 🎇"). Self-contained: one <canvas>, one
// rAF that READS the engine's master analysers each frame and draws. A pure read —
// it can't affect the audio or timing. Three kid-switchable styles.

type Mode = 'bars' | 'scope' | 'blob';

const MODES: { id: Mode; label: string }[] = [
  { id: 'bars', label: '📊 Bars' },
  { id: 'scope', label: '〰️ Scope' },
  { id: 'blob', label: '🫧 Blob' },
];

const W = 300;
const H = 130;

export function Visualizer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<Mode>('bars');
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const toggleVisualizer = useProjectStore((s) => s.toggleVisualizer);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#15131f';
      ctx.fillRect(0, 0, W, H);

      if (modeRef.current === 'scope') drawScope(ctx);
      else if (modeRef.current === 'blob') drawBlob(ctx);
      else drawBars(ctx);

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="fixed right-4 top-20 z-30 panel p-3 shadow-chunky w-[324px]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-sm text-hi">🎇 Visualizer</h3>
        <button
          className="text-white/40 hover:text-bass text-sm"
          onClick={toggleVisualizer}
          title="close"
        >
          ✕
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="rounded-lg border-2 border-edge block"
        style={{ width: W, height: H }}
      />
      <div className="flex gap-1.5 mt-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`flex-1 rounded-lg border-2 px-2 py-1 text-xs font-bold ${
              mode === m.id ? 'bg-hi text-ink border-yellow-600' : 'border-edge hover:border-white/30'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// dB magnitudes (~ -100..0) → 0..1 height.
const norm = (db: number) => Math.max(0, Math.min(1, (db + 100) / 90));

function drawBars(ctx: CanvasRenderingContext2D) {
  const data = engine.getFFTValues();
  const n = data.length;
  const gap = 2;
  const bw = (W - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const v = norm(data[i]);
    const h = v * (H - 6);
    const x = i * (bw + gap);
    // Cool→hot across the spectrum: cyan lows fading to pink highs.
    const t = i / n;
    ctx.fillStyle = lerpColor([78, 224, 255], [255, 107, 157], t);
    ctx.fillRect(x, H - h, bw, h);
  }
}

function drawScope(ctx: CanvasRenderingContext2D) {
  const data = engine.getWaveformValues();
  const n = data.length;
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#4ee0ff';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * W;
    const y = (1 - (data[i] + 1) / 2) * H;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawBlob(ctx: CanvasRenderingContext2D) {
  const data = engine.getFFTValues();
  // Bass energy = the low bins ("the thump"); overall = the whole spectrum.
  const lowBins = Math.max(1, Math.floor(data.length * 0.25));
  let bass = 0;
  for (let i = 0; i < lowBins; i++) bass += norm(data[i]);
  bass /= lowBins;
  let overall = 0;
  for (let i = 0; i < data.length; i++) overall += norm(data[i]);
  overall /= data.length;

  const cx = W / 2;
  const cy = H / 2;
  const r = 14 + bass * 52;

  const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(6, r));
  grad.addColorStop(0, lerpColor([255, 211, 78], [255, 107, 157], overall));
  grad.addColorStop(1, 'rgba(155,123,255,0.05)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(6, r), 0, Math.PI * 2);
  ctx.fill();
}

function lerpColor(a: number[], b: number[], t: number): string {
  const c = a.map((av, i) => Math.round(av + (b[i] - av) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
