import { useState } from 'react';
import type { Instrument } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { MeterBar } from './MeterBar';

// One mixer channel strip (spec §5.7): fader / mute / solo / pan + a live meter.
// These write to the Instrument's channel state, which persists with the project,
// so saving the song saves the mix. Drum channels expand to a per-pad sub-mixer.

export function ChannelStrip({ instrument }: { instrument: Instrument }) {
  const update = useProjectStore((s) => s.updateInstrument);
  const [showPads, setShowPads] = useState(false);
  const isDrum = instrument.kind === 'drumkit';

  return (
    <div className="shrink-0 w-[7.5rem] bg-panel2 rounded-xl border-2 border-edge p-2 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5 w-full">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: instrument.color }} />
        <span className="font-bold text-xs truncate flex-1" title={instrument.name}>
          {instrument.name}
        </span>
        <span className="text-[10px]">{isDrum ? '🥁' : '🎹'}</span>
      </div>

      {/* Meter + vertical fader */}
      <div className="flex items-end gap-2 h-32">
        <MeterBar instrumentId={instrument.id} />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={instrument.volume}
          onChange={(e) => update(instrument.id, { volume: Number(e.target.value) })}
          className="accent-hi"
          style={{ writingMode: 'vertical-lr', direction: 'rtl', width: 22, height: '100%' }}
          title={`Volume ${Math.round(instrument.volume * 100)}%`}
          aria-label={`${instrument.name} volume`}
        />
      </div>
      <span className="text-[10px] text-white/40 font-bold tabular-nums -mt-1">
        {Math.round(instrument.volume * 100)}
      </span>

      {/* Mute / Solo */}
      <div className="flex gap-1 w-full">
        <button
          onClick={() => update(instrument.id, { mute: !instrument.mute })}
          className={`flex-1 rounded-lg py-1 text-xs font-extrabold border-2 ${
            instrument.mute ? 'bg-bass text-ink border-pink-700' : 'bg-panel border-edge text-white/60'
          }`}
          title="Mute"
        >
          M
        </button>
        <button
          onClick={() => update(instrument.id, { solo: !instrument.solo })}
          className={`flex-1 rounded-lg py-1 text-xs font-extrabold border-2 ${
            instrument.solo ? 'bg-hi text-ink border-yellow-600' : 'bg-panel border-edge text-white/60'
          }`}
          title="Solo"
        >
          S
        </button>
      </div>

      {/* Pan */}
      <label className="w-full flex flex-col items-center gap-0.5">
        <input
          type="range"
          min={-1}
          max={1}
          step={0.02}
          value={instrument.pan}
          onChange={(e) => update(instrument.id, { pan: Number(e.target.value) })}
          className="w-full accent-lead"
          aria-label={`${instrument.name} pan`}
        />
        <span className="text-[9px] text-white/40 font-bold tracking-wide">
          {panLabel(instrument.pan)}
        </span>
      </label>

      {isDrum && instrument.drumkit && (
        <>
          <button
            onClick={() => setShowPads((v) => !v)}
            className="w-full rounded-lg py-1 text-[10px] font-bold bg-panel border-2 border-edge text-white/60 hover:text-white"
          >
            {showPads ? '▾ pads' : '▸ pads'}
          </button>
          {showPads && <DrumSubMixer instrument={instrument} />}
        </>
      )}
    </div>
  );
}

function DrumSubMixer({ instrument }: { instrument: Instrument }) {
  const setPadGain = useProjectStore((s) => s.setPadGain);
  const togglePadMute = useProjectStore((s) => s.togglePadMute);
  const pads = instrument.drumkit?.pads ?? [];

  return (
    <div className="w-full flex flex-col gap-1 bg-ink/40 rounded-lg p-1.5">
      {pads.map((pad, i) => (
        <div key={i} className="flex items-center gap-1">
          <button
            onClick={() => togglePadMute(instrument.id, i)}
            className={`text-[9px] w-4 shrink-0 ${pad.mute ? 'opacity-100' : 'opacity-30'}`}
            title={pad.mute ? 'unmute pad' : 'mute pad'}
          >
            {pad.mute ? '🔇' : '🔊'}
          </button>
          <span className="text-[9px] text-white/50 w-8 shrink-0 truncate" title={pad.name}>
            {pad.name}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={pad.gain}
            onChange={(e) => setPadGain(instrument.id, i, Number(e.target.value))}
            className="flex-1 accent-drum h-1"
            aria-label={`${pad.name} level`}
          />
        </div>
      ))}
    </div>
  );
}

function panLabel(pan: number): string {
  if (Math.abs(pan) < 0.02) return 'C';
  const amt = Math.round(Math.abs(pan) * 100);
  return pan < 0 ? `L${amt}` : `R${amt}`;
}
