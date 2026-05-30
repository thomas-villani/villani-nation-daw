import * as Tone from 'tone';
import type { Clip, Instrument, Project } from '../model/types';
import { midiToFreq } from '../lib/scales';
import { InstrumentVoice } from './InstrumentVoice';
import { buildJam, type JamSchedule } from './scheduler';
import { transportClock } from './transportClock';

// The single public audio facade (spec §4). React imports ONLY this module for
// sound. It owns the Tone graph and reconciles it to plain data pushed in by the
// store bridge (useEngineSync). It holds no React state and imports no store.

class AudioEngine {
  private master = new Tone.Gain(0.9);
  private voices = new Map<string, InstrumentVoice>();
  private jam: JamSchedule | null = null;
  private started = false;

  constructor() {
    // The master Gain is the obvious tap point for a phase-7 visualizer analyser.
    this.master.toDestination();
  }

  /** Resume the AudioContext on the first user gesture (Play). */
  async init(): Promise<void> {
    if (this.started) return;
    await Tone.start();
    Tone.getTransport().swingSubdivision = '16n';
    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  // --- global transport / mix ---

  setTempo(bpm: number): void {
    Tone.getTransport().bpm.rampTo(bpm, 0.05);
  }

  setSwing(swing: number): void {
    Tone.getTransport().swing = swing;
  }

  setMasterVolume(v: number): void {
    this.master.gain.rampTo(Math.max(0, v), 0.02);
  }

  // --- instrument reconciliation (diff by id) ---

  syncInstruments(instruments: Instrument[]): void {
    const seen = new Set<string>();
    for (const inst of instruments) {
      seen.add(inst.id);
      const existing = this.voices.get(inst.id);
      if (existing) {
        existing.applyConfig(inst);
      } else {
        this.voices.set(inst.id, new InstrumentVoice(inst, this.master));
      }
    }
    // Dispose voices whose instrument was removed.
    for (const [vid, voice] of this.voices) {
      if (!seen.has(vid)) {
        voice.dispose();
        this.voices.delete(vid);
      }
    }
  }

  updateInstrument(inst: Instrument): void {
    const voice = this.voices.get(inst.id);
    if (voice) voice.applyConfig(inst);
    else this.voices.set(inst.id, new InstrumentVoice(inst, this.master));
  }

  // --- jam playback ---

  /** (Re)build the looping Parts from the active clips. Safe to call while playing. */
  loadJam(project: Project, activeClips: Clip[]): void {
    this.jam?.dispose();
    this.jam = buildJam(project, this.voices, activeClips);
    transportClock.setLoopSteps(this.jam.loopSteps);
  }

  async play(): Promise<void> {
    await this.init();
    Tone.getTransport().start();
    transportClock.start();
  }

  stop(): void {
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    transportClock.stop();
  }

  pause(): void {
    Tone.getTransport().pause();
    transportClock.stop();
  }

  // --- audition (instant feedback when clicking a note / pad) ---

  auditionNote(instrumentId: string, midi: number, durationSec = 0.35): void {
    void this.init();
    const voice = this.voices.get(instrumentId);
    voice?.triggerNote(midiToFreq(midi), durationSec, Tone.now(), 0.9);
  }

  auditionPad(instrumentId: string, padIndex: number): void {
    void this.init();
    const voice = this.voices.get(instrumentId);
    voice?.triggerPad(padIndex, Tone.now(), 0.9);
  }

  getPosition() {
    const t = Tone.getTransport();
    return { ticks: t.ticks, seconds: t.seconds, position: t.position };
  }

  // --- seam for phase 5 (Song view) ---
  scheduleArrangement(_project: Project): void {
    throw new Error('scheduleArrangement is not implemented until phase 5');
  }
}

export const engine = new AudioEngine();
