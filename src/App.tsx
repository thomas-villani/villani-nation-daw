import { useEngineSync } from './hooks/useEngineSync';
import { useAutosave } from './hooks/useAutosave';
import {
  selectClipForInstrument,
  selectInstrumentById,
  useProjectStore,
} from './store/useProjectStore';
import { TransportBar } from './components/transport/TransportBar';
import { InstrumentRail } from './components/instruments/InstrumentRail';
import { InstrumentPanel } from './components/instruments/InstrumentPanel';
import { ClipBar } from './components/clips/ClipBar';
import { DrumGrid } from './components/drumgrid/DrumGrid';
import { PianoRoll } from './components/pianoroll/PianoRoll';
import { SongView } from './components/song/SongView';
import { MixerPanel } from './components/mixer/MixerPanel';
import { CoachOverlay } from './components/coach/CoachOverlay';
import { Visualizer } from './components/visualizer/Visualizer';

export default function App() {
  useEngineSync(); // store -> audio engine bridge (mounted once)
  useAutosave(); // project -> localStorage autosave (mounted once)

  const mode = useProjectStore((s) => s.ui.mode);
  const showMixer = useProjectStore((s) => s.ui.showMixer);
  const showCoach = useProjectStore((s) => s.ui.showCoach);
  const showVisualizer = useProjectStore((s) => s.ui.showVisualizer);
  const selectedId = useProjectStore((s) => s.ui.selectedInstrumentId);
  const instrument = useProjectStore((s) => selectInstrumentById(s.project, selectedId));
  const activeMap = useProjectStore((s) => s.ui.activeClipByInstrument);
  const clip = useProjectStore((s) =>
    selectedId ? selectClipForInstrument(s.project, selectedId, activeMap) : undefined,
  );
  const musicKey = useProjectStore((s) => s.project.key);

  return (
    <div className="h-full flex flex-col">
      <TransportBar />
      {showCoach && <CoachOverlay />}
      <div className="flex-1 flex gap-4 p-4 overflow-auto">
        <InstrumentRail />

        <div className="flex-1 flex flex-col items-center overflow-auto">
          {mode === 'song' ? (
            <SongView />
          ) : (
            <>
              {instrument && <ClipBar instrument={instrument} />}
              {instrument && clip ? (
                instrument.kind === 'drumkit' ? (
                  <DrumGrid instrument={instrument} clip={clip} />
                ) : (
                  <PianoRoll instrument={instrument} clip={clip} musicKey={musicKey} />
                )
              ) : (
                <div className="text-white/40 mt-20">Select a track to start jamming 🎶</div>
              )}
            </>
          )}
        </div>

        {instrument && <InstrumentPanel instrument={instrument} />}
      </div>

      {showMixer && <MixerPanel />}
      {showVisualizer && <Visualizer />}
    </div>
  );
}
