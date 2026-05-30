import { STEPS_PER_BAR } from './constants';

// Helpers translating our 16th-note step grid to/from Tone musical time.
// A "step" is one 16th note. Tone time "16n" = one sixteenth.

/** A step index -> Tone time string in Bars:Beats:Sixteenths ("0:0:0"). */
export function stepToBarsBeats(step: number): string {
  const bar = Math.floor(step / STEPS_PER_BAR);
  const within = step % STEPS_PER_BAR; // 0..15
  const beat = Math.floor(within / 4); // 4 sixteenths per beat
  const sixteenth = within % 4;
  return `${bar}:${beat}:${sixteenth}`;
}

/** Number of steps in N bars. */
export const barsToSteps = (bars: number) => bars * STEPS_PER_BAR;

/** Tone loop-length notation for N bars, e.g. 2 -> "2m". */
export const barsToToneLength = (bars: number) => `${bars}m`;

/** A duration in steps -> Tone notation ("2*16n" style is awkward; use sixteenths count). */
export const stepsToToneDuration = (steps: number) => `${Math.max(1, steps)}*16n`;
