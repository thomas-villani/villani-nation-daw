import { useState } from 'react';
import type { Instrument } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';

// Per-instrument clip switcher (spec §5.4, phase 4). Each instrument can hold
// several short patterns; the highlighted pill is the one being edited AND the one
// looping in the jam. Double-click a pill to rename it.

interface Props {
  instrument: Instrument;
}

export function ClipBar({ instrument }: Props) {
  // Select stable references and filter in render — returning a fresh array from a
  // zustand selector each render would loop. (allClips changes only when clips do.)
  const allClips = useProjectStore((s) => s.project.clips);
  const activeMap = useProjectStore((s) => s.ui.activeClipByInstrument);
  const selectClip = useProjectStore((s) => s.selectClip);
  const addClip = useProjectStore((s) => s.addClip);
  const duplicateClip = useProjectStore((s) => s.duplicateClip);
  const removeClip = useProjectStore((s) => s.removeClip);
  const renameClip = useProjectStore((s) => s.renameClip);

  const clips = allClips.filter((c) => c.instrumentId === instrument.id);
  const activeId = activeMap[instrument.id] ?? clips[0]?.id;

  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap justify-center max-w-full">
      <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Clips</span>

      {clips.map((clip) => {
        const active = clip.id === activeId;
        const editing = editingId === clip.id;
        return (
          <div
            key={clip.id}
            className={`group flex items-center gap-1 rounded-full border-2 pl-3 pr-2 py-1 cursor-pointer text-sm ${
              active ? 'bg-panel2' : 'border-edge hover:border-white/30'
            }`}
            style={active ? { borderColor: instrument.color } : undefined}
            onClick={() => selectClip(instrument.id, clip.id)}
            onDoubleClick={() => setEditingId(clip.id)}
            title="click to switch · double-click to rename"
          >
            {editing ? (
              <input
                autoFocus
                defaultValue={clip.name}
                aria-label="Clip name"
                className="bg-transparent outline-none w-24 font-bold"
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v) renameClip(clip.id, v);
                  setEditingId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  if (e.key === 'Escape') setEditingId(null);
                }}
              />
            ) : (
              <span className="font-bold whitespace-nowrap">{clip.name}</span>
            )}
            {clips.length > 1 && !editing && (
              <button
                className="text-white/30 hover:text-bass text-xs opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  removeClip(clip.id);
                }}
                title="delete clip"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      <button
        className="rounded-full border-2 border-edge hover:border-white/30 w-8 h-8 text-lg font-bold leading-none"
        onClick={() => addClip(instrument.id)}
        title="new empty clip"
      >
        ＋
      </button>
      <button
        className="rounded-full border-2 border-edge hover:border-white/30 px-3 h-8 text-sm"
        onClick={() => activeId && duplicateClip(activeId)}
        title="duplicate the current clip"
      >
        ⧉ Copy
      </button>
    </div>
  );
}
