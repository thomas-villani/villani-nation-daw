import { useEngineSync } from './hooks/useEngineSync';
import {
  selectClipForInstrument,
  selectInstrumentById,
  useProjectStore,
} from './store/useProjectStore';
import { TransportBar } from './components/transport/TransportBar';
import { InstrumentRail } from './components/instruments/InstrumentRail';
import { InstrumentPanel } from './components/instruments/InstrumentPanel';
import { DrumGrid } from './components/drumgrid/DrumGrid';
import { PianoRoll } from './components/pianoroll/PianoRoll';

export default function App() {
  useEngineSync(); // store -> audio engine bridge (mounted once)

  const selectedId = useProjectStore((s) => s.ui.selectedInstrumentId);
  const instrument = useProjectStore((s) => selectInstrumentById(s.project, selectedId));
  const clip = useProjectStore((s) =>
    selectedId ? selectClipForInstrument(s.project, selectedId) : undefined,
  );
  const musicKey = useProjectStore((s) => s.project.key);

  return (
    <div className="h-full flex flex-col">
      <TransportBar />
      <div className="flex-1 flex gap-4 p-4 overflow-auto">
        <InstrumentRail />

        <div className="flex-1 flex items-start justify-center overflow-auto">
          {instrument && clip ? (
            instrument.kind === 'drumkit' ? (
              <DrumGrid instrument={instrument} clip={clip} />
            ) : (
              <PianoRoll instrument={instrument} clip={clip} musicKey={musicKey} />
            )
          ) : (
            <div className="text-white/40 mt-20">Select a track to start jamming 🎶</div>
          )}
        </div>

        {instrument && <InstrumentPanel instrument={instrument} />}
      </div>
    </div>
  );
}
