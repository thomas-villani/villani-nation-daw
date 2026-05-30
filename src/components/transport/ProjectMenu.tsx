import { useRef, useState } from 'react';
import { engine } from '../../audio/engine';
import { useProjectStore } from '../../store/useProjectStore';
import { downloadProject, readProjectFile } from '../../lib/persistence';

// Phase 3 — the "File" cluster: rename the jam, start a new one, and save/open
// jams as .json files. Autosave to localStorage happens in the background
// (useAutosave); these are the explicit, kid-facing controls. Rendered vertically
// inside the ⚙ More menu in the transport bar.

export function ProjectMenu() {
  const name = useProjectStore((s) => s.project.name);
  const lastSavedAt = useProjectStore((s) => s.ui.lastSavedAt);
  const renameProject = useProjectStore((s) => s.renameProject);
  const newProject = useProjectStore((s) => s.newProject);
  const replaceProject = useProjectStore((s) => s.replaceProject);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosingNew, setChoosingNew] = useState(false);

  // Loading a different project rebuilds the whole engine graph via the bridge;
  // stop the transport first so the playhead doesn't point at a stale loop.
  const stopIfPlaying = () => {
    if (useProjectStore.getState().transport.isPlaying) {
      engine.stop();
      setIsPlaying(false);
    }
  };

  // "Ask each time": blank canvas (build from scratch) vs. the fun starter jam.
  const doNew = (blank: boolean) => {
    stopIfPlaying();
    newProject(blank);
    setChoosingNew(false);
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
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">File</span>

      <input
        value={name}
        onChange={(e) => renameProject(e.target.value)}
        spellCheck={false}
        aria-label="Project name"
        className="bg-panel2 border-2 border-edge rounded-lg px-2 py-1 font-bold w-full text-sm"
      />

      {error ? (
        <span className="text-xs text-bass font-bold" title={error}>
          ⚠ {error}
        </span>
      ) : lastSavedAt ? (
        <span className="text-[10px] text-white/40 font-bold">Auto-saved ✓</span>
      ) : null}

      {choosingNew ? (
        <div className="flex flex-col gap-1 rounded-lg border-2 border-edge p-2">
          <span className="text-[11px] text-white/60">
            Start a new jam with… <span className="text-white/40">(this one is auto-saved)</span>
          </span>
          <button onClick={() => doNew(true)} className="btn text-sm justify-start">
            🆕 Blank canvas
          </button>
          <button onClick={() => doNew(false)} className="btn text-sm justify-start">
            🎵 Starter jam
          </button>
          <button
            onClick={() => setChoosingNew(false)}
            className="text-[11px] text-white/40 underline self-start mt-0.5"
          >
            cancel
          </button>
        </div>
      ) : (
        <button onClick={() => setChoosingNew(true)} className="btn text-sm" title="Start a fresh jam">
          ✨ New
        </button>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => downloadProject(useProjectStore.getState().project)}
          className="btn text-sm flex-1"
          title="Save this jam to a file"
        >
          ⬇ Save File
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          className="btn text-sm flex-1"
          title="Open a jam from a file"
        >
          ⬆ Open
        </button>
      </div>
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
