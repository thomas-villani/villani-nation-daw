// The entire app is a view onto, and editor of, one Project object (spec §3).
// Save = serialize to JSON. Load = hydrate. Export = walk the arrangement and render.
//
// Phases 1-2 wire up: bpm, swing, key, instruments, clips. `sections`/`arrangement`
// are defined here (the spine) but left empty until phase 5 (Song view).

export type ScaleName = 'majPent' | 'minPent' | 'major' | 'minor';

export interface Project {
  version: 1;
  name: string;
  bpm: number; // global tempo
  swing: number; // 0..1, Tone.Transport.swing
  key: {
    root: number; // 0..11 (C..B)
    scale: ScaleName;
  };
  instruments: Instrument[];
  clips: Clip[];
  sections: Section[];
  arrangement: string[]; // ordered list of Section ids = the song timeline (phase 5)
}

export type InstrumentKind = 'synth' | 'sampler' | 'drumkit';
export type SynthEngine = 'mono' | 'poly' | 'fm';
export type Waveform = 'sine' | 'triangle' | 'square' | 'sawtooth';
export type EffectType = 'distortion' | 'reverb' | 'delay' | 'filter';

export interface Instrument {
  id: string;
  name: string; // "Bass", "Lead", "Drums", "Chords"
  color: string; // track color
  kind: InstrumentKind;
  synth?: SynthConfig; // when kind === 'synth'
  sampler?: { sampleUrls: Record<number, string> }; // midi -> url
  drumkit?: DrumKit; // when kind === 'drumkit'

  // --- mixer channel state (the "board"; persists with the project) ---
  volume: number; // 0..1, channel fader
  mute: boolean;
  solo: boolean; // when any channel is soloed, non-soloed channels are silenced
  pan: number; // -1..1
  effects: EffectConfig[]; // ordered chain (filter, distortion, reverb, delay)
}

export interface SynthConfig {
  engine: SynthEngine;
  voices: number; // 1–3
  detune: number; // cents, spreads voices for thickness
  wave: Waveform;
  filter: { type: 'lowpass'; cutoff: number; resonance: number };
  envelope: { attack: number; decay: number; sustain: number; release: number };
  glide: number; // portamento (mono only)
}

export interface EffectConfig {
  type: EffectType;
  enabled: boolean;
  // A small, normalized (0..1) param bag — interpreted per effect by audio/effects.ts.
  // distortion: { amount }; reverb: { wet }; delay: { wet, feedback, time }
  params: Record<string, number>;
}

export interface DrumKit {
  pads: DrumPad[]; // Kick, Snare, Hat, Clap, ... (extensible)
}

export type ProceduralId = 'kick' | 'snare' | 'hat' | 'clap';

export interface DrumPad {
  name: string;
  source: 'procedural' | 'sample';
  proceduralId?: ProceduralId;
  sampleUrl?: string; // user-loaded or bundled
  gain: number; // 0..1, per-pad level (kit sub-mixer)
  mute: boolean; // per-pad mute
}

// A Clip is a short, loopable pattern for ONE instrument.
export interface Clip {
  id: string;
  instrumentId: string;
  name: string; // "Main beat", "Drop bass", "Bridge melody"
  lengthBars: number; // usually 1, 2, or 4
  notes?: Note[]; // melodic instruments
  steps?: DrumStep[]; // drum instruments
}

export interface Note {
  // Store as SCALE DEGREE + octave, NOT absolute pitch — see spec §3.1.
  degree: number; // index into the active scale
  octave: number; // octave offset
  start: number; // in 16th-note steps from clip start
  duration: number; // in 16th-note steps
  velocity: number; // 0..1
}

export interface DrumStep {
  padIndex: number;
  step: number; // 16th-note step
  velocity: number;
}

// --- Phase 5 spine (defined now, wired later) ---

export type SectionType =
  | 'intro'
  | 'verse'
  | 'build'
  | 'drop'
  | 'bridge'
  | 'breakdown'
  | 'outro';

export interface Section {
  id: string;
  name: string;
  type: SectionType;
  lengthBars: number;
  clipAssignments: Record<string /*instrumentId*/, string | null /*clipId | silent*/>;
  automation: AutomationLane[];
}

export interface AutomationLane {
  instrumentId: string;
  param: 'filter.cutoff' | 'volume' | 'effect.reverb.wet' | 'effect.delay.wet';
  from: number;
  to: number;
  curve: 'linear' | 'exponential';
}
