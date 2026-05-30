import { useProjectStore } from '../../store/useProjectStore';

// Left rail: pick the instrument being edited, or add a new one (spec §5).

export function InstrumentRail() {
  const instruments = useProjectStore((s) => s.project.instruments);
  const selectedId = useProjectStore((s) => s.ui.selectedInstrumentId);
  const select = useProjectStore((s) => s.selectInstrument);
  const add = useProjectStore((s) => s.addInstrument);
  const remove = useProjectStore((s) => s.removeInstrument);
  const update = useProjectStore((s) => s.updateInstrument);

  return (
    <div className="panel w-48 shrink-0 flex flex-col gap-2">
      <h2 className="font-bold text-sm uppercase tracking-wider text-white/50">Tracks</h2>
      {instruments.map((inst) => {
        const active = inst.id === selectedId;
        return (
          <div
            key={inst.id}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 cursor-pointer ${active ? 'border-hi bg-panel2' : 'border-edge'}`}
            onClick={() => select(inst.id)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: inst.color }}
            />
            <span className="font-bold text-sm flex-1 truncate">{inst.name}</span>
            <button
              className={`text-xs ${inst.mute ? 'opacity-100' : 'opacity-40'}`}
              onClick={(e) => {
                e.stopPropagation();
                update(inst.id, { mute: !inst.mute });
              }}
              title={inst.mute ? 'unmute track' : 'mute track'}
            >
              {inst.mute ? '🔇' : '🔊'}
            </button>
            <span className="text-[10px] text-white/40">
              {inst.kind === 'drumkit' ? '🥁' : '🎹'}
            </span>
            {instruments.length > 1 && (
              <button
                className="text-white/30 hover:text-bass text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(inst.id);
                }}
                title="remove track"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}

      <div className="flex gap-2 mt-1">
        <button className="btn flex-1 text-sm py-1.5" onClick={() => add('synth')}>
          + Synth
        </button>
        <button className="btn flex-1 text-sm py-1.5" onClick={() => add('drumkit')}>
          + Drums
        </button>
      </div>
    </div>
  );
}
