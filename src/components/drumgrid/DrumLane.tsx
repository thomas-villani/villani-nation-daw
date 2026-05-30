import { useState } from 'react';
import { STEPS_PER_BAR } from '../../lib/constants';
import type { DrumPad } from '../../model/types';
import { engine } from '../../audio/engine';
import { useProjectStore } from '../../store/useProjectStore';

export const CELL = 38; // px per 16th-note column (also the Playhead step width)
export const ROW = 40; // px per pad row

interface Props {
  instrumentId: string;
  padIndex: number;
  pad: DrumPad;
  color: string;
  activeCells: Set<string>;
  onToggle: (step: number) => void;
}

export function DrumLane({ instrumentId, padIndex, pad, color, activeCells, onToggle }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const setPadSample = useProjectStore((s) => s.setPadSample);
  const togglePadMute = useProjectStore((s) => s.togglePadMute);

  const handleToggle = (step: number) => {
    onToggle(step);
    if (!pad.mute) engine.auditionPad(instrumentId, padIndex);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.(wav|ogg|mp3)$/i.test(file.name)) {
      setPadSample(instrumentId, padIndex, URL.createObjectURL(file));
    }
  };

  return (
    <div
      className={`flex ${dragOver ? 'ring-2 ring-hi rounded' : ''}`}
      style={{ height: ROW }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      {Array.from({ length: STEPS_PER_BAR }, (_, step) => {
        const on = activeCells.has(`${padIndex}:${step}`);
        const beatStart = step % 4 === 0;
        return (
          <button
            key={step}
            onClick={() => handleToggle(step)}
            className={`box-border transition-colors ${beatStart ? 'border-l-2 border-l-edge' : 'border-l border-l-white/5'} border-y border-y-black/20`}
            style={{
              width: CELL,
              height: ROW,
              backgroundColor: on ? color : pad.mute ? '#1a1726' : '#2c2542',
              opacity: pad.mute ? 0.4 : 1,
            }}
            title={pad.source === 'sample' ? 'custom sample' : pad.name}
          />
        );
      })}
      <button
        onClick={() => togglePadMute(instrumentId, padIndex)}
        className="ml-2 w-8 text-xs font-bold rounded bg-panel2 border border-edge"
        title="mute pad"
      >
        {pad.mute ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
