import { useProjectStore } from '../../store/useProjectStore';
import {
  AUTOMATION_PRESETS,
  SECTION_TEMPLATES,
  SECTION_TYPE_ORDER,
  automationSummary,
} from '../../lib/sections';
import type { Instrument, SectionType } from '../../model/types';

// The inspector for the selected section (spec §5.4). Per instrument it shows which
// clip plays (Default / a specific clip / Silent) and the automation "moves" for
// that section, which a kid can add or remove. Section-level controls (name, type,
// length, reorder, duplicate, delete) sit in the header.

const DEFAULT = '__default__';
const SILENT = '__silent__';

interface Props {
  sectionId: string;
}

export function SectionInspector({ sectionId }: Props) {
  const section = useProjectStore((s) => s.project.sections.find((x) => x.id === sectionId));
  const instruments = useProjectStore((s) => s.project.instruments);
  const clips = useProjectStore((s) => s.project.clips);
  const arrangement = useProjectStore((s) => s.project.arrangement);

  const renameSection = useProjectStore((s) => s.renameSection);
  const setSectionType = useProjectStore((s) => s.setSectionType);
  const setSectionLength = useProjectStore((s) => s.setSectionLength);
  const moveSection = useProjectStore((s) => s.moveSection);
  const duplicateSection = useProjectStore((s) => s.duplicateSection);
  const removeSection = useProjectStore((s) => s.removeSection);

  if (!section) return null;
  const pos = arrangement.indexOf(sectionId);

  return (
    <div className="mt-4 border-t-2 border-edge pt-4">
      {/* Section header controls */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <input
          value={section.name}
          aria-label="Section name"
          onChange={(e) => renameSection(sectionId, e.target.value)}
          className="bg-panel2 border-2 border-edge rounded-lg px-3 py-1 font-bold w-40"
        />
        <label className="flex items-center gap-1 text-xs text-white/50 font-bold uppercase tracking-wider">
          Type
          <select
            value={section.type}
            onChange={(e) => setSectionType(sectionId, e.target.value as SectionType)}
            className="bg-panel2 border-2 border-edge rounded-lg px-2 py-1 font-bold text-white"
          >
            {SECTION_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {SECTION_TEMPLATES[t].emoji} {SECTION_TEMPLATES[t].label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-white/50 font-bold uppercase tracking-wider">
          Bars
          <div className="flex items-center gap-1">
            <Step onClick={() => setSectionLength(sectionId, section.lengthBars - 1)}>–</Step>
            <span className="w-7 text-center font-bold tabular-nums text-white">
              {section.lengthBars}
            </span>
            <Step onClick={() => setSectionLength(sectionId, section.lengthBars + 1)}>+</Step>
          </div>
        </label>

        <div className="flex items-center gap-1 ml-auto">
          <Step onClick={() => moveSection(sectionId, -1)} disabled={pos <= 0} title="move left">
            ◀
          </Step>
          <Step
            onClick={() => moveSection(sectionId, 1)}
            disabled={pos < 0 || pos >= arrangement.length - 1}
            title="move right"
          >
            ▶
          </Step>
          <button
            className="rounded-lg bg-panel2 border-2 border-edge px-2 py-1 text-xs font-bold"
            onClick={() => duplicateSection(sectionId)}
            title="duplicate this section"
          >
            ⧉ Copy
          </button>
          <button
            className="rounded-lg bg-panel2 border-2 border-edge px-2 py-1 text-xs font-bold text-bass hover:border-bass"
            onClick={() => removeSection(sectionId)}
            title="delete this section"
          >
            ✕ Delete
          </button>
        </div>
      </div>

      {/* Per-instrument clip + automation */}
      <div className="grid gap-2" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        {instruments.map((inst) => (
          <InstrumentRow key={inst.id} sectionId={sectionId} instrument={inst} clips={clips} section={section} />
        ))}
      </div>
    </div>
  );
}

function InstrumentRow({
  sectionId,
  instrument,
  clips,
  section,
}: {
  sectionId: string;
  instrument: Instrument;
  clips: import('../../model/types').Clip[];
  section: import('../../model/types').Section;
}) {
  const assignClip = useProjectStore((s) => s.assignClip);
  const resetClipAssignment = useProjectStore((s) => s.resetClipAssignment);
  const addAutomation = useProjectStore((s) => s.addAutomation);
  const removeAutomation = useProjectStore((s) => s.removeAutomation);

  const myClips = clips.filter((c) => c.instrumentId === instrument.id);
  const has = Object.prototype.hasOwnProperty.call(section.clipAssignments, instrument.id);
  const raw = section.clipAssignments[instrument.id];
  const value = !has ? DEFAULT : raw === null ? SILENT : raw;
  const lanes = section.automation.filter((a) => a.instrumentId === instrument.id);

  // Drums have no tunable filter — only offer the volume moves for them.
  const presets = AUTOMATION_PRESETS.filter(
    (p) => instrument.kind !== 'drumkit' || p.id === 'swell' || p.id === 'fade-out',
  );

  return (
    <div className="flex items-center gap-2 flex-wrap bg-panel2/40 rounded-lg px-3 py-2">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: instrument.color }} />
      <span className="font-bold text-sm w-24 truncate">{instrument.name}</span>

      <select
        value={value}
        aria-label={`${instrument.name} clip`}
        onChange={(e) => {
          const v = e.target.value;
          if (v === DEFAULT) resetClipAssignment(sectionId, instrument.id);
          else if (v === SILENT) assignClip(sectionId, instrument.id, null);
          else assignClip(sectionId, instrument.id, v);
        }}
        className={`bg-panel border-2 rounded-lg px-2 py-1 text-sm font-bold ${
          value === SILENT ? 'border-edge text-white/40' : 'border-edge'
        }`}
      >
        <option value={DEFAULT}>▸ Default clip</option>
        {myClips.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
        <option value={SILENT}>🔇 Silent</option>
      </select>

      {/* Automation moves for this instrument in this section */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {lanes.map((lane) => (
          <span
            key={lane.param}
            className="flex items-center gap-1 rounded-full border-2 border-edge px-2 py-0.5 text-[11px] font-bold"
          >
            {automationSummary(lane)}
            <button
              className="text-white/30 hover:text-bass"
              onClick={() => removeAutomation(sectionId, instrument.id, lane.param)}
              title="remove move"
            >
              ✕
            </button>
          </span>
        ))}
        <select
          value=""
          aria-label={`Add a move to ${instrument.name}`}
          onChange={(e) => {
            const preset = presets.find((p) => p.id === e.target.value);
            if (preset) addAutomation(sectionId, preset.make(instrument.id));
            e.target.value = '';
          }}
          className="bg-panel border-2 border-dashed border-edge rounded-full px-2 py-0.5 text-[11px] text-white/60"
        >
          <option value="">+ move</option>
          {presets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Step({
  onClick,
  children,
  disabled,
  title,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-7 h-7 rounded-lg bg-panel2 border-2 border-edge font-bold active:translate-y-0.5 disabled:opacity-30"
    >
      {children}
    </button>
  );
}
