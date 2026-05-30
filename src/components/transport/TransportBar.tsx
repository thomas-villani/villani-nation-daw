import { engine } from '../../audio/engine';
import { useProjectStore } from '../../store/useProjectStore';
import { ROOT_NAMES } from '../../lib/scales';
import type { ScaleName } from '../../model/types';
import { ProjectMenu } from './ProjectMenu';

const SCALE_OPTIONS: { value: ScaleName; label: string }[] = [
  { value: 'majPent', label: 'Happy 5' },
  { value: 'minPent', label: 'Moody 5' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
];

export function TransportBar() {
  const bpm = useProjectStore((s) => s.project.bpm);
  const swing = useProjectStore((s) => s.project.swing);
  const root = useProjectStore((s) => s.project.key.root);
  const scale = useProjectStore((s) => s.project.key.scale);
  const masterVolume = useProjectStore((s) => s.ui.masterVolume);
  const isPlaying = useProjectStore((s) => s.transport.isPlaying);

  const setBpm = useProjectStore((s) => s.setBpm);
  const setSwing = useProjectStore((s) => s.setSwing);
  const setKeyRoot = useProjectStore((s) => s.setKeyRoot);
  const setScale = useProjectStore((s) => s.setScale);
  const setMasterVolume = useProjectStore((s) => s.setMasterVolume);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  const handlePlay = async () => {
    if (isPlaying) {
      engine.stop();
      setIsPlaying(false);
    } else {
      await engine.play(); // resumes AudioContext on this gesture
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex items-center gap-4 bg-panel border-b-2 border-edge px-4 py-3">
      <div className="flex items-center gap-2 pr-2">
        <span className="text-2xl">🎛️</span>
        <span className="font-extrabold text-hi text-lg tracking-tight">
          VillaniNation Studio
        </span>
      </div>

      <button
        onClick={handlePlay}
        className={`btn ${isPlaying ? 'bg-bass text-ink border-pink-700' : 'btn-primary'} w-24 text-lg`}
      >
        {isPlaying ? '■ Stop' : '▶ Play'}
      </button>

      <Control label="Tempo">
        <div className="flex items-center gap-1">
          <Stepper onClick={() => setBpm(bpm - 1)}>–</Stepper>
          <span className="w-12 text-center font-bold tabular-nums">{bpm}</span>
          <Stepper onClick={() => setBpm(bpm + 1)}>+</Stepper>
        </div>
      </Control>

      <Control label="Swing">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={swing}
          onChange={(e) => setSwing(Number(e.target.value))}
          className="w-24 accent-hi"
        />
      </Control>

      <Control label="Key">
        <select
          value={root}
          onChange={(e) => setKeyRoot(Number(e.target.value))}
          className="bg-panel2 border-2 border-edge rounded-lg px-2 py-1 font-bold"
        >
          {ROOT_NAMES.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
      </Control>

      <Control label="Scale">
        <select
          value={scale}
          onChange={(e) => setScale(e.target.value as ScaleName)}
          className="bg-panel2 border-2 border-edge rounded-lg px-2 py-1 font-bold"
        >
          {SCALE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Control>

      <Control label="Volume">
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={masterVolume}
          onChange={(e) => setMasterVolume(Number(e.target.value))}
          className="w-24 accent-hi"
        />
      </Control>

      <ProjectMenu />
    </div>
  );
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col items-start gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
        {label}
      </span>
      {children}
    </label>
  );
}

function Stepper({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-7 h-7 rounded-lg bg-panel2 border-2 border-edge font-bold active:translate-y-0.5"
    >
      {children}
    </button>
  );
}
