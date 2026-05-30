import * as Tone from 'tone';
import type { ProceduralId } from '../model/types';

// Procedural drum generators (spec §4.2): oscillator+envelope kick, filtered-noise
// snare/hat/clap. Each pad is a tiny factory exposing a uniform interface so the
// kit (and later the arrangement walker) can trigger them identically.

export interface PadGenerator {
  output: Tone.ToneAudioNode;
  /** Trigger at a sample-accurate transport time (seconds on the audio clock). */
  trigger(time: number, velocity: number): void;
  dispose(): void;
}

function makeKick(): PadGenerator {
  const synth = new Tone.MembraneSynth({
    octaves: 4,
    pitchDecay: 0.05,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
  });
  return {
    output: synth,
    trigger: (time, velocity) => synth.triggerAttackRelease('C1', '8n', time, velocity),
    dispose: () => synth.dispose(),
  };
}

function makeSnare(): PadGenerator {
  // Noise "crack" through a highpass, summed with a short tonal "body".
  const out = new Tone.Gain();
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
  });
  const hp = new Tone.Filter(1200, 'highpass');
  noise.connect(hp);
  hp.connect(out);

  const body = new Tone.MembraneSynth({
    octaves: 2,
    pitchDecay: 0.02,
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  });
  const bodyGain = new Tone.Gain(0.4);
  body.connect(bodyGain);
  bodyGain.connect(out);

  return {
    output: out,
    trigger: (time, velocity) => {
      noise.triggerAttackRelease('16n', time, velocity);
      body.triggerAttackRelease('A2', '16n', time, velocity * 0.8);
    },
    dispose: () => {
      noise.dispose();
      hp.dispose();
      body.dispose();
      bodyGain.dispose();
      out.dispose();
    },
  };
}

function makeHat(): PadGenerator {
  // Very short filtered noise burst.
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.03, sustain: 0 },
  });
  const hp = new Tone.Filter(8000, 'highpass');
  noise.connect(hp);
  return {
    output: hp,
    trigger: (time, velocity) => noise.triggerAttackRelease('32n', time, velocity),
    dispose: () => {
      noise.dispose();
      hp.dispose();
    },
  };
}

function makeClap(): PadGenerator {
  // Bandpassed noise with a snappy multi-burst feel.
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.12, sustain: 0 },
  });
  const bp = new Tone.Filter({ type: 'bandpass', frequency: 1200, Q: 1.4 });
  noise.connect(bp);
  return {
    output: bp,
    trigger: (time, velocity) => {
      // Three quick retriggers a few ms apart give the classic clap texture.
      noise.triggerAttackRelease('32n', time, velocity);
      noise.triggerAttackRelease('32n', time + 0.012, velocity * 0.7);
      noise.triggerAttackRelease('16n', time + 0.024, velocity);
    },
    dispose: () => {
      noise.dispose();
      bp.dispose();
    },
  };
}

const FACTORIES: Record<ProceduralId, () => PadGenerator> = {
  kick: makeKick,
  snare: makeSnare,
  hat: makeHat,
  clap: makeClap,
};

export function makeProceduralPad(proceduralId: ProceduralId): PadGenerator {
  return FACTORIES[proceduralId]();
}

/** A sample pad backed by a one-shot Player (user drag-drop or bundled). */
export function makeSamplePad(url: string): PadGenerator {
  const player = new Tone.Player({ url, autostart: false });
  return {
    output: player,
    trigger: (time, velocity) => {
      // Player has no per-trigger velocity; scale via its volume just-in-time.
      player.volume.setValueAtTime(Tone.gainToDb(Math.max(0.001, velocity)), time);
      player.start(time);
    },
    dispose: () => player.dispose(),
  };
}
