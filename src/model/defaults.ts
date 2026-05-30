import { DEFAULT_PADS, TRACK_COLORS } from '../lib/constants';
import { SECTION_TEMPLATES } from '../lib/sections';
import { id } from './ids';
import type {
  Clip,
  DrumKit,
  DrumStep,
  EffectConfig,
  Instrument,
  Note,
  Project,
  Section,
  SectionType,
  SynthConfig,
} from './types';

export function makeSynthConfig(over: Partial<SynthConfig> = {}): SynthConfig {
  return {
    engine: 'mono',
    voices: 2,
    detune: 12,
    wave: 'sawtooth',
    filter: { type: 'lowpass', cutoff: 1800, resonance: 2 },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
    glide: 0,
    ...over,
  };
}

export function makeDefaultEffects(): EffectConfig[] {
  // Ordered chain. All start disabled so the dry sound is heard first; a kid
  // toggles each on. Params are normalized 0..1 (interpreted in audio/effects.ts).
  return [
    { type: 'distortion', enabled: false, params: { amount: 0.3 } },
    { type: 'reverb', enabled: false, params: { wet: 0.3 } },
    { type: 'delay', enabled: false, params: { wet: 0.3, feedback: 0.3, time: 0.25 } },
  ];
}

export function makeSynthInstrument(
  name: string,
  color: string,
  synth: Partial<SynthConfig> = {},
): Instrument {
  return {
    id: id(),
    name,
    color,
    kind: 'synth',
    synth: makeSynthConfig(synth),
    volume: 0.8,
    mute: false,
    solo: false,
    pan: 0,
    effects: makeDefaultEffects(),
  };
}

export function makeDrumKit(): DrumKit {
  return {
    pads: DEFAULT_PADS.map((p) => ({
      name: p.name,
      source: 'procedural' as const,
      proceduralId: p.proceduralId,
      gain: 0.9,
      mute: false,
    })),
  };
}

export function makeDrumInstrument(): Instrument {
  return {
    id: id(),
    name: 'Drums',
    color: TRACK_COLORS.drum,
    kind: 'drumkit',
    drumkit: makeDrumKit(),
    volume: 0.9,
    mute: false,
    solo: false,
    pan: 0,
    effects: makeDefaultEffects(),
  };
}

export function makeClip(
  instrumentId: string,
  name: string,
  opts: { lengthBars?: number; notes?: Note[]; steps?: DrumStep[] } = {},
): Clip {
  return {
    id: id(),
    instrumentId,
    name,
    lengthBars: opts.lengthBars ?? 1,
    notes: opts.notes,
    steps: opts.steps,
  };
}

/**
 * Build a Section from its type template (spec §5.4). Clip assignments stay SPARSE
 * — a missing entry means "play this instrument's default clip", exactly like the
 * jam's active-clip fallback. We only write an explicit `null` for instruments the
 * template silences (e.g. drums in a bridge), so adding tracks later needs no
 * section bookkeeping. Automation moves come pre-filled from the template.
 */
export function makeSection(type: SectionType, instruments: Instrument[]): Section {
  const tmpl = SECTION_TEMPLATES[type];
  const clipAssignments: Record<string, string | null> = {};
  for (const inst of instruments) {
    if (tmpl.silentKinds.includes(inst.kind)) clipAssignments[inst.id] = null;
  }
  return {
    id: id(),
    name: tmpl.label,
    type,
    lengthBars: tmpl.defaultBars,
    clipAssignments,
    automation: tmpl.automation(instruments),
  };
}

// A classic four-on-the-floor-ish starter beat so the app is fun on first Play.
function starterBeatSteps(): DrumStep[] {
  const steps: DrumStep[] = [];
  // Kick (pad 0) on every beat.
  [0, 4, 8, 12].forEach((s) => steps.push({ padIndex: 0, step: s, velocity: 1 }));
  // Snare (pad 1) on the backbeat.
  [4, 12].forEach((s) => steps.push({ padIndex: 1, step: s, velocity: 0.9 }));
  // Hat (pad 2) on the offbeats.
  [2, 6, 10, 14].forEach((s) => steps.push({ padIndex: 2, step: s, velocity: 0.7 }));
  return steps;
}

// A simple in-scale bass pulse following the root (degrees into majPent).
function starterBassNotes(): Note[] {
  const pattern: number[] = [0, 0, 2, 0, 4, 0, 2, 0]; // scale degrees
  return pattern.map((degree, i) => ({
    degree,
    octave: -1, // an octave below home for bass weight
    start: i * 2, // every 8th note
    duration: 2,
    velocity: 0.85,
  }));
}

/** The project a kid sees on first open: drums + bass, both with a starter clip. */
export function makeDefaultProject(): Project {
  const drums = makeDrumInstrument();
  const bass = makeSynthInstrument('Bass', TRACK_COLORS.bass, {
    engine: 'mono',
    wave: 'sawtooth',
    filter: { type: 'lowpass', cutoff: 900, resonance: 4 },
  });

  const drumClip = makeClip(drums.id, 'Main beat', { steps: starterBeatSteps() });
  const bassClip = makeClip(bass.id, 'Main bass', { notes: starterBassNotes() });

  return {
    version: 1,
    name: 'My First Jam',
    bpm: 100,
    swing: 0,
    key: { root: 0, scale: 'majPent' }, // C major pentatonic
    instruments: [drums, bass],
    clips: [drumClip, bassClip],
    sections: [],
    arrangement: [],
  };
}
