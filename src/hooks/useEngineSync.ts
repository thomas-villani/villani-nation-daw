import { useEffect } from 'react';
import { shallow } from 'zustand/shallow';
import { engine } from '../audio/engine';
import { selectActiveClips, useProjectStore } from '../store/useProjectStore';

// The store -> engine bridge (spec architecture). Subscribes to specific store
// slices OUTSIDE the React render cycle, so 60fps grid/slider edits never trigger
// React reconciliation. Mount once near the app root.

export function useEngineSync(): void {
  useEffect(() => {
    const store = useProjectStore;

    // Debounced schedule rebuild. The mode decides which playback graph to build:
    // jam = loop the active clips; song = walk the arrangement. Painting cells /
    // dragging sliders shouldn't thrash Tone.Part reconstruction — the loop
    // reflects edits on its next cycle.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const rebuild = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const { project, ui } = store.getState();
        if (ui.mode === 'song') engine.scheduleArrangement(project);
        else engine.loadJam(project, selectActiveClips(project, ui.activeClipByInstrument));
      }, 80);
    };

    // Initial push so the engine matches the store on mount.
    const s0 = store.getState();
    engine.setTempo(s0.project.bpm);
    engine.setSwing(s0.project.swing);
    engine.setMasterVolume(s0.ui.masterVolume);
    engine.syncInstruments(s0.project.instruments);
    if (s0.ui.mode === 'song') engine.scheduleArrangement(s0.project);
    else engine.loadJam(s0.project, selectActiveClips(s0.project, s0.ui.activeClipByInstrument));

    const unsubs = [
      store.subscribe((st) => st.project.bpm, (bpm) => engine.setTempo(bpm)),
      store.subscribe((st) => st.project.swing, (sw) => engine.setSwing(sw)),
      store.subscribe((st) => st.ui.masterVolume, (v) => engine.setMasterVolume(v)),
      // Instrument changes (incl. synth/effect params) -> live reconcile, diffed by id.
      store.subscribe((st) => st.project.instruments, (insts) => engine.syncInstruments(insts)),
      // Anything that changes what plays — clips/key/active-clip (jam) OR
      // mode/sections/arrangement (song) — rebuilds the schedule (debounced).
      store.subscribe(
        (st) =>
          [
            st.ui.mode,
            st.project.clips,
            st.project.key,
            st.ui.activeClipByInstrument,
            st.project.sections,
            st.project.arrangement,
          ] as const,
        rebuild,
        { equalityFn: shallow },
      ),
    ];

    return () => {
      if (timer) clearTimeout(timer);
      unsubs.forEach((u) => u());
    };
  }, []);
}
