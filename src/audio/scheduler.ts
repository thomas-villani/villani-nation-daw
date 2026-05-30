import * as Tone from 'tone';
import type { AutomationLane, Clip, Project, Section } from '../model/types';
import { noteToFreq } from '../lib/scales';
import type { AutomatableParam } from '../lib/sections';
import { barsToToneLength, stepToBarsBeats } from '../lib/time';
import { STEPS_PER_BAR } from '../lib/constants';
import type { AutomatableSignal, InstrumentVoice } from './InstrumentVoice';

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

// ---------------------------------------------------------------------------
// Song mode (spec §4.3 / §5.4): walk the arrangement, placing each section's
// clips at their absolute bar offset (looped to fill the section length) and
// scheduling each section's automation as a ramp at its start time.
// ---------------------------------------------------------------------------

const AUTOMATABLE_PARAMS: AutomatableParam[] = [
  'filter.cutoff',
  'volume',
  'effect.reverb.wet',
  'effect.delay.wet',
];

export interface SongSchedule {
  parts: Tone.Part[];
  scheduleIds: number[]; // Transport.schedule ids for the automation callbacks
  loopSteps: number; // whole-song length in steps -> Transport loop + playhead
  dispose(): void;
}

/** Resolve which clip an instrument plays in a section (sparse, like the jam). */
function resolveSectionClip(project: Project, section: Section, instrumentId: string): Clip | null {
  if (Object.prototype.hasOwnProperty.call(section.clipAssignments, instrumentId)) {
    const cid = section.clipAssignments[instrumentId];
    if (cid === null) return null; // explicitly silent
    const found = project.clips.find((c) => c.id === cid && c.instrumentId === instrumentId);
    if (found) return found; // else stale id -> fall back to default
  }
  return project.clips.find((c) => c.instrumentId === instrumentId) ?? null;
}

function rampSignal(
  sig: AutomatableSignal,
  lane: AutomationLane,
  time: number,
  durSec: number,
): void {
  const exp = lane.curve === 'exponential';
  const from = exp ? Math.max(0.0001, lane.from) : lane.from;
  sig.cancelScheduledValues(time);
  sig.setValueAtTime(from, time);
  if (exp) sig.exponentialRampToValueAtTime(Math.max(0.0001, lane.to), time + durSec);
  else sig.linearRampToValueAtTime(lane.to, time + durSec);
}

export function buildSong(project: Project, voices: Map<string, InstrumentVoice>): SongSchedule {
  const transport = Tone.getTransport();
  const sections = project.arrangement
    .map((id) => project.sections.find((s) => s.id === id))
    .filter((s): s is Section => Boolean(s));

  const melodic = new Map<string, MelodicEvent[]>();
  const drum = new Map<string, DrumEvent[]>();
  const scheduleIds: number[] = [];
  let bar = 0;

  for (const section of sections) {
    const startStep = bar * STEPS_PER_BAR;
    const sectionEndStep = (bar + section.lengthBars) * STEPS_PER_BAR;

    for (const inst of project.instruments) {
      if (!voices.has(inst.id)) continue;
      const clip = resolveSectionClip(project, section, inst.id);
      if (!clip) continue; // silent here
      const isDrum = clip.steps !== undefined;
      const clipBars = Math.max(1, clip.lengthBars);

      // Repeat the clip to fill the section; clamp the final partial rep.
      for (let repBar = 0; repBar < section.lengthBars; repBar += clipBars) {
        const baseStep = startStep + repBar * STEPS_PER_BAR;
        if (isDrum) {
          const arr = drum.get(inst.id) ?? [];
          for (const s of clip.steps ?? []) {
            const abs = baseStep + s.step;
            if (abs >= sectionEndStep) continue;
            arr.push({ time: stepToBarsBeats(abs), padIndex: s.padIndex, velocity: s.velocity });
          }
          drum.set(inst.id, arr);
        } else {
          const arr = melodic.get(inst.id) ?? [];
          for (const n of clip.notes ?? []) {
            const abs = baseStep + n.start;
            if (abs >= sectionEndStep) continue;
            arr.push({
              time: stepToBarsBeats(abs),
              degree: n.degree,
              octave: n.octave,
              duration: n.duration,
              velocity: n.velocity,
            });
          }
          melodic.set(inst.id, arr);
        }
      }
    }

    // Schedule this section's automation at its start. Params with a lane ramp;
    // params without one snap back to the instrument's home value, so a move in
    // one section never bleeds into the next (spec §5.7).
    const startTime = stepToBarsBeats(startStep);
    const lengthBars = section.lengthBars;
    const id = transport.schedule((time) => {
      const durSec = Tone.Time(barsToToneLength(lengthBars)).toSeconds();
      for (const inst of project.instruments) {
        const voice = voices.get(inst.id);
        if (!voice) continue;
        for (const param of AUTOMATABLE_PARAMS) {
          const sig = voice.getAutomationSignal(param);
          if (!sig) continue;
          const lane = section.automation.find(
            (a) => a.instrumentId === inst.id && a.param === param,
          );
          if (lane) {
            rampSignal(sig, lane, time, durSec);
          } else {
            sig.cancelScheduledValues(time);
            sig.setValueAtTime(voice.baseValueFor(param, inst), time);
          }
        }
      }
    }, startTime);
    scheduleIds.push(id);

    bar += section.lengthBars;
  }

  const totalBars = Math.max(1, bar);
  const loopSteps = totalBars * STEPS_PER_BAR;

  // Each Part loops over the WHOLE song length (events sit at absolute offsets),
  // so the arrangement repeats as one unit, locked to the transport loop.
  const parts: Tone.Part[] = [];
  const songLen = barsToToneLength(totalBars);

  for (const [instId, events] of melodic) {
    const voice = voices.get(instId)!;
    const part = new Tone.Part<MelodicEvent>((time, ev) => {
      const freq = noteToFreq(
        { degree: ev.degree, octave: ev.octave, start: 0, duration: 0, velocity: 0 },
        project.key,
      );
      const durSec = Tone.Time('16n').toSeconds() * ev.duration;
      voice.triggerNote(freq, durSec, time, ev.velocity);
    }, events);
    part.loop = true;
    part.loopStart = 0;
    part.loopEnd = songLen;
    part.start(0);
    parts.push(part);
  }

  for (const [instId, events] of drum) {
    const voice = voices.get(instId)!;
    const part = new Tone.Part<DrumEvent>((time, ev) => {
      voice.triggerPad(ev.padIndex, time, ev.velocity);
    }, events);
    part.loop = true;
    part.loopStart = 0;
    part.loopEnd = songLen;
    part.start(0);
    parts.push(part);
  }

  transport.loop = true;
  transport.loopStart = 0;
  transport.loopEnd = songLen;

  return {
    parts,
    scheduleIds,
    loopSteps,
    dispose: () => {
      parts.forEach((p) => p.dispose());
      scheduleIds.forEach((sid) => transport.clear(sid));
    },
  };
}
