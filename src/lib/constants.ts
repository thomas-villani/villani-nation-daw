import type { ProceduralId } from '../model/types';

export const STEPS_PER_BAR = 16; // 16th-note grid

// Default drum kit pad set (kick/snare/hat/clap), spec §3 / §5.7.
export const DEFAULT_PADS: { name: string; proceduralId: ProceduralId }[] = [
  { name: 'Kick', proceduralId: 'kick' },
  { name: 'Snare', proceduralId: 'snare' },
  { name: 'Hat', proceduralId: 'hat' },
  { name: 'Clap', proceduralId: 'clap' },
];

// Track colors (match tailwind.config.js palette).
export const TRACK_COLORS = {
  bass: '#ff6b9d',
  lead: '#4ee0ff',
  chord: '#9b7bff',
  drum: '#ff924e',
} as const;

// How many in-key octaves the piano roll shows (above the home/root row).
export const ROLL_OCTAVE_SPAN = 2;
