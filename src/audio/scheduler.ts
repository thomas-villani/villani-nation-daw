import * as Tone from 'tone';
import type { Clip, Project } from '../model/types';
import { noteToFreq } from '../lib/scales';
import { barsToToneLength, stepToBarsBeats } from '../lib/time';
import { STEPS_PER_BAR } from '../lib/constants';
import type { InstrumentVoice } from './InstrumentVoice';

// Builds looping Tone.Parts for jam mode (spec §4.3). EVERY note/pad trigger fires
// inside a Part callback using the callback's sample-accurate `time` argument —
// never setTimeout/rAF (spec §4.1). Each Part self-loops at its clip length so a
// short clip repeats to fill the global loop.

type MelodicEvent = { time: string; degree: number; octave: number; duration: number; velocity: number };
type DrumEvent = { time: string; padIndex: number; velocity: number };

function buildMelodicPart(clip: Clip, voice: InstrumentVoice, key: Project['key']): Tone.Part {
  const events: MelodicEvent[] = (clip.notes ?? []).map((n) => ({
    time: stepToBarsBeats(n.start),
    degree: n.degree,
    octave: n.octave,
    duration: n.duration,
    velocity: n.velocity,
  }));
  const part = new Tone.Part<MelodicEvent>((time, ev) => {
    const freq = noteToFreq({ degree: ev.degree, octave: ev.octave, start: 0, duration: 0, velocity: 0 }, key);
    // Resolve duration at callback time so it tracks the current tempo.
    const durSec = Tone.Time('16n').toSeconds() * ev.duration;
    voice.triggerNote(freq, durSec, time, ev.velocity);
  }, events);
  part.loop = true;
  part.loopEnd = barsToToneLength(clip.lengthBars);
  return part;
}

function buildDrumPart(clip: Clip, voice: InstrumentVoice): Tone.Part {
  const events: DrumEvent[] = (clip.steps ?? []).map((s) => ({
    time: stepToBarsBeats(s.step),
    padIndex: s.padIndex,
    velocity: s.velocity,
  }));
  const part = new Tone.Part<DrumEvent>((time, ev) => {
    voice.triggerPad(ev.padIndex, time, ev.velocity);
  }, events);
  part.loop = true;
  part.loopEnd = barsToToneLength(clip.lengthBars);
  return part;
}

export interface JamSchedule {
  parts: Tone.Part[];
  loopSteps: number; // longest clip length in steps -> drives Transport loop + playhead
  dispose(): void;
}

/**
 * Build (and start) the jam Parts for the given clips. Caller is responsible for
 * Transport start/stop. Returns a disposable handle.
 */
export function buildJam(
  project: Project,
  voices: Map<string, InstrumentVoice>,
  activeClips: Clip[],
): JamSchedule {
  const parts: Tone.Part[] = [];
  let maxBars = 1;

  for (const clip of activeClips) {
    const voice = voices.get(clip.instrumentId);
    if (!voice) continue;
    const isDrum = clip.steps !== undefined;
    const part = isDrum
      ? buildDrumPart(clip, voice)
      : buildMelodicPart(clip, voice, project.key);
    part.start(0);
    parts.push(part);
    maxBars = Math.max(maxBars, clip.lengthBars);
  }

  const loopSteps = maxBars * STEPS_PER_BAR;

  // Global transport loop spans the longest clip; shorter Parts self-loop to fill.
  const transport = Tone.getTransport();
  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = barsToToneLength(maxBars);

  return {
    parts,
    loopSteps,
    dispose: () => parts.forEach((p) => p.dispose()),
  };
}
