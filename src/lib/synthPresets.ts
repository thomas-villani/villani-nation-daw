import type { SynthConfig } from '../model/types';
import { makeSynthConfig } from '../model/defaults';

// Kid-facing "sounds" (#3). Each preset is a COMPLETE SynthConfig, so tapping one
// stamps the whole voice — engine, wave, voices/detune, filter, and envelope all
// jump at once. The point is exploration: a kid taps a sound, *sees* every control
// move, then tweaks from there. Stamped via updateSynthConfig (a shallow merge),
// which is why each preset carries full `filter`/`envelope` objects.

export interface SynthPreset {
  id: string;
  emoji: string;
  name: string;
  config: SynthConfig;
}

export const SYNTH_PRESETS: SynthPreset[] = [
  {
    id: 'deepbass',
    emoji: '🔊',
    name: 'Deep Bass',
    config: makeSynthConfig({
      engine: 'mono',
      wave: 'sawtooth',
      voices: 1,
      detune: 0,
      filter: { type: 'lowpass', cutoff: 600, resonance: 3 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.2 },
      glide: 0.04,
    }),
  },
  {
    id: 'buzzbass',
    emoji: '🐝',
    name: 'Buzzy Bass',
    config: makeSynthConfig({
      engine: 'mono',
      wave: 'sawtooth',
      voices: 3,
      detune: 18,
      filter: { type: 'lowpass', cutoff: 1200, resonance: 6 },
      envelope: { attack: 0.01, decay: 0.15, sustain: 0.6, release: 0.15 },
      glide: 0,
    }),
  },
  {
    id: 'brightlead',
    emoji: '✨',
    name: 'Bright Lead',
    config: makeSynthConfig({
      engine: 'mono',
      wave: 'sawtooth',
      voices: 2,
      detune: 14,
      filter: { type: 'lowpass', cutoff: 5000, resonance: 2 },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.3 },
      glide: 0,
    }),
  },
  {
    id: 'softpad',
    emoji: '☁️',
    name: 'Soft Pad',
    config: makeSynthConfig({
      engine: 'poly',
      wave: 'triangle',
      voices: 2,
      detune: 8,
      filter: { type: 'lowpass', cutoff: 3000, resonance: 1 },
      envelope: { attack: 0.4, decay: 0.3, sustain: 0.8, release: 1.2 },
      glide: 0,
    }),
  },
  {
    id: 'pluck',
    emoji: '🪕',
    name: 'Pluck',
    config: makeSynthConfig({
      engine: 'poly',
      wave: 'triangle',
      voices: 1,
      detune: 0,
      filter: { type: 'lowpass', cutoff: 3500, resonance: 3 },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0, release: 0.2 },
      glide: 0,
    }),
  },
  {
    id: 'dreamy',
    emoji: '🌙',
    name: 'Dreamy',
    config: makeSynthConfig({
      engine: 'mono',
      wave: 'sine',
      voices: 2,
      detune: 10,
      filter: { type: 'lowpass', cutoff: 2500, resonance: 1 },
      envelope: { attack: 0.25, decay: 0.3, sustain: 0.7, release: 0.9 },
      glide: 0.08,
    }),
  },
  {
    id: 'fmbell',
    emoji: '🔔',
    name: 'FM Bell',
    config: makeSynthConfig({
      engine: 'fm',
      wave: 'sine',
      voices: 1,
      detune: 0,
      filter: { type: 'lowpass', cutoff: 6000, resonance: 1 },
      envelope: { attack: 0.005, decay: 0.5, sustain: 0.2, release: 0.6 },
      glide: 0,
    }),
  },
  {
    id: 'organ',
    emoji: '🎹',
    name: 'Organ',
    config: makeSynthConfig({
      engine: 'poly',
      wave: 'square',
      voices: 1,
      detune: 0,
      filter: { type: 'lowpass', cutoff: 2200, resonance: 1 },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.9, release: 0.2 },
      glide: 0,
    }),
  },
];
