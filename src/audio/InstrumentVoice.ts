import * as Tone from 'tone';
import type { DrumPad, Instrument, SynthConfig } from '../model/types';
import { buildEffectChain, type EffectChain } from './effects';
import { makeProceduralPad, makeSamplePad, type PadGenerator } from './drums';

// One InstrumentVoice owns all Tone objects for a single Instrument and exposes a
// uniform trigger surface. Signal flow (spec §4.2):
//
//   source -> [voiceFilter (synth only)] -> [effect chain] -> Panner -> Volume -> master
//
// The voiceFilter gives every engine type one consistent cutoff/resonance control
// that maps directly to the InstrumentPanel, independent of the synth internals.

type SynthNode = Tone.Synth | Tone.PolySynth;

interface KitRuntime {
  pads: { gen: PadGenerator; gain: Tone.Gain; sig: string }[];
  output: Tone.Gain;
}

/** Identity of a pad's *sound source* — used to decide when a rebuild is needed. */
const padSig = (pad: DrumPad): string =>
  pad.source === 'sample' ? `s:${pad.sampleUrl}` : `p:${pad.proceduralId}`;

export class InstrumentVoice {
  readonly id: string;
  private panner: Tone.Panner;
  private volume: Tone.Volume;
  private sourceOut: Tone.ToneAudioNode; // node that feeds the effect chain

  private synth?: SynthNode;
  private voiceFilter?: Tone.Filter;
  private kit?: KitRuntime;

  private effectChain: EffectChain;
  private effectsHash = '';
  private kind: Instrument['kind'];
  private engine: SynthConfig['engine'] | null = null;

  constructor(inst: Instrument, master: Tone.ToneAudioNode) {
    this.id = inst.id;
    this.kind = inst.kind;
    this.panner = new Tone.Panner(inst.pan);
    this.volume = new Tone.Volume(Tone.gainToDb(inst.volume));
    this.panner.connect(this.volume);
    this.volume.connect(master);

    if (inst.kind === 'drumkit') {
      this.kit = this.buildKit(inst.drumkit?.pads ?? []);
      this.sourceOut = this.kit.output;
    } else {
      // synth (sampler treated as synth-less for phase 1-2; defaults to poly synth)
      this.engine = inst.synth?.engine ?? 'poly';
      this.synth = this.buildSynth(this.engine);
      this.voiceFilter = new Tone.Filter({ type: 'lowpass', frequency: 2000, Q: 1 });
      this.synth.connect(this.voiceFilter);
      this.sourceOut = this.voiceFilter;
    }

    this.effectChain = buildEffectChain([]); // empty; rewired by applyConfig
    this.rewireEffects(inst);
    this.applyChannel(inst);
    if (this.synth) this.applySynth(inst.synth!);
  }

  // --- construction helpers ---

  private buildSynth(engine: SynthConfig['engine']): SynthNode {
    if (engine === 'mono') return new Tone.Synth(); // monophonic, supports portamento
    if (engine === 'fm') return new Tone.PolySynth(Tone.FMSynth);
    return new Tone.PolySynth(Tone.Synth);
  }

  private buildKit(pads: DrumPad[]): KitRuntime {
    const output = new Tone.Gain(1);
    const runtime: KitRuntime = { pads: [], output };
    pads.forEach((pad) => {
      const gen =
        pad.source === 'sample' && pad.sampleUrl
          ? makeSamplePad(pad.sampleUrl)
          : makeProceduralPad(pad.proceduralId ?? 'kick');
      const gain = new Tone.Gain(pad.mute ? 0 : pad.gain);
      gen.output.connect(gain);
      gain.connect(output);
      runtime.pads.push({ gen, gain, sig: padSig(pad) });
    });
    return runtime;
  }

  // --- public reconciliation surface ---

  /** Apply the full instrument config (channel + synth + effects), smart-skipping
   *  an effect-chain rebuild when the effects config is unchanged (avoids clicks). */
  applyConfig(inst: Instrument): void {
    this.applyChannel(inst);
    if (this.kind !== 'drumkit' && inst.synth) {
      // Engine type change requires a fresh synth node.
      if (inst.synth.engine !== this.engine) this.rebuildSynth(inst.synth.engine);
      this.applySynth(inst.synth);
    }
    if (this.kind === 'drumkit') this.applyKit(inst.drumkit?.pads ?? []);
    this.rewireEffects(inst);
  }

  private applyChannel(inst: Instrument): void {
    this.volume.volume.rampTo(Tone.gainToDb(Math.max(0.0001, inst.volume)), 0.02);
    this.volume.mute = inst.mute;
    this.panner.pan.rampTo(inst.pan, 0.02);
  }

  private applySynth(cfg: SynthConfig): void {
    if (!this.synth || !this.voiceFilter) return;
    const fat = cfg.voices > 1;
    const oscType = (fat ? `fat${cfg.wave}` : cfg.wave) as Tone.ToneOscillatorType;
    // fat oscillators carry count/spread; Tone's .set() union types don't expose
    // them together, so build the options bag and cast.
    const oscillator = fat
      ? { type: oscType, count: cfg.voices, spread: cfg.detune }
      : { type: oscType };
    this.synth.set({
      oscillator: oscillator as Parameters<SynthNode['set']>[0]['oscillator'],
      envelope: {
        attack: cfg.envelope.attack,
        decay: cfg.envelope.decay,
        sustain: cfg.envelope.sustain,
        release: cfg.envelope.release,
      },
    });
    // Glide (portamento) is meaningful for the monophonic engine only.
    if (this.engine === 'mono') (this.synth as Tone.Synth).portamento = cfg.glide;
    this.voiceFilter.frequency.rampTo(cfg.filter.cutoff, 0.02);
    this.voiceFilter.Q.rampTo(cfg.filter.resonance, 0.02);
  }

  private rebuildSynth(engine: SynthConfig['engine']): void {
    this.synth?.disconnect();
    this.synth?.dispose();
    this.engine = engine;
    this.synth = this.buildSynth(engine);
    this.synth.connect(this.voiceFilter!);
  }

  private applyKit(pads: DrumPad[]): void {
    if (!this.kit) return;
    // If pad count/sources changed, rebuild the whole kit; else just update gains.
    const sameShape =
      pads.length === this.kit.pads.length &&
      pads.every((p, i) => padSig(p) === this.kit!.pads[i].sig);
    if (!sameShape) {
      this.kit.pads.forEach((p) => {
        p.gen.dispose();
        p.gain.dispose();
      });
      this.kit.output.disconnect();
      const rebuilt = this.buildKit(pads);
      // Splice new kit output into the chain in place of the old one.
      this.kit.output.dispose();
      this.kit = rebuilt;
      this.sourceOut = rebuilt.output;
      this.effectsHash = ''; // force rewireEffects to reconnect the new source
    }
    pads.forEach((pad, i) => {
      const slot = this.kit!.pads[i];
      if (slot) slot.gain.gain.rampTo(pad.mute ? 0 : pad.gain, 0.02);
    });
  }

  private rewireEffects(inst: Instrument): void {
    const hash = JSON.stringify(inst.effects);
    if (hash === this.effectsHash) return; // unchanged — no rebuild (avoids clicks)
    this.effectsHash = hash;

    this.sourceOut.disconnect();
    this.effectChain.dispose();
    this.effectChain = buildEffectChain(inst.effects);
    if (this.effectChain.input && this.effectChain.output) {
      this.sourceOut.connect(this.effectChain.input);
      this.effectChain.output.connect(this.panner);
    } else {
      this.sourceOut.connect(this.panner);
    }
  }

  // --- triggers (called from scheduler Part callbacks with sample-accurate time) ---

  triggerNote(freq: number, durationSec: number, time: number, velocity: number): void {
    this.synth?.triggerAttackRelease(freq, durationSec, time, velocity);
  }

  triggerPad(padIndex: number, time: number, velocity: number): void {
    this.kit?.pads[padIndex]?.gen.trigger(time, velocity);
  }

  dispose(): void {
    this.synth?.dispose();
    this.voiceFilter?.dispose();
    this.kit?.pads.forEach((p) => {
      p.gen.dispose();
      p.gain.dispose();
    });
    this.kit?.output.dispose();
    this.effectChain.dispose();
    this.panner.dispose();
    this.volume.dispose();
  }
}
