import { STEPS_PER_BAR } from '../../lib/constants';
import type { Clip, Instrument } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { Playhead } from '../transport/Playhead';
import { DrumLane, CELL, ROW } from './DrumLane';

// Drum grid: one row per pad x 16 steps (spec §5.2). Tap a cell to toggle a hit.

interface Props {
  instrument: Instrument;
  clip: Clip;
}

export function DrumGrid({ instrument, clip }: Props) {
  const pads = instrument.drumkit?.pads ?? [];
  const steps = clip.steps ?? [];
  const toggleStep = useProjectStore((s) => s.toggleStep);

  // Fast lookup of which (pad, step) cells are on.
  const active = new Set(steps.map((s) => `${s.padIndex}:${s.step}`));

  const gridWidth = STEPS_PER_BAR * CELL;
  const gridHeight = pads.length * ROW;

  return (
    <div className="panel inline-block">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg" style={{ color: instrument.color }}>
          {instrument.name} — {clip.name}
        </h2>
        <span className="text-xs text-white/40">drop a .wav onto a row to swap a sound</span>
      </div>

      <div className="flex">
        {/* Pad label column */}
        <div className="flex flex-col mr-2" style={{ width: 84 }}>
          <div style={{ height: 22 }} />
          {pads.map((pad, i) => (
            <div
              key={i}
              className="flex items-center font-bold text-sm text-white/80"
              style={{ height: ROW }}
            >
              {pad.name}
            </div>
          ))}
        </div>

        {/* Stepped area (Playhead overlays exactly this) */}
        <div>
          {/* Beat numbers */}
          <div className="flex" style={{ height: 22 }}>
            {Array.from({ length: STEPS_PER_BAR }, (_, i) => (
              <div
                key={i}
                className={`text-center text-[10px] text-white/40 ${i % 4 === 0 ? 'font-bold text-white/70' : ''}`}
                style={{ width: CELL }}
              >
                {i % 4 === 0 ? i / 4 + 1 : ''}
              </div>
            ))}
          </div>

          <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
            <Playhead stepWidth={CELL} height={gridHeight} />
            {pads.map((pad, padIndex) => (
              <DrumLane
                key={padIndex}
                instrumentId={instrument.id}
                padIndex={padIndex}
                pad={pad}
                color={instrument.color}
                activeCells={active}
                onToggle={(step) => toggleStep(clip.id, padIndex, step)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
