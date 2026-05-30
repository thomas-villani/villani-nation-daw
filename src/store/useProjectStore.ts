import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type {
  AutomationLane,
  Clip,
  EffectType,
  Instrument,
  InstrumentKind,
  Note,
  Project,
  ScaleName,
  Section,
  SectionType,
  SynthConfig,
} from '../model/types';
import {
  makeDefaultProject,
  makeDrumInstrument,
  makeClip,
  makeSection,
  makeSynthInstrument,
} from '../model/defaults';
import { id } from '../model/ids';
import { TRACK_COLORS } from '../lib/constants';
import { AUTO_ARRANGE_SHAPE, SECTION_TEMPLATES } from '../lib/sections';
import { loadFromLocal } from '../lib/persistence';

export type AppMode = 'jam' | 'song';

// THE source of truth for project DATA. Holds only serializable state (no Tone
// objects, never imports the engine). The engine is reconciled from here by the
// useEngineSync bridge via selector subscriptions.

interface TransportState {
  isPlaying: boolean;
}

interface UiState {
  mode: AppMode; // 'jam' = loop the active clips; 'song' = play the arrangement
  selectedInstrumentId: string | null;
  selectedSectionId: string | null; // the section open in the song inspector
  // Which clip is "active" (shown in the editor AND looping) per instrument.
  // Sparse: a missing entry falls back to the instrument's first clip, so this
  // never needs eager bookkeeping when clips/instruments are added or loaded.
  activeClipByInstrument: Record<string, string>;
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

  // song view (phase 5 — sections + arrangement + automation)
  setMode(mode: AppMode): void;
  selectSection(sectionId: string | null): void;
  addSection(type: SectionType): string;
  removeSection(sectionId: string): void;
  duplicateSection(sectionId: string): string | null;
  moveSection(sectionId: string, dir: -1 | 1): void;
  renameSection(sectionId: string, name: string): void;
  setSectionType(sectionId: string, type: SectionType): void;
  setSectionLength(sectionId: string, bars: number): void;
  assignClip(sectionId: string, instrumentId: string, clipId: string | null): void;
  resetClipAssignment(sectionId: string, instrumentId: string): void;
  addAutomation(sectionId: string, lane: AutomationLane): void;
  removeAutomation(sectionId: string, instrumentId: string, param: AutomationLane['param']): void;
  autoArrange(): void;

  // clips (phase 4 — multiple clips per instrument)
  selectClip(instrumentId: string, clipId: string): void;
  addClip(instrumentId: string): string;
  duplicateClip(clipId: string): string | null;
  removeClip(clipId: string): void;
  renameClip(clipId: string, name: string): void;

  // drum clip editing
  toggleStep(clipId: string, padIndex: number, step: number): void;
  setPadGain(instrumentId: string, padIndex: number, gain: number): void;
  togglePadMute(instrumentId: string, padIndex: number): void;
  setPadSample(instrumentId: string, padIndex: number, sampleUrl: string): void;

  // melodic clip editing
  addNote(clipId: string, note: Note): void;
  addNotes(clipId: string, notes: Note[]): void; // batch (e.g. a chord stamp)
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
          mode: 'jam',
          selectedInstrumentId: initial.instruments[0]?.id ?? null,
          selectedSectionId: initial.arrangement[0] ?? null,
          activeClipByInstrument: {},
          masterVolume: 0.9,
          lastSavedAt: null,
        },

        newProject: () =>
          set((s) => {
            const fresh = makeDefaultProject();
            s.project = fresh;
            s.ui.selectedInstrumentId = fresh.instruments[0]?.id ?? null;
            s.ui.selectedSectionId = null;
            s.ui.activeClipByInstrument = {};
          }),
        replaceProject: (project) =>
          set((s) => {
            s.project = project;
            s.ui.selectedInstrumentId = project.instruments[0]?.id ?? null;
            s.ui.selectedSectionId = project.arrangement[0] ?? null;
            s.ui.activeClipByInstrument = {};
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
            // Every instrument needs an empty starter clip so the editor has a target.
            const starter =
              kind === 'drumkit'
                ? makeClip(inst.id, 'Beat 1', { steps: [] })
                : makeClip(inst.id, 'Clip 1', { notes: [] });
            s.project.clips.push(starter);
            s.ui.selectedInstrumentId = inst.id;
          });
          return inst.id;
        },
        removeInstrument: (instrumentId) =>
          set((s) => {
            s.project.instruments = s.project.instruments.filter((i) => i.id !== instrumentId);
            s.project.clips = s.project.clips.filter((c) => c.instrumentId !== instrumentId);
            delete s.ui.activeClipByInstrument[instrumentId];
            // Drop any section references to the removed instrument so the JSON stays tidy.
            for (const sec of s.project.sections) {
              delete sec.clipAssignments[instrumentId];
              sec.automation = sec.automation.filter((a) => a.instrumentId !== instrumentId);
            }
            if (s.ui.selectedInstrumentId === instrumentId) {
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

        // --- song view (phase 5) ---
        setMode: (mode) =>
          set((s) => {
            s.ui.mode = mode;
          }),
        selectSection: (sectionId) =>
          set((s) => {
            s.ui.selectedSectionId = sectionId;
          }),
        addSection: (type) => {
          const section = makeSection(type, useProjectStore.getState().project.instruments);
          set((s) => {
            s.project.sections.push(section);
            s.project.arrangement.push(section.id);
            s.ui.selectedSectionId = section.id;
          });
          return section.id;
        },
        removeSection: (sectionId) =>
          set((s) => {
            s.project.sections = s.project.sections.filter((x) => x.id !== sectionId);
            s.project.arrangement = s.project.arrangement.filter((aid) => aid !== sectionId);
            if (s.ui.selectedSectionId === sectionId) {
              s.ui.selectedSectionId = s.project.arrangement[0] ?? null;
            }
          }),
        duplicateSection: (sectionId) => {
          const src = useProjectStore.getState().project.sections.find((x) => x.id === sectionId);
          if (!src) return null;
          const copy: Section = {
            ...src,
            id: id(),
            clipAssignments: { ...src.clipAssignments },
            automation: src.automation.map((a) => ({ ...a })),
          };
          set((s) => {
            s.project.sections.push(copy);
            const arr = s.project.arrangement;
            const i = arr.indexOf(sectionId);
            arr.splice(i >= 0 ? i + 1 : arr.length, 0, copy.id);
            s.ui.selectedSectionId = copy.id;
          });
          return copy.id;
        },
        moveSection: (sectionId, dir) =>
          set((s) => {
            const arr = s.project.arrangement;
            const i = arr.indexOf(sectionId);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= arr.length) return;
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }),
        renameSection: (sectionId, name) =>
          set((s) => {
            const sec = s.project.sections.find((x) => x.id === sectionId);
            if (sec) sec.name = name;
          }),
        setSectionType: (sectionId, type) =>
          set((s) => {
            const sec = s.project.sections.find((x) => x.id === sectionId);
            if (!sec) return;
            const tmpl = SECTION_TEMPLATES[type];
            sec.type = type;
            // Re-apply the type's default moves + silenced tracks (keeps explicit
            // clip picks; only touches the template-managed bits).
            sec.automation = tmpl.automation(s.project.instruments);
            for (const inst of s.project.instruments) {
              if (tmpl.silentKinds.includes(inst.kind)) sec.clipAssignments[inst.id] = null;
              else if (sec.clipAssignments[inst.id] === null) delete sec.clipAssignments[inst.id];
            }
          }),
        setSectionLength: (sectionId, bars) =>
          set((s) => {
            const sec = s.project.sections.find((x) => x.id === sectionId);
            if (sec) sec.lengthBars = Math.min(32, Math.max(1, Math.round(bars)));
          }),
        assignClip: (sectionId, instrumentId, clipId) =>
          set((s) => {
            const sec = s.project.sections.find((x) => x.id === sectionId);
            if (sec) sec.clipAssignments[instrumentId] = clipId;
          }),
        resetClipAssignment: (sectionId, instrumentId) =>
          set((s) => {
            const sec = s.project.sections.find((x) => x.id === sectionId);
            if (sec) delete sec.clipAssignments[instrumentId];
          }),
        addAutomation: (sectionId, lane) =>
          set((s) => {
            const sec = s.project.sections.find((x) => x.id === sectionId);
            if (!sec) return;
            // One lane per (instrument, param) — a new move replaces the old.
            sec.automation = sec.automation.filter(
              (a) => !(a.instrumentId === lane.instrumentId && a.param === lane.param),
            );
            sec.automation.push(lane);
          }),
        removeAutomation: (sectionId, instrumentId, param) =>
          set((s) => {
            const sec = s.project.sections.find((x) => x.id === sectionId);
            if (sec) {
              sec.automation = sec.automation.filter(
                (a) => !(a.instrumentId === instrumentId && a.param === param),
              );
            }
          }),
        autoArrange: () => {
          const insts = useProjectStore.getState().project.instruments;
          const sections = AUTO_ARRANGE_SHAPE.map((t) => makeSection(t, insts));
          set((s) => {
            s.project.sections = sections;
            s.project.arrangement = sections.map((x) => x.id);
            s.ui.selectedSectionId = sections[0]?.id ?? null;
            s.ui.mode = 'song';
          });
        },

        selectClip: (instrumentId, clipId) =>
          set((s) => {
            s.ui.activeClipByInstrument[instrumentId] = clipId;
          }),
        addClip: (instrumentId) => {
          const inst = findInstrument(useProjectStore.getState().project, instrumentId);
          const isDrum = inst?.kind === 'drumkit';
          const count = useProjectStore
            .getState()
            .project.clips.filter((c) => c.instrumentId === instrumentId).length;
          const clip = makeClip(
            instrumentId,
            isDrum ? `Beat ${count + 1}` : `Clip ${count + 1}`,
            isDrum ? { steps: [] } : { notes: [] },
          );
          set((s) => {
            s.project.clips.push(clip);
            s.ui.activeClipByInstrument[instrumentId] = clip.id; // jump to the new clip
          });
          return clip.id;
        },
        duplicateClip: (clipId) => {
          const src = findClip(useProjectStore.getState().project, clipId);
          if (!src) return null;
          // Deep-copy the pattern so the duplicate edits independently.
          const copy = makeClip(src.instrumentId, `${src.name} copy`, {
            lengthBars: src.lengthBars,
            notes: src.notes ? src.notes.map((n) => ({ ...n })) : undefined,
            steps: src.steps ? src.steps.map((st) => ({ ...st })) : undefined,
          });
          set((s) => {
            s.project.clips.push(copy);
            s.ui.activeClipByInstrument[src.instrumentId] = copy.id;
          });
          return copy.id;
        },
        removeClip: (clipId) =>
          set((s) => {
            const clip = findClip(s.project, clipId);
            if (!clip) return;
            const siblings = s.project.clips.filter((c) => c.instrumentId === clip.instrumentId);
            if (siblings.length <= 1) return; // keep at least one clip per instrument
            s.project.clips = s.project.clips.filter((c) => c.id !== clipId);
            if (s.ui.activeClipByInstrument[clip.instrumentId] === clipId) {
              // Fall back to the first surviving clip for this instrument.
              const next = s.project.clips.find((c) => c.instrumentId === clip.instrumentId);
              if (next) s.ui.activeClipByInstrument[clip.instrumentId] = next.id;
              else delete s.ui.activeClipByInstrument[clip.instrumentId];
            }
          }),
        renameClip: (clipId, name) =>
          set((s) => {
            const clip = findClip(s.project, clipId);
            if (clip) clip.name = name;
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
        addNotes: (clipId, notes) =>
          set((s) => {
            const clip = findClip(s.project, clipId);
            if (!clip || notes.length === 0) return;
            if (!clip.notes) clip.notes = [];
            clip.notes.push(...notes);
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

type ActiveMap = Record<string, string>;

/**
 * The active clip for one instrument: the one named in the active map, or — when
 * that entry is missing or stale — the instrument's first clip. This sparse
 * fallback is why adding clips / loading projects needs no map bookkeeping.
 */
export const selectClipForInstrument = (
  p: Project,
  instrumentId: string,
  activeMap: ActiveMap = {},
): Clip | undefined => {
  const wantedId = activeMap[instrumentId];
  const chosen = wantedId
    ? p.clips.find((c) => c.id === wantedId && c.instrumentId === instrumentId)
    : undefined;
  return chosen ?? p.clips.find((c) => c.instrumentId === instrumentId);
};

/** One active clip per instrument — what the jam loops. */
export function selectActiveClips(p: Project, activeMap: ActiveMap = {}): Clip[] {
  const out: Clip[] = [];
  for (const inst of p.instruments) {
    const clip = selectClipForInstrument(p, inst.id, activeMap);
    if (clip) out.push(clip);
  }
  return out;
}

export const selectInstrumentById = (p: Project, instrumentId: string | null) =>
  instrumentId ? p.instruments.find((i) => i.id === instrumentId) : undefined;

/** The sections in play order (resolves the arrangement id list to Section objects). */
export function selectSongSections(p: Project): Section[] {
  return p.arrangement
    .map((sid) => p.sections.find((s) => s.id === sid))
    .filter((s): s is Section => Boolean(s));
}
