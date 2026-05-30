import { useRef, useState } from 'react';
import { ROLL_OCTAVE_SPAN, STEPS_PER_BAR } from '../../lib/constants';
import { degreeToMidi, midiToName, scaleLength } from '../../lib/scales';
import type { Clip, Instrument, Project } from '../../model/types';
import { engine } from '../../audio/engine';
import { useProjectStore } from '../../store/useProjectStore';
import { Playhead } from '../transport/Playhead';

export const CELL_W = 38; // px per 16th column (matches drum grid for playhead parity)
export const ROW_H = 22; // px per scale-degree row

// Piano roll with SCALE-DEGREE rows (spec §5.2): every visible row is in-key, so a
// kid physically cannot click a wrong note. The home/root row is marked. Rows span
// one octave below home up to ROLL_OCTAVE_SPAN octaves above.

interface Props {
  instrument: Instrument;
  clip: Clip;
  musicKey: Project['key'];
}

interface Draft {
  rowFromTop: number;
  startCol: number;
  endCol: number;
}

export function PianoRoll({ instrument, clip, musicKey }: Props) {
  const len = scaleLength(musicKey.scale);
  const belowHome = len; // one octave of in-key rows below home
  const aboveHome = len * ROLL_OCTAVE_SPAN;
  const topIndex = aboveHome; // effectiveDegreeIndex of the top row
  const rows = aboveHome + belowHome + 1;
  const cols = STEPS_PER_BAR * clip.lengthBars;

  const notes = clip.notes ?? [];
  const addNote = useProjectStore((s) => s.addNote);
  const removeNote = useProjectStore((s) => s.removeNote);

  const surfaceRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  const width = cols * CELL_W;
  const height = rows * ROW_H;

  // effectiveDegreeIndex = cumulative scale steps above home (octave counts as len rows).
  const noteEffIndex = (degree: number, octave: number) => degree + octave * len;
  const rowToEffIndex = (rowFromTop: number) => topIndex - rowFromTop;
  const effIndexToRow = (eff: number) => topIndex - eff;

  const midiForRow = (rowFromTop: number) => {
    const eff = rowToEffIndex(rowFromTop);
    return degreeToMidi(eff, 0, musicKey.root, musicKey.scale);
  };

  const colFromX = (x: number) => Math.max(0, Math.min(cols - 1, Math.floor(x / CELL_W)));
  const rowFromY = (y: number) => Math.max(0, Math.min(rows - 1, Math.floor(y / ROW_H)));

  const noteIndexAt = (rowFromTop: number, col: number): number =>
    notes.findIndex((n) => {
      const r = effIndexToRow(noteEffIndex(n.degree, n.octave));
      return r === rowFromTop && col >= n.start && col < n.start + n.duration;
    });

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = surfaceRef.current!.getBoundingClientRect();
    const col = colFromX(e.clientX - rect.left);
    const rowFromTop = rowFromY(e.clientY - rect.top);

    const existing = noteIndexAt(rowFromTop, col);
    if (existing >= 0) {
      removeNote(clip.id, existing); // click a note to delete it
      return;
    }
    surfaceRef.current!.setPointerCapture(e.pointerId);
    setDraft({ rowFromTop, startCol: col, endCol: col });
    engine.auditionNote(instrument.id, midiForRow(rowFromTop));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const rect = surfaceRef.current!.getBoundingClientRect();
    const col = colFromX(e.clientX - rect.left);
    setDraft((d) => (d ? { ...d, endCol: Math.max(d.startCol, col) } : d));
  };

  const handlePointerUp = () => {
    if (!draft) return;
    const eff = rowToEffIndex(draft.rowFromTop);
    addNote(clip.id, {
      degree: eff, // cumulative degree, octave 0 — stays diatonic on key/scale change
      octave: 0,
      start: draft.startCol,
      duration: draft.endCol - draft.startCol + 1,
      velocity: 0.85,
    });
    setDraft(null);
  };

  return (
    <div className="panel inline-block">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg" style={{ color: instrument.color }}>
          {instrument.name} — {clip.name}
        </h2>
        <span className="text-xs text-white/40">
          click to add · click a note to remove · drag to lengthen
        </span>
      </div>

      <div className="flex">
        {/* Row labels (degree + faded note name; ★ = home) */}
        <div className="mr-2" style={{ width: 56 }}>
          <div style={{ height: 22 }} />
          {Array.from({ length: rows }, (_, rowFromTop) => {
            const eff = rowToEffIndex(rowFromTop);
            const isHome = eff === 0;
            const midi = midiForRow(rowFromTop);
            return (
              <div
                key={rowFromTop}
                className={`flex items-center justify-end pr-2 text-[10px] ${isHome ? 'text-hi font-bold' : 'text-white/35'}`}
                style={{ height: ROW_H }}
              >
                {isHome ? '★ ' : ''}
                {midiToName(midi)}
              </div>
            );
          })}
        </div>

        <div>
          {/* Beat numbers */}
          <div className="flex" style={{ height: 22 }}>
            {Array.from({ length: cols }, (_, i) => (
              <div
                key={i}
                className={`text-center text-[10px] text-white/40 ${i % 4 === 0 ? 'font-bold text-white/70' : ''}`}
                style={{ width: CELL_W }}
              >
                {i % 4 === 0 ? i / 4 + 1 : ''}
              </div>
            ))}
          </div>

          {/* Click surface */}
          <div
            ref={surfaceRef}
            className="relative cursor-pointer touch-none select-none"
            style={{ width, height }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <Playhead stepWidth={CELL_W} height={height} />

            {/* Row stripes */}
            {Array.from({ length: rows }, (_, rowFromTop) => {
              const eff = rowToEffIndex(rowFromTop);
              const isHome = eff === 0;
              const isOctave = eff !== 0 && eff % len === 0;
              return (
                <div
                  key={rowFromTop}
                  className="absolute left-0"
                  style={{
                    top: rowFromTop * ROW_H,
                    width,
                    height: ROW_H,
                    backgroundColor: isHome ? 'rgba(255,211,78,0.10)' : 'transparent',
                    borderTop: isOctave
                      ? '1px solid rgba(255,255,255,0.12)'
                      : '1px solid rgba(255,255,255,0.04)',
                  }}
                />
              );
            })}

            {/* Beat column lines */}
            {Array.from({ length: cols }, (_, i) => (
              <div
                key={i}
                className="absolute top-0"
                style={{
                  left: i * CELL_W,
                  width: 1,
                  height,
                  backgroundColor: i % 4 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                }}
              />
            ))}

            {/* Committed notes */}
            {notes.map((n, i) => {
              const rowFromTop = effIndexToRow(noteEffIndex(n.degree, n.octave));
              if (rowFromTop < 0 || rowFromTop >= rows) return null;
              return (
                <div
                  key={i}
                  className="absolute rounded-md border border-black/30 z-10"
                  style={{
                    left: n.start * CELL_W + 1,
                    top: rowFromTop * ROW_H + 2,
                    width: n.duration * CELL_W - 2,
                    height: ROW_H - 4,
                    backgroundColor: instrument.color,
                  }}
                />
              );
            })}

            {/* Drag preview */}
            {draft && (
              <div
                className="absolute rounded-md z-10 opacity-60"
                style={{
                  left: draft.startCol * CELL_W + 1,
                  top: draft.rowFromTop * ROW_H + 2,
                  width: (draft.endCol - draft.startCol + 1) * CELL_W - 2,
                  height: ROW_H - 4,
                  backgroundColor: instrument.color,
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
