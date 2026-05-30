import type { Project } from '../../model/types';
import { useProjectStore } from '../../store/useProjectStore';

// Optional coach overlay (spec §5.5). A NON-BLOCKING banner that nudges a kid
// through beat → bass → melody → chords → arrange. It never gates free play — it just
// reads the project and auto-advances to the first thing not done yet, then cheers
// when the whole shape exists. Dismissable; reopen from the transport bar (🧭 Coach).

interface Step {
  id: string;
  emoji: string;
  title: string;
  hint: string;
  done: (p: Project) => boolean;
}

// Count notes that share a start time within one clip = a chord was stamped.
const hasChord = (p: Project): boolean =>
  p.clips.some((c) => {
    if (!c.notes || c.notes.length < 2) return false;
    const byStart = new Map<number, number>();
    for (const n of c.notes) {
      const k = (byStart.get(n.start) ?? 0) + 1;
      byStart.set(n.start, k);
      if (k >= 2) return true;
    }
    return false;
  });

const totalMelodicNotes = (p: Project): number =>
  p.clips.reduce((sum, c) => sum + (c.notes?.length ?? 0), 0);

const STEPS: Step[] = [
  {
    id: 'beat',
    emoji: '🥁',
    title: 'Lay down a beat',
    hint: 'Tap the drum grid — or hit ✨ Surprise to fill one in.',
    done: (p) => p.clips.some((c) => (c.steps?.length ?? 0) > 0),
  },
  {
    id: 'bass',
    emoji: '🎸',
    title: 'Add a bassline',
    hint: 'Pick a synth track and draw some low notes (✨ Bass works too).',
    done: (p) => totalMelodicNotes(p) > 0,
  },
  {
    id: 'melody',
    emoji: '🎵',
    title: 'Build a melody',
    hint: 'Add a tune up high — every row is in-key, so it can’t sound wrong.',
    done: (p) => totalMelodicNotes(p) >= 8,
  },
  {
    id: 'chords',
    emoji: '🎹',
    title: 'Add some chords',
    hint: 'Switch the brush to Triad/7th and stamp a chord (or ✨ Chords).',
    done: hasChord,
  },
  {
    id: 'arrange',
    emoji: '🎬',
    title: 'Arrange a song',
    hint: 'Flip to 🎬 Song and hit ✨ Auto-arrange to build a full track.',
    done: (p) => p.arrangement.length >= 3,
  },
];

export function CoachOverlay() {
  // Selecting the stable project ref (immer swaps it on change) and deriving in
  // render — no fresh-array selector, so no render loop.
  const project = useProjectStore((s) => s.project);
  const toggleCoach = useProjectStore((s) => s.toggleCoach);

  const doneFlags = STEPS.map((st) => st.done(project));
  const currentIndex = doneFlags.findIndex((d) => !d);
  const allDone = currentIndex === -1;
  const step = allDone ? null : STEPS[currentIndex];

  return (
    <div className="flex items-center gap-3 bg-panel2 border-b-2 border-edge px-4 py-2 text-sm">
      <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold">Coach</span>

      {/* Progress dots — one per step, lit as it's completed. */}
      <div className="flex items-center gap-1">
        {STEPS.map((st, i) => (
          <span
            key={st.id}
            title={st.title}
            className={`w-2.5 h-2.5 rounded-full ${
              doneFlags[i] ? 'bg-hi' : i === currentIndex ? 'bg-lead animate-pulse' : 'bg-edge'
            }`}
          />
        ))}
      </div>

      {allDone ? (
        <span className="font-bold text-hi">
          🎉 You made a whole song! Keep tweaking, or 🎚️ save it.
        </span>
      ) : (
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{step!.emoji}</span>
          <span className="font-bold whitespace-nowrap">{step!.title}</span>
          <span className="text-white/50 truncate">— {step!.hint}</span>
        </span>
      )}

      <button
        className="ml-auto text-white/40 hover:text-bass text-base shrink-0"
        onClick={toggleCoach}
        title="hide the coach"
      >
        ✕
      </button>
    </div>
  );
}
