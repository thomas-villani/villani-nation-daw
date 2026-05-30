// ✨ "Surprise" generators (spec §5.6). These operate ONLY on the model — they
// return plain `DrumStep[]` / `Note[]` that the store writes into a clip. They never
// touch audio, and because notes are stored as scale DEGREE + octave, everything they
// make is automatically in-key for any key/scale (the "no wrong notes" rule holds).
//
// Variety is the point ("surprise!"), so these use Math.random — each click yields a
// fresh-but-tasteful pattern. The randomness is bounded to musical choices, so the
// result always grooves.

import { STEPS_PER_BAR } from './constants';
import { scaleLength } from './scales';
import type { DrumStep, Note, ScaleName } from '../model/types';

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const chance = (p: number) => Math.random() < p;

// Pad layout follows DEFAULT_PADS: 0 = Kick, 1 = Snare, 2 = Hat, 3 = Clap. We guard
// on padCount so a custom kit with fewer pads still gets a sensible beat.

/** Kick on the beats, backbeat snare, a hat pattern, the odd clap accent. */
export function surpriseBeat(padCount: number): DrumStep[] {
  const steps: DrumStep[] = [];
  const has = (i: number) => i < padCount;

  if (has(0)) {
    // Four-on-the-floor with optional syncopated pushes for flavor.
    [0, 4, 8, 12].forEach((s) => steps.push({ padIndex: 0, step: s, velocity: 1 }));
    if (chance(0.5)) steps.push({ padIndex: 0, step: 14, velocity: 0.7 });
    if (chance(0.3)) steps.push({ padIndex: 0, step: 7, velocity: 0.6 });
  }
  if (has(1)) {
    [4, 12].forEach((s) => steps.push({ padIndex: 1, step: s, velocity: 0.9 }));
  }
  if (has(2)) {
    const every = chance(0.5) ? 2 : 1; // straight 8ths or busy 16ths
    for (let s = 0; s < STEPS_PER_BAR; s += every) {
      if (chance(0.85)) {
        steps.push({ padIndex: 2, step: s, velocity: s % 4 === 0 ? 0.8 : 0.55 });
      }
    }
  }
  if (has(3) && chance(0.6)) {
    pick<number[]>([[4, 12], [12], [4, 12, 14]]).forEach((s) =>
      steps.push({ padIndex: 3, step: s, velocity: 0.7 }),
    );
  }
  return steps;
}

/** A root-led pulse: mostly the home note, wandering to a couple of safe tones. */
export function surpriseBass(_scale: ScaleName, lengthBars: number): Note[] {
  const notes: Note[] = [];
  const stepsTotal = STEPS_PER_BAR * Math.max(1, lengthBars);
  const palette = [0, 0, 0, 2, 4]; // scale degrees, weighted toward the root
  for (let s = 0; s < stepsTotal; s += 2) {
    if (chance(0.85)) {
      notes.push({ degree: pick(palette), octave: -1, start: s, duration: 2, velocity: 0.85 });
    }
  }
  return notes;
}

/** Sparse, singable melody with rests — notes land on a subset of 8th-note slots. */
export function surpriseMelody(scale: ScaleName, lengthBars: number): Note[] {
  const len = scaleLength(scale);
  const range = len + Math.floor(len / 2); // ~1.5 octaves of in-key rows
  const stepsTotal = STEPS_PER_BAR * Math.max(1, lengthBars);
  const notes: Note[] = [];
  for (let s = 0; s < stepsTotal; s += 2) {
    if (chance(0.45)) {
      notes.push({
        degree: Math.floor(Math.random() * range),
        octave: 0,
        start: s,
        duration: pick([2, 2, 4]),
        velocity: 0.8,
      });
    }
  }
  // Always leave the kid with at least a few notes so a click does something audible.
  if (notes.length < 3) {
    for (const s of [0, 4, 8]) {
      if (!notes.some((n) => n.start === s)) {
        notes.push({
          degree: Math.floor(Math.random() * range),
          octave: 0,
          start: s,
          duration: 2,
          velocity: 0.8,
        });
      }
    }
  }
  return notes;
}

/** A canned diatonic progression (I–V–vi–IV) stamped as scale-step triads. */
export function surpriseChords(_scale: ScaleName, lengthBars: number): Note[] {
  const progression = [0, 4, 5, 3]; // I–V–vi–IV as scale-degree roots
  const shape = [0, 2, 4]; // a diatonic triad in scale steps (always in-key)
  const bars = Math.max(1, lengthBars);
  const notes: Note[] = [];
  for (let bar = 0; bar < bars; bar++) {
    const root = progression[bar % progression.length];
    for (const off of shape) {
      notes.push({
        degree: root + off,
        octave: 0,
        start: bar * STEPS_PER_BAR,
        duration: STEPS_PER_BAR, // hold the whole bar
        velocity: 0.7,
      });
    }
  }
  return notes;
}
