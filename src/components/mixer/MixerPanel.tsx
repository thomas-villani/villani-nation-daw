import { useProjectStore } from '../../store/useProjectStore';
import { ChannelStrip } from './ChannelStrip';
import { ExportControls } from './ExportControls';

// Phase 6 — the mixer "board" (spec §5.7). A bottom drawer with one channel strip
// per instrument (fader/mute/solo/pan + live meter, drums expand to a per-pad
// sub-mixer) plus the export controls. Mixer state lives on each Instrument, so it
// persists with the project and the offline render reproduces it exactly.

export function MixerPanel() {
  // Select the stable instruments array; map in render (the recurring zustand
  // fresh-array selector pitfall — don't return a new array from the selector).
  const instruments = useProjectStore((s) => s.project.instruments);
  const toggleMixer = useProjectStore((s) => s.toggleMixer);

  return (
    <div className="bg-panel border-t-2 border-edge px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-bold text-sm uppercase tracking-wider text-hi">🎚️ Mixer</h2>
        <button
          onClick={toggleMixer}
          className="text-white/40 hover:text-white text-lg leading-none px-2"
          title="Close mixer"
        >
          ✕
        </button>
      </div>
      <div className="flex items-stretch gap-2 overflow-x-auto pb-1">
        {instruments.map((inst) => (
          <ChannelStrip key={inst.id} instrument={inst} />
        ))}
        <div className="w-px bg-edge shrink-0 mx-1" />
        <ExportControls />
      </div>
    </div>
  );
}
