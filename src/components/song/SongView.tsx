import { useProjectStore } from '../../store/useProjectStore';
import { SECTION_TEMPLATES, SECTION_TYPE_ORDER } from '../../lib/sections';
import { useTransportPosition } from '../../hooks/useTransportPosition';
import { useRef } from 'react';
import { SectionInspector } from './SectionInspector';

// Phase 5 — Song view (spec §5.4). A horizontal timeline of section blocks (the
// arrangement). Add sections from the palette or hit "✨ Auto-arrange" for an
// instant full-song shape, then click a block to set its clips + automation in the
// inspector below. Block width is proportional to bars so the song reads at a glance.

export const BAR_PX = 30; // timeline pixels per bar (block width = lengthBars * BAR_PX)

export function SongView() {
  // Select STABLE references (arrangement + sections arrays) and resolve the play
  // order in render — returning a fresh array from a selector each render would
  // loop (same zustand pitfall the ClipBar avoids).
  const arrangement = useProjectStore((s) => s.project.arrangement);
  const allSections = useProjectStore((s) => s.project.sections);
  const sections = arrangement
    .map((sid) => allSections.find((x) => x.id === sid))
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
  const selectedId = useProjectStore((s) => s.ui.selectedSectionId);
  const selectSection = useProjectStore((s) => s.selectSection);
  const addSection = useProjectStore((s) => s.addSection);
  const autoArrange = useProjectStore((s) => s.autoArrange);

  const totalBars = sections.reduce((n, s) => n + s.lengthBars, 0);

  return (
    <div className="panel w-full max-w-5xl">
      <div className="flex items-center justify-between mb-3 gap-4 flex-wrap">
        <h2 className="font-bold text-lg text-hi">🎬 Song</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider text-white/40 mr-1">Add</span>
          {SECTION_TYPE_ORDER.map((type) => {
            const t = SECTION_TEMPLATES[type];
            return (
              <button
                key={type}
                className="rounded-full border-2 border-edge hover:border-white/40 px-2.5 py-1 text-xs font-bold"
                style={{ color: t.color }}
                onClick={() => addSection(type)}
                title={`add a ${t.label} section`}
              >
                {t.emoji} {t.label}
              </button>
            );
          })}
          <button
            className="btn btn-primary text-xs px-3 py-1 ml-1"
            onClick={autoArrange}
            title="build a full song from your clips"
          >
            ✨ Auto-arrange
          </button>
        </div>
      </div>

      {/* Timeline */}
      {sections.length === 0 ? (
        <div className="text-white/40 text-center py-12 border-2 border-dashed border-edge rounded-xl">
          No sections yet — add one above, or hit{' '}
          <span className="text-hi font-bold">✨ Auto-arrange</span> for an instant song.
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <Ruler totalBars={totalBars} />
          <div className="relative flex items-stretch" style={{ minWidth: totalBars * BAR_PX }}>
            <SongPlayhead />
            {sections.map((section) => {
              const t = SECTION_TEMPLATES[section.type];
              const active = section.id === selectedId;
              return (
                <button
                  key={section.id}
                  onClick={() => selectSection(section.id)}
                  className={`relative h-20 border-r border-black/30 flex flex-col items-center justify-center px-1 overflow-hidden transition ${
                    active ? 'ring-2 ring-inset ring-hi z-10' : ''
                  }`}
                  style={{
                    width: section.lengthBars * BAR_PX,
                    backgroundColor: t.color + (active ? 'cc' : '88'),
                  }}
                  title={`${section.name} · ${section.lengthBars} bars`}
                >
                  <span className="text-lg leading-none">{t.emoji}</span>
                  <span className="text-[11px] font-bold text-ink truncate max-w-full px-1">
                    {section.name}
                  </span>
                  <span className="text-[9px] text-ink/70 font-bold">{section.lengthBars}b</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedId && <SectionInspector sectionId={selectedId} />}
    </div>
  );
}

function Ruler({ totalBars }: { totalBars: number }) {
  // A bar ruler above the blocks (numbers every 4 bars).
  return (
    <div className="relative h-4" style={{ width: totalBars * BAR_PX, minWidth: totalBars * BAR_PX }}>
      {Array.from({ length: totalBars + 1 }, (_, b) => (
        <div
          key={b}
          className="absolute top-0 text-[9px] text-white/30 font-bold"
          style={{ left: b * BAR_PX }}
        >
          {b % 4 === 0 ? b + 1 : ''}
        </div>
      ))}
    </div>
  );
}

// A playhead that glides across the whole arrangement, driven by the audio clock.
function SongPlayhead() {
  const lineRef = useRef<HTMLDivElement>(null);
  const isPlaying = useProjectStore((s) => s.transport.isPlaying);
  const mode = useProjectStore((s) => s.ui.mode);

  useTransportPosition((clock) => {
    const el = lineRef.current;
    if (!el) return;
    el.style.transform = `translateX(${(clock.step / 16) * BAR_PX}px)`;
  });

  if (!isPlaying || mode !== 'song') return null;
  return (
    <div
      ref={lineRef}
      className="pointer-events-none absolute left-0 top-0 z-20 w-0.5 bg-hi shadow-[0_0_8px_2px] shadow-hi/60"
      style={{ height: '100%' }}
    />
  );
}
