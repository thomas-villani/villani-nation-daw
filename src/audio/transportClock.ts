import * as Tone from 'tone';
import { STEPS_PER_BAR } from '../lib/constants';

// The ONLY requestAnimationFrame loop in the app used for timing (spec §4.1).
// It never integrates its own time — every frame it READS the audio clock
// (Tone.Transport) and notifies subscribers, so visuals can't drift from sound.

export interface ClockState {
  seconds: number; // Tone.Transport.seconds
  ticks: number; // Tone.Transport.ticks
  step: number; // current 16th-note step within the loop (float, for smooth playhead)
  loopSteps: number; // total steps in the current loop (0 if not looping)
}

type Listener = (s: ClockState) => void;

class TransportClock {
  private listeners = new Set<Listener>();
  private rafId: number | null = null;
  private loopSteps = 0;

  /** Tell the clock how long the loop is (in 16th steps) so it can wrap `step`. */
  setLoopSteps(steps: number) {
    this.loopSteps = steps;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start() {
    if (this.rafId !== null) return;
    const tick = () => {
      this.emit();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    // One final emit so the playhead resets to the start position.
    this.emit();
  }

  private emit() {
    const seconds = Tone.getTransport().seconds;
    const ticks = Tone.getTransport().ticks;
    const ppq = Tone.getTransport().PPQ; // ticks per quarter note
    const stepFloat = (ticks / ppq) * 4; // 4 sixteenths per quarter
    const step = this.loopSteps > 0 ? stepFloat % this.loopSteps : stepFloat;
    const state: ClockState = { seconds, ticks, step, loopSteps: this.loopSteps };
    this.listeners.forEach((fn) => fn(state));
  }
}

export const transportClock = new TransportClock();
export { STEPS_PER_BAR };
