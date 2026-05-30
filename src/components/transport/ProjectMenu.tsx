import { useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { useProjectStore } from '../../store/useProjectStore';
import { downloadProject, readProjectFile } from '../../lib/persistence';

// Phase 3 — the "File" cluster: rename the jam, start a new one, and save/open
// jams as .json files. Autosave to localStorage happens in the background
// (useAutosave); these are the explicit, kid-facing controls.

export function ProjectMenu() {
  const name = useProjectStore((s) => s.project.name);
  const lastSavedAt = useProjectStore((s) => s.ui.lastSavedAt);
  const renameProject = useProjectStore((s) => s.renameProject);
  const newProject = useProjectStore((s) => s.newProject);
  const replaceProject = useProjectStore((s) => s.replaceProject);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Loading a different project rebuilds the whole engine graph via the bridge;
  // stop the transport first so the playhead doesn't point at a stale loop.
  const stopIfPlaying = () => {
    if (useProjectStore.getState().transport.isPlaying) {
      engine.stop();
      setIsPlaying(false);
    }
  };

  const handleNew = () => {
    if (!confirm('Start a new jam? Your current one is auto-saved, but make sure you exported it if you want to keep it.')) {
      return;
    }
    stopIfPlaying();
    newProject();
    setError(null);
  };

  const handleImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const project = await readProjectFile(file);
      stopIfPlaying();
      replaceProject(project);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open that song.');
    } finally {
      if (fileInput.current) fileInput.current.value = ''; // allow re-picking the same file
    }
  };

  return (
    <div className="ml-auto flex items-center gap-2">
      {error && (
        <span className="text-xs text-bass font-bold max-w-[14rem] truncate" title={error}>
          ⚠ {error}
        </span>
      )}
      {!error && lastSavedAt && (
        <span className="text-[10px] text-white/40 font-bold whitespace-nowrap">
          Auto-saved ✓
        </span>
      )}

      <input
        value={name}
        onChange={(e) => renameProject(e.target.value)}
        spellCheck={false}
        aria-label="Project name"
        className="bg-panel2 border-2 border-edge rounded-lg px-2 py-1 font-bold w-40 text-sm"
      />

      <button onClick={handleNew} className="btn text-sm" title="Start a fresh jam">
        ✨ New
      </button>
      <button
        onClick={() => downloadProject(useProjectStore.getState().project)}
        className="btn text-sm"
        title="Save this jam to a file"
      >
        ⬇ Save File
      </button>
      <button
        onClick={() => fileInput.current?.click()}
        className="btn text-sm"
        title="Open a jam from a file"
      >
        ⬆ Open
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => handleImport(e.target.files?.[0])}
      />
    </div>
  );
}
