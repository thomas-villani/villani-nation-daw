import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../../store/useProjectStore';
import { Slider } from '../common/Slider';
import { ProjectMenu } from './ProjectMenu';

// The ⚙ More menu (#1 — declutter the top bar). The transport bar keeps the
// musical essentials (Play, Jam/Song, Tempo, Key, Scale); the secondary controls
// — Swing, Volume, the Mixer/Visualizer/Coach panel toggles, and the File cluster
// — live in this click-away popover so nothing gets pushed off a narrow screen.

export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const swing = useProjectStore((s) => s.project.swing);
  const setSwing = useProjectStore((s) => s.setSwing);
  const masterVolume = useProjectStore((s) => s.ui.masterVolume);
  const setMasterVolume = useProjectStore((s) => s.setMasterVolume);

  const showMixer = useProjectStore((s) => s.ui.showMixer);
  const showVisualizer = useProjectStore((s) => s.ui.showVisualizer);
  const showCoach = useProjectStore((s) => s.ui.showCoach);
  const toggleMixer = useProjectStore((s) => s.toggleMixer);
  const toggleVisualizer = useProjectStore((s) => s.toggleVisualizer);
  const toggleCoach = useProjectStore((s) => s.toggleCoach);

  // Close on outside click while open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="relative ml-auto" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`btn text-sm ${open ? 'bg-hi text-ink border-yellow-600' : ''}`}
        title="More controls + file menu"
      >
        ⚙ More ▾
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-64 panel flex flex-col gap-3 shadow-2xl">
          <Slider
            label="Swing"
            min={0}
            max={1}
            value={swing}
            onChange={setSwing}
            format={(v) => `${Math.round(v * 100)}%`}
          />
          <Slider
            label="Volume"
            min={0}
            max={1}
            value={masterVolume}
            onChange={setMasterVolume}
            format={(v) => `${Math.round(v * 100)}%`}
          />

          <div className="h-px bg-edge" />

          <ToggleRow label="🎚️ Mixer" hint="Faders, meters + export" active={showMixer} onClick={toggleMixer} />
          <ToggleRow label="🎇 Visualizer" hint="Watch the sound dance" active={showVisualizer} onClick={toggleVisualizer} />
          <ToggleRow label="🧭 Coach" hint="Step-by-step helper" active={showCoach} onClick={toggleCoach} />

          <div className="h-px bg-edge" />

          <ProjectMenu />
        </div>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  active,
  onClick,
}: {
  label: string;
  hint: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-lg border-2 px-2 py-1.5 text-sm font-bold ${
        active ? 'border-hi bg-hi/15 text-hi' : 'border-edge text-white/80 hover:border-white/40'
      }`}
    >
      <span className="flex flex-col items-start leading-tight">
        <span>{label}</span>
        <span className="text-[10px] font-normal text-white/40">{hint}</span>
      </span>
      <span className={`text-[10px] ${active ? 'text-hi' : 'text-white/30'}`}>{active ? 'ON' : 'OFF'}</span>
    </button>
  );
}
