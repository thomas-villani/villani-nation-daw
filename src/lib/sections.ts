// Phase 5 — Song view templates (spec §5.4).
//
// A Section is a chunk of song time. Each SectionType carries a kid-friendly
// preset: a label/emoji/color, a default length, which instrument KINDS it
// silences, and the automation "moves" it pre-fills (e.g. a build sweeps the
// filter open, an outro fades out). Templates pre-fill sensible defaults so a kid
// gets a satisfying arrangement without understanding automation — they can then
// tweak any of it in the section inspector.
//
// This module imports only the data types (no Tone, no store), so it's shared by
// the model factory (makeSection), the engine (param ranges), and the UI (labels).

import type {
  AutomationLane,
  Instrument,
  InstrumentKind,
  SectionType,
} from '../model/types';

export type AutomatableParam = AutomationLane['param'];

// Friendly cutoff anchor points for filter automation (Hz). "Muffled" = closed,
// dark; "open" = bright. These are the two ends of the classic build-up sweep.
export const CUTOFF_MUFFLED = 500;
export const CUTOFF_OPEN = 7000;

const isMelodic = (inst: Instrument) => inst.kind !== 'drumkit';

// --- automation builders (per template) ---------------------------------------

/** A filter sweep on every melodic track (drums have no tunable filter). */
function filterSweep(instruments: Instrument[], from: number, to: number): AutomationLane[] {
  return instruments.filter(isMelodic).map((inst) => ({
    instrumentId: inst.id,
    param: 'filter.cutoff' as const,
    from,
    to,
    curve: 'exponential' as const, // exponential reads as a more natural sweep
  }));
}

/** A volume move (via the section automation gain, 0..1) on every track. */
function volumeMove(instruments: Instrument[], from: number, to: number): AutomationLane[] {
  return instruments.map((inst) => ({
    instrumentId: inst.id,
    param: 'volume' as const,
    from,
    to,
    curve: 'linear' as const,
  }));
}

export interface SectionTemplate {
  label: string;
  emoji: string;
  color: string; // block color on the timeline
  defaultBars: number;
  silentKinds: InstrumentKind[]; // instrument kinds this section silences by default
  automation(instruments: Instrument[]): AutomationLane[];
}

// The seven section types, in the order they appear in the palette / a typical
// song. Colors are picked to read as a left-to-right energy arc.
export const SECTION_TEMPLATES: Record<SectionType, SectionTemplate> = {
  intro: {
    label: 'Intro',
    emoji: '🌅',
    color: '#6c7a89',
    defaultBars: 4,
    silentKinds: [],
    // Fade in from silence so the song eases in.
    automation: (insts) => volumeMove(insts, 0, 1),
  },
  verse: {
    label: 'Verse',
    emoji: '🎵',
    color: '#4ee0ff',
    defaultBars: 8,
    silentKinds: [],
    automation: () => [], // steady — the song at home
  },
  build: {
    label: 'Build',
    emoji: '📈',
    color: '#ffd34e',
    defaultBars: 4,
    silentKinds: [],
    // The classic tension move: sweep filters open + swell the volume.
    automation: (insts) => [
      ...filterSweep(insts, CUTOFF_MUFFLED, CUTOFF_OPEN),
      ...volumeMove(insts, 0.55, 1),
    ],
  },
  drop: {
    label: 'Drop',
    emoji: '🔥',
    color: '#ff6b9d',
    defaultBars: 8,
    silentKinds: [],
    automation: () => [], // full instrumentation at home — where the build resolves
  },
  bridge: {
    label: 'Bridge',
    emoji: '🌉',
    color: '#9b7bff',
    defaultBars: 8,
    silentKinds: ['drumkit'], // thin it out — drop the drums
    automation: () => [],
  },
  breakdown: {
    label: 'Breakdown',
    emoji: '🕳️',
    color: '#7c6f9e',
    defaultBars: 4,
    silentKinds: ['drumkit'],
    // Strip back: muffle the melodic tracks down.
    automation: (insts) => filterSweep(insts, CUTOFF_OPEN, CUTOFF_MUFFLED),
  },
  outro: {
    label: 'Outro',
    emoji: '🌇',
    color: '#ff924e',
    defaultBars: 4,
    silentKinds: [],
    automation: (insts) => volumeMove(insts, 1, 0), // the fade-out
  },
};

export const SECTION_TYPE_ORDER: SectionType[] = [
  'intro',
  'verse',
  'build',
  'drop',
  'bridge',
  'breakdown',
  'outro',
];

// A default full-song shape assembled by "✨ Auto-arrange" (spec §5.6).
export const AUTO_ARRANGE_SHAPE: SectionType[] = [
  'intro',
  'verse',
  'build',
  'drop',
  'bridge',
  'build',
  'drop',
  'outro',
];

// --- friendly descriptions (for the inspector) --------------------------------

export const PARAM_LABELS: Record<AutomatableParam, string> = {
  'filter.cutoff': 'Filter',
  volume: 'Volume',
  'effect.reverb.wet': 'Reverb',
  'effect.delay.wet': 'Delay',
};

/** Describe a param value in kid words for the automation snapshot. */
function describeValue(param: AutomatableParam, v: number): string {
  if (param === 'filter.cutoff') {
    if (v <= 700) return 'muffled';
    if (v >= 5000) return 'open';
    return 'mid';
  }
  // 0..1 params (volume / wet)
  if (v <= 0.02) return 'silent';
  if (v >= 0.98) return 'full';
  return `${Math.round(v * 100)}%`;
}

/** "Filter: muffled → open" style summary of one automation lane. */
export function automationSummary(lane: AutomationLane): string {
  return `${PARAM_LABELS[lane.param]}: ${describeValue(lane.param, lane.from)} → ${describeValue(
    lane.param,
    lane.to,
  )}`;
}

// --- presets for the inspector's "+ add move" ---------------------------------

export interface AutomationPreset {
  id: string;
  label: string;
  make(instrumentId: string): AutomationLane;
}

export const AUTOMATION_PRESETS: AutomationPreset[] = [
  {
    id: 'sweep-open',
    label: 'Filter opens 🔆',
    make: (instrumentId) => ({
      instrumentId,
      param: 'filter.cutoff',
      from: CUTOFF_MUFFLED,
      to: CUTOFF_OPEN,
      curve: 'exponential',
    }),
  },
  {
    id: 'sweep-muffle',
    label: 'Filter muffles 🌫️',
    make: (instrumentId) => ({
      instrumentId,
      param: 'filter.cutoff',
      from: CUTOFF_OPEN,
      to: CUTOFF_MUFFLED,
      curve: 'exponential',
    }),
  },
  {
    id: 'swell',
    label: 'Volume swells 📈',
    make: (instrumentId) => ({
      instrumentId,
      param: 'volume',
      from: 0.5,
      to: 1,
      curve: 'linear',
    }),
  },
  {
    id: 'fade-out',
    label: 'Fade out 🌇',
    make: (instrumentId) => ({
      instrumentId,
      param: 'volume',
      from: 1,
      to: 0,
      curve: 'linear',
    }),
  },
];
