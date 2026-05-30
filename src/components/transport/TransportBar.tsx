import { engine } from '../../audio/engine';
import { useProjectStore } from '../../store/useProjectStore';
import { ROOT_NAMES } from '../../lib/scales';
import type { ScaleName } from '../../model/types';
import { MoreMenu } from './MoreMenu';

const SCALE_OPTIONS: { value: ScaleName; label: string }[] = [
  { value: 'majPent', label: 'Happy 5' },
  { value: 'minPent', label: 'Moody 5' },
  { value: 'major', label: 'Major' },
  { value: 'minor', label: 'Minor' },
];

export function TransportBar() {
  const bpm = useProjectStore((s) => s.project.bpm);
  const root = useProjectStore((s) => s.project.key.root);
  const scale = useProjectStore((s) => s.project.key.scale);
  const isPlaying = useProjectStore((s) => s.transport.isPlaying);
  const mode = useProjectStore((s) => s.ui.mode);
  const showMixer = useProjectStore((s) => s.ui.showMixer);
  const showCoach = useProjectStore((s) => s.ui.showCoach);

  const setMode = useProjectStore((s) => s.setMode);
  const setBpm = useProjectStore((s) => s.setBpm);
  const setKeyRoot = useProjectStore((s) => s.setKeyRoot);
  const setScale = useProjectStore((s) => s.setScale);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);
  const toggleMixer = useProjectStore((s) => s.toggleMixer);
  const toggleCoach = useProjectStore((s) => s.toggleCoach);

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

      {/* Jam (loop the active clips) vs Song (arrange a full track on a timeline).
          Kept prominent in the bar so the song timeline is easy to find. */}
      <div className="flex rounded-xl border-2 border-edge overflow-hidden">
        {(['jam', 'song'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            title={m === 'jam' ? 'Loop your clips together' : 'Arrange a full song on a timeline'}
            className={`px-3 py-2 text-sm font-bold ${
              mode === m ? 'bg-hi text-ink' : 'bg-panel2 text-white/60 hover:text-white'
            }`}
          >
            {m === 'jam' ? '🔁 Jam' : '🎬 Song'}
          </button>
        ))}
      </div>

      <Control label="Tempo">
        <div className="flex items-center gap-1">
          <Stepper onClick={() => setBpm(bpm - 1)}>–</Stepper>
          <span className="w-12 text-center font-bold tabular-nums">{bpm}</span>
          <Stepper onClick={() => setBpm(bpm + 1)}>+</Stepper>
        </div>
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

      <button
        onClick={toggleMixer}
        className={`btn text-sm ml-auto ${showMixer ? 'bg-hi text-ink border-yellow-600' : ''}`}
        title="Open the mixer board + export"
      >
        🎚️ Mixer
      </button>

      <button
        onClick={toggleCoach}
        className={`btn text-sm ${showCoach ? 'bg-hi text-ink border-yellow-600' : ''}`}
        title="Show the step-by-step coach"
      >
        🧭 Coach
      </button>

      <MoreMenu />
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
