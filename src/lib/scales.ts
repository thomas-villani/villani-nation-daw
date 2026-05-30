// The "no wrong notes" lynchpin (spec §3.1).
//
// Notes are stored as scale DEGREE + octave, never absolute pitch. We resolve
// degree+octave -> MIDI -> frequency only at playback / audition time using the
// project's current key. So changing key.root or key.scale re-pitches the whole
// song in-key with ZERO data migration.

import type { Note, Project, ScaleName } from '../model/types';

// Semitone offsets from the root, ascending within one octave.
export const SCALES: Record<ScaleName, number[]> = {
  majPent: [0, 2, 4, 7, 9], // happy, 5 degrees (default)
  minPent: [0, 3, 5, 7, 10], // moody, 5 degrees
  major: [0, 2, 4, 5, 7, 9, 11], // 7 degrees
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor, 7 degrees
};

export const scaleLength = (scale: ScaleName) => SCALES[scale].length;

// Chord shapes as DIATONIC scale-step offsets stacked above the played degree
// (spec §5.3, phase-4 chord stamp). Because they're scale steps — not semitones —
// every stamped chord stays in-key for ANY key/scale, so there are still no wrong
// notes. Stacking thirds (0,2,4,6) in a 7-note scale gives real triads/7ths; in a
// 5-note pentatonic the same offsets give pleasant in-scale stacks.
export type ChordShape = 'triad' | 'power' | 'seventh' | 'sus';

export const CHORD_SHAPES: Record<ChordShape, number[]> = {
  triad: [0, 2, 4], // 1-3-5
  power: [0, 4], // root + fifth (no third)
  seventh: [0, 2, 4, 6], // 1-3-5-7
  sus: [0, 3, 4], // 1-4-5 (suspended)
};

export const CHORD_LABELS: Record<ChordShape, string> = {
  triad: 'Triad',
  power: 'Power',
  seventh: '7th',
  sus: 'Sus',
};

// Octave anchor: degree 0 / octave 0 (the kid's "home" row) sits at C3 (MIDI 48),
// placing the default playing range comfortably in the middle.
const BASE_OCTAVE_MIDI = 48;

export const baseMidi = (root: number) => BASE_OCTAVE_MIDI + root;

/**
 * Resolve a scale degree + octave to a MIDI note number (spec §3.1).
 * Wrap-safe: degrees beyond one octave (or negative) roll into adjacent octaves,
 * so the piano roll can show multiple octaves of in-key rows seamlessly.
 *
 *   midi = baseMidi(root) + 12*octave + SCALES[scale][degree % len] + 12*floor(degree / len)
 */
export function degreeToMidi(
  degree: number,
  octave: number,
  root: number,
  scale: ScaleName,
): number {
  const tbl = SCALES[scale];
  const len = tbl.length;
  const wrapped = ((degree % len) + len) % len; // handle negatives
  const octaveFromDegree = Math.floor(degree / len);
  return baseMidi(root) + 12 * octave + tbl[wrapped] + 12 * octaveFromDegree;
}

/** Equal-tempered MIDI -> frequency (A4 = MIDI 69 = 440 Hz). */
export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** Convenience: resolve a stored Note straight to a frequency for the given key. */
export const noteToFreq = (note: Note, key: Project['key']): number =>
  midiToFreq(degreeToMidi(note.degree, note.octave, key.root, key.scale));

// Note-name labels (cosmetic — shown faded on the piano roll so kids learn pitch
// names without it affecting the scale-locked logic).
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiToName = (midi: number): string => {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1; // MIDI 60 = C4
  return `${name}${octave}`;
};

export const ROOT_NAMES = NOTE_NAMES;
