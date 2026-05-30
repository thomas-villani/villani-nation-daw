import { useEffect } from 'react';
import { saveToLocal } from '../lib/persistence';
import { useProjectStore } from '../store/useProjectStore';

// Phase 3 — autosave. Subscribes to project changes OUTSIDE the render cycle
// (same pattern as the engine bridge) and writes to localStorage debounced, so a
// kid never loses a jam by closing the tab. Mount once near the app root.

const DEBOUNCE_MS = 800;

export function useAutosave(): void {
  useEffect(() => {
    const store = useProjectStore;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const unsub = store.subscribe(
      (s) => s.project,
      (project) => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          saveToLocal(project);
          store.getState().markSaved(Date.now());
        }, DEBOUNCE_MS);
      },
    );

    return () => {
      if (timer) clearTimeout(timer);
      unsub();
    };
  }, []);
}
