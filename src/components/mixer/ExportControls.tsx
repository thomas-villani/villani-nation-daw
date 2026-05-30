import { useState } from 'react';
import { engine } from '../../audio/engine';
import {
  audioBufferToMp3,
  audioBufferToWav,
  canRenderSong,
  downloadBlob,
  renderProject,
  type ExportFormat,
} from '../../audio/offline';
import { selectActiveClips, useProjectStore } from '../../store/useProjectStore';

// Phase 6 — "Save your song" (spec §4.4). Renders the whole arrangement (or the jam
// loop, if there's no arrangement yet) offline via Tone.Offline, then encodes to a
// WAV (lossless, no deps) or MP3 (lamejs, smaller — "send it to grandpa"). The
// render reproduces the mix exactly: channel levels, mutes/solos, effects, automation.

const safeName = (name: string) =>
  (name.trim() || 'song').replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase();

export function ExportControls() {
  const projectName = useProjectStore((s) => s.project.name);
  const hasSong = useProjectStore((s) => canRenderSong(s.project));
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async (fmt: ExportFormat) => {
    if (busy) return;
    setError(null);

    // The offline render briefly takes over the audio context; stop live playback
    // first so it doesn't glitch (and the playhead doesn't point at a stale loop).
    if (useProjectStore.getState().transport.isPlaying) {
      engine.stop();
      setIsPlaying(false);
    }

    const { project, ui } = useProjectStore.getState();
    const mode = canRenderSong(project) ? 'song' : 'jam';
    const activeClips = selectActiveClips(project, ui.activeClipByInstrument);

    try {
      setBusy(`Rendering ${fmt.toUpperCase()}…`);
      const buffer = await renderProject(project, {
        mode,
        activeClips,
        masterVolume: ui.masterVolume,
      });
      setBusy(`Encoding ${fmt.toUpperCase()}…`);
      const blob = fmt === 'wav' ? audioBufferToWav(buffer) : await audioBufferToMp3(buffer);
      downloadBlob(blob, `${safeName(project.name)}.${fmt}`);
      setBusy(null);
    } catch (err) {
      console.error('Export failed:', err);
      setError("Couldn't export — try again.");
      setBusy(null);
    }
  };

  return (
    <div className="shrink-0 w-44 bg-panel2 rounded-xl border-2 border-edge p-3 flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
        Save your song
      </span>
      <span className="text-[10px] text-white/40 -mt-1">
        {hasSong ? '🎬 the whole arrangement' : '🔁 the jam loop ×4'}
      </span>

      <button
        onClick={() => handleExport('wav')}
        disabled={!!busy}
        className="btn btn-primary text-sm py-1.5 disabled:opacity-50"
        title={`Export ${projectName} as WAV (lossless)`}
      >
        ⬇ WAV
      </button>
      <button
        onClick={() => handleExport('mp3')}
        disabled={!!busy}
        className="btn text-sm py-1.5 disabled:opacity-50"
        title={`Export ${projectName} as MP3 (smaller file)`}
      >
        ⬇ MP3
      </button>

      {busy && (
        <span className="text-[10px] text-hi font-bold animate-pulse">{busy}</span>
      )}
      {error && <span className="text-[10px] text-bass font-bold">⚠ {error}</span>}
    </div>
  );
}
