import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  EffectType,
  Instrument,
  InstrumentKind,
  Note,
  Project,
  ScaleName,
  SynthConfig,
} from '../model/types';
import {
  makeDefaultProject,
  makeDrumInstrument,
  makeClip,
  makeSynthInstrument,
} from '../model/defaults';
import { TRACK_COLORS } from '../lib/constants';
import { loadFromLocal } from '../lib/persistence';

// THE source of truth for project DATA. Holds only serializable state (no Tone
// objects, never imports the engine). The engine is reconciled from here by the
// useEngineSync bridge via selector subscriptions.

interface TransportState {
  isPlaying: boolean;
}

interface UiState {
  selectedInstrumentId: string | null;
  masterVolume: number; // 0..1
  lastSavedAt: number | null; // epoch ms of the last autosave (drives the "Saved ✓" hint)
}

export interface ProjectStore {
  project: Project;
  transport: TransportState;
  ui: UiState;

  // project lifecycle (phase 3 — persistence)
  newProject(): void;
  replaceProject(project: Project): void;
  renameProject(name: string): void;
  markSaved(at: number): void;

  // global / transport
  setBpm(bpm: number): void;
  setSwing(swing: number): void;
  setKeyRoot(root: number): void;
  setScale(scale: ScaleName): void;
  setMasterVolume(v: number): void;
  setIsPlaying(b: boolean): void;

  // instruments
  addInstrument(kind: InstrumentKind): string;
  removeInstrument(id: string): void;
  updateInstrument(id: string, patch: Partial<Instrument>): void;
  updateSynthConfig(id: string, patch: Partial<SynthConfig>): void;
  toggleEffect(id: string, type: EffectType): void;
  updateEffect(id: string, type: EffectType, params: Record<string, number>): void;
  selectInstrument(id: string): void;

  // drum clip editing
  toggleStep(clipId: string, padIndex: number, step: number): void;
  setPadGain(instrumentId: string, padIndex: number, gain: number): void;
  togglePadMute(instrumentId: string, padIndex: number): void;
  setPadSample(instrumentId: string, padIndex: number, sampleUrl: string): void;

  // melodic clip editing
  addNote(clipId: string, note: Note): void;
  updateNote(clipId: string, index: number, patch: Partial<Note>): void;
  removeNote(clipId: string, index: number): void;
}

const findInstrument = (p: Project, id: string) => p.instruments.find((i) => i.id === id);
const findClip = (p: Project, id: string) => p.clips.find((c) => c.id === id);

export const useProjectStore = create<ProjectStore>()(
  subscribeWithSelector(
    immer((set) => {
      // Hydrate from the last autosave if there is one, else the starter jam.
      const initial = loadFromLocal() ?? makeDefaultProject();
      return {
        project: initial,
        transport: { isPlaying: false },
        ui: {
          selectedInstrumentId: initial.instruments[0]?.id ?? null,
          masterVolume: 0.9,
          lastSavedAt: null,
        },

        newProject: () =>
          set((s) => {
            const fresh = makeDefaultProject();
            s.project = fresh;
            s.ui.selectedInstrumentId = fresh.instruments[0]?.id ?? null;
          }),
        replaceProject: (project) =>
          set((s) => {
            s.project = project;
            s.ui.selectedInstrumentId = project.instruments[0]?.id ?? null;
          }),
        renameProject: (name) =>
          set((s) => {
            s.project.name = name;
          }),
        markSaved: (at) =>
          set((s) => {
            s.ui.lastSavedAt = at;
          }),

        setBpm: (bpm) =>
          set((s) => {
            s.project.bpm = Math.round(Math.min(220, Math.max(40, bpm)));
          }),
        setSwing: (swing) =>
          set((s) => {
            s.project.swing = Math.min(1, Math.max(0, swing));
          }),
        setKeyRoot: (root) =>
          set((s) => {
            s.project.key.root = ((root % 12) + 12) % 12;
          }),
        setScale: (scale) =>
          set((s) => {
            s.project.key.scale = scale;
          }),
        setMasterVolume: (v) =>
          set((s) => {
            s.ui.masterVolume = Math.min(1, Math.max(0, v));
          }),
        setIsPlaying: (b) =>
          set((s) => {
            s.transport.isPlaying = b;
          }),

        addInstrument: (kind) => {
          const inst =
            kind === 'drumkit'
              ? makeDrumInstrument()
              : makeSynthInstrument('Lead', TRACK_COLORS.lead, { engine: 'poly', wave: 'triangle' });
          set((s) => {
            s.project.instruments.push(inst);
            // Give synth instruments an empty starter clip so the roll has a target.
            if (kind !== 'drumkit') {
              s.project.clips.push(makeClip(inst.id, 'Main', { notes: [] }));
            }
            s.ui.selectedInstrumentId = inst.id;
          });
          return inst.id;
        },
        removeInstrument: (id) =>
          set((s) => {
            s.project.instruments = s.project.instruments.filter((i) => i.id !== id);
            s.project.clips = s.project.clips.filter((c) => c.instrumentId !== id);
            if (s.ui.selectedInstrumentId === id) {
              s.ui.selectedInstrumentId = s.project.instruments[0]?.id ?? null;
            }
          }),
        updateInstrument: (id, patch) =>
          set((s) => {
            const inst = findInstrument(s.project, id);
            if (inst) Object.assign(inst, patch);
          }),
        updateSynthConfig: (id, patch) =>
          set((s) => {
            const inst = findInstrument(s.project, id);
            if (inst?.synth) Object.assign(inst.synth, patch);
          }),
        toggleEffect: (id, type) =>
          set((s) => {
            const inst = findInstrument(s.project, id);
            const fx = inst?.effects.find((e) => e.type === type);
            if (fx) fx.enabled = !fx.enabled;
          }),
        updateEffect: (id, type, params) =>
          set((s) => {
            const inst = findInstrument(s.project, id);
            const fx = inst?.effects.find((e) => e.type === type);
            if (fx) Object.assign(fx.params, params);
          }),
        selectInstrument: (id) =>
          set((s) => {
            s.ui.selectedInstrumentId = id;
          }),

        toggleStep: (clipId, padIndex, step) =>
          set((s) => {
            const clip = findClip(s.project, clipId);
            if (!clip) return;
            if (!clip.steps) clip.steps = [];
            const idx = clip.steps.findIndex((x) => x.padIndex === padIndex && x.step === step);
            if (idx >= 0) clip.steps.splice(idx, 1);
            else clip.steps.push({ padIndex, step, velocity: 0.9 });
          }),
        setPadGain: (instrumentId, padIndex, gain) =>
          set((s) => {
            const pad = findInstrument(s.project, instrumentId)?.drumkit?.pads[padIndex];
            if (pad) pad.gain = Math.min(1, Math.max(0, gain));
          }),
        togglePadMute: (instrumentId, padIndex) =>
          set((s) => {
            const pad = findInstrument(s.project, instrumentId)?.drumkit?.pads[padIndex];
            if (pad) pad.mute = !pad.mute;
          }),
        setPadSample: (instrumentId, padIndex, sampleUrl) =>
          set((s) => {
            const pad = findInstrument(s.project, instrumentId)?.drumkit?.pads[padIndex];
            if (pad) {
              pad.source = 'sample';
              pad.sampleUrl = sampleUrl;
            }
          }),

        addNote: (clipId, note) =>
          set((s) => {
            const clip = findClip(s.project, clipId);
            if (!clip) return;
            if (!clip.notes) clip.notes = [];
            clip.notes.push(note);
          }),
        updateNote: (clipId, index, patch) =>
          set((s) => {
            const clip = findClip(s.project, clipId);
            const note = clip?.notes?.[index];
            if (note) Object.assign(note, patch);
          }),
        removeNote: (clipId, index) =>
          set((s) => {
            const clip = findClip(s.project, clipId);
            if (clip?.notes) clip.notes.splice(index, 1);
          }),
      };
    }),
  ),
);

// --- selectors (pure; used by components and the engine bridge) ---

/** One active clip per instrument (phase 1-2: the first clip for each). */
export function selectActiveClips(p: Project) {
  const out = [];
  for (const inst of p.instruments) {
    const clip = p.clips.find((c) => c.instrumentId === inst.id);
    if (clip) out.push(clip);
  }
  return out;
}

export const selectInstrumentById = (p: Project, id: string | null) =>
  id ? p.instruments.find((i) => i.id === id) : undefined;

export const selectClipForInstrument = (p: Project, instrumentId: string) =>
  p.clips.find((c) => c.instrumentId === instrumentId);
