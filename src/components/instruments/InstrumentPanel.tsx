import { useState } from 'react';
import type { Instrument, SynthEngine, Waveform } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';
import { Slider } from '../common/Slider';
import { SYNTH_PRESETS } from '../../lib/synthPresets';

// Plain-language, kid-friendly explanations revealed by the ? help toggle (#5).
const HELP = {
  presets: 'Tap a sound to load it, then tweak the knobs below to make it your own.',
  engine: 'How notes are made. Mono = one bold note, Poly = play chords, FM = bell/metal tones.',
  wave: 'The basic shape of the sound: sine is smooth, square is hollow, sawtooth is bright & buzzy.',
  voices: 'Stacks copies of the note for a thicker, bigger sound.',
  detune: 'Spreads the stacked voices apart for a wide, shimmery feel.',
  cutoff: 'Brightness. Low = dull and muffled, high = bright and sparkly.',
  resonance: 'Adds a whistle or zing right at the brightness point.',
  attack: 'How fast the note starts. Low = punchy, high = it swells in softly.',
  release: 'How long the note rings out after it ends.',
  glide: 'Slides smoothly from one note to the next (Mono only).',
  effects: 'Extras you flip on to flavor the sound. Try one at a time first.',
  distortion: 'Adds grit and growl — makes it dirty and loud.',
  reverb: 'Adds space, like playing in a big room or hall.',
  delay: 'Echoes the note so it repeats and fades.',
} as const;

// Right panel: synth voice + effects controls (spec §5.3). Changes flow to the
// store and are reconciled live by the engine bridge — no audio glitches because
// param updates ramp and the effect chain only rebuilds when toggled.

const WAVES: Waveform[] = ['sine', 'triangle', 'square', 'sawtooth'];
const ENGINES: { value: SynthEngine; label: string }[] = [
  { value: 'mono', label: 'Mono' },
  { value: 'poly', label: 'Poly' },
  { value: 'fm', label: 'FM' },
];

export function InstrumentPanel({ instrument }: { instrument: Instrument }) {
  const [advanced, setAdvanced] = useState(false);
  const [help, setHelp] = useState(false);
  const updateSynth = useProjectStore((s) => s.updateSynthConfig);
  const toggleEffect = useProjectStore((s) => s.toggleEffect);
  const updateEffect = useProjectStore((s) => s.updateEffect);

  if (instrument.kind === 'drumkit') {
    return (
      <div className="panel w-72">
        <h2 className="font-bold text-lg mb-2" style={{ color: instrument.color }}>
          {instrument.name}
        </h2>
        <p className="text-sm text-white/50">
          Drum kit. Tap cells in the grid to build a beat, mute pads with the 🔊 button,
          or drop a <code>.wav</code> onto a row to swap a sound.
        </p>
      </div>
    );
  }

  const synth = instrument.synth!;
  const id = instrument.id;
  const fx = (type: 'distortion' | 'reverb' | 'delay') =>
    instrument.effects.find((e) => e.type === type)!;

  return (
    <div className="panel w-72 flex flex-col gap-4 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-lg" style={{ color: instrument.color }}>
          {instrument.name}
        </h2>
        <button
          onClick={() => setHelp((h) => !h)}
          className={`btn text-xs px-2 py-1 ${help ? 'bg-hi text-ink border-yellow-600' : ''}`}
          title="What does each control do?"
        >
          {help ? '✓ Help' : '? Help'}
        </button>
      </div>

      {/* Presets — tap a ready-made sound, then tweak (#3) */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wide text-white/50 font-bold">Sounds</span>
        <div className="flex flex-wrap gap-1.5">
          {SYNTH_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => updateSynth(id, p.config)}
              className="rounded-full border-2 border-edge hover:border-lead px-2.5 py-1 text-xs font-bold"
              title={`Load the ${p.name} sound`}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>
        {help && <p className="text-[10px] text-white/45 leading-snug">{HELP.presets}</p>}
      </div>

      {/* Engine + waveform */}
      <div className="flex gap-2">
        <label className="flex-1 flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-white/50 font-bold">Engine</span>
          <select
            value={synth.engine}
            onChange={(e) => updateSynth(id, { engine: e.target.value as SynthEngine })}
            className="bg-panel2 border-2 border-edge rounded-lg px-2 py-1 font-bold"
          >
            {ENGINES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label className="flex-1 flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-white/50 font-bold">Wave</span>
          <select
            value={synth.wave}
            onChange={(e) => updateSynth(id, { wave: e.target.value as Waveform })}
            className="bg-panel2 border-2 border-edge rounded-lg px-2 py-1 font-bold capitalize"
          >
            {WAVES.map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </label>
      </div>
      {help && (
        <div className="flex flex-col gap-1 -mt-2">
          <p className="text-[10px] text-white/45 leading-snug">{HELP.engine}</p>
          <p className="text-[10px] text-white/45 leading-snug">{HELP.wave}</p>
        </div>
      )}

      <Slider
        label="Voices"
        min={1}
        max={3}
        step={1}
        value={synth.voices}
        onChange={(v) => updateSynth(id, { voices: v })}
        format={(v) => String(v)}
        help={HELP.voices}
        showHelp={help}
      />
      <Slider
        label="Detune"
        min={0}
        max={50}
        step={1}
        value={synth.detune}
        onChange={(v) => updateSynth(id, { detune: v })}
        format={(v) => `${v}¢`}
        help={HELP.detune}
        showHelp={help}
      />

      <div className="h-px bg-edge" />

      {/* Filter */}
      <Slider
        label="Brightness (cutoff)"
        min={120}
        max={8000}
        step={10}
        value={synth.filter.cutoff}
        onChange={(v) =>
          updateSynth(id, { filter: { ...synth.filter, cutoff: v } })
        }
        format={(v) => `${Math.round(v)}Hz`}
        help={HELP.cutoff}
        showHelp={help}
      />
      <Slider
        label="Resonance"
        min={0}
        max={12}
        step={0.1}
        value={synth.filter.resonance}
        onChange={(v) =>
          updateSynth(id, { filter: { ...synth.filter, resonance: v } })
        }
        help={HELP.resonance}
        showHelp={help}
      />

      <div className="h-px bg-edge" />

      {/* Envelope — friendly by default, full ADSR under "advanced" */}
      {!advanced ? (
        <>
          <Slider
            label="Soft start (attack)"
            min={0}
            max={1}
            value={synth.envelope.attack}
            onChange={(v) => updateSynth(id, { envelope: { ...synth.envelope, attack: v } })}
            format={(v) => `${(v * 1000).toFixed(0)}ms`}
            help={HELP.attack}
            showHelp={help}
          />
          <Slider
            label="Tail (release)"
            min={0}
            max={2}
            value={synth.envelope.release}
            onChange={(v) => updateSynth(id, { envelope: { ...synth.envelope, release: v } })}
            format={(v) => `${v.toFixed(2)}s`}
            help={HELP.release}
            showHelp={help}
          />
        </>
      ) : (
        <>
          <Slider label="Attack" min={0} max={1} value={synth.envelope.attack}
            onChange={(v) => updateSynth(id, { envelope: { ...synth.envelope, attack: v } })} />
          <Slider label="Decay" min={0} max={1} value={synth.envelope.decay}
            onChange={(v) => updateSynth(id, { envelope: { ...synth.envelope, decay: v } })} />
          <Slider label="Sustain" min={0} max={1} value={synth.envelope.sustain}
            onChange={(v) => updateSynth(id, { envelope: { ...synth.envelope, sustain: v } })} />
          <Slider label="Release" min={0} max={2} value={synth.envelope.release}
            onChange={(v) => updateSynth(id, { envelope: { ...synth.envelope, release: v } })} />
        </>
      )}
      {synth.engine === 'mono' && (
        <Slider
          label="Glide"
          min={0}
          max={0.3}
          value={synth.glide}
          onChange={(v) => updateSynth(id, { glide: v })}
          format={(v) => `${(v * 1000).toFixed(0)}ms`}
          help={HELP.glide}
          showHelp={help}
        />
      )}
      <button
        className="text-[11px] text-white/40 underline self-start"
        onClick={() => setAdvanced((a) => !a)}
      >
        {advanced ? 'simple envelope' : 'advanced envelope'}
      </button>

      <div className="h-px bg-edge" />

      {/* Effects: toggle + one knob each */}
      <h3 className="text-[10px] uppercase tracking-wider text-white/50 font-bold">Effects</h3>
      {help && <p className="text-[10px] text-white/45 leading-snug -mt-2">{HELP.effects}</p>}
      <EffectRow
        name="Distortion"
        enabled={fx('distortion').enabled}
        onToggle={() => toggleEffect(id, 'distortion')}
        knobLabel="Amount"
        value={fx('distortion').params.amount ?? 0.3}
        onChange={(v) => updateEffect(id, 'distortion', { amount: v })}
        help={help ? HELP.distortion : undefined}
      />
      <EffectRow
        name="Reverb"
        enabled={fx('reverb').enabled}
        onToggle={() => toggleEffect(id, 'reverb')}
        knobLabel="Wet"
        value={fx('reverb').params.wet ?? 0.3}
        onChange={(v) => updateEffect(id, 'reverb', { wet: v })}
        help={help ? HELP.reverb : undefined}
      />
      <EffectRow
        name="Delay"
        enabled={fx('delay').enabled}
        onToggle={() => toggleEffect(id, 'delay')}
        knobLabel="Wet"
        value={fx('delay').params.wet ?? 0.3}
        onChange={(v) => updateEffect(id, 'delay', { wet: v })}
        help={help ? HELP.delay : undefined}
      />
    </div>
  );
}

function EffectRow(props: {
  name: string;
  enabled: boolean;
  onToggle: () => void;
  knobLabel: string;
  value: number;
  onChange: (v: number) => void;
  help?: string;
}) {
  return (
    <div className={`rounded-xl border-2 p-2 ${props.enabled ? 'border-lead' : 'border-edge'}`}>
      <button
        onClick={props.onToggle}
        className="flex items-center justify-between w-full font-bold text-sm mb-1"
      >
        <span>{props.name}</span>
        <span className={props.enabled ? 'text-lead' : 'text-white/30'}>
          {props.enabled ? 'ON' : 'OFF'}
        </span>
      </button>
      {props.help && <p className="text-[10px] text-white/45 leading-snug mb-1">{props.help}</p>}
      {props.enabled && (
        <Slider label={props.knobLabel} min={0} max={1} value={props.value} onChange={props.onChange} />
      )}
    </div>
  );
}
