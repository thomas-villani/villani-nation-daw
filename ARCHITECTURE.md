# How VillaniNation Studio Is Built

A walk through the design of a small music studio — written so that someone
learning software (eventually, the kids it was built for) can read it and see
*why* the pieces are arranged the way they are, not just *what* they are.

This is the "why" companion to [`implementation.md`](./implementation.md) (the
phase-by-phase build log) and the [`fruityloops-for-kids-spec.md`](./fruityloops-for-kids-spec.md)
(the original design brief).

---

## 1. The problem this app has to solve

A music app is harder than it looks, because it has **two clocks that disagree**.

- The **screen** redraws about 60 times a second, whenever the browser feels like
  it. It can stutter when something else is busy.
- The **sound card** marches at a perfectly even rate — 44,100 samples a second —
  and it does *not* wait for the screen. If a note is even a few milliseconds
  late, your ear hears it as "sloppy."

If you let the screen drive the sound — "draw a frame, then play the notes on that
frame" — the music will wobble every time the screen stutters. So the single most
important rule in this codebase is:

> **The sound is never driven by the screen. The screen is driven by the sound.**

Almost every design decision below is a consequence of taking that rule seriously.

There's also a second, gentler design goal from the spec: **a kid can't play a
wrong note.** That one turns out to have a surprisingly elegant solution too, and
it shapes how musical data is stored. We'll get to both.

---

## 2. The one big idea: data on one side, sound on the other, one bridge between

The whole app is split into two worlds that are *not allowed to touch each other
directly*:

```
   ┌─────────────────────────┐         ┌──────────────────────────┐
   │   THE DATA WORLD        │         │   THE SOUND WORLD        │
   │                         │         │                          │
   │   React components      │         │   Tone.js audio graph    │
   │   Zustand store         │  ──►    │   synths, drums, effects │
   │   (a plain JS object     │  one    │   the transport clock    │
   │    describing the song)  │ bridge  │                          │
   └─────────────────────────┘         └──────────────────────────┘
        knows nothing about              knows nothing about
        Tone.js                          React
```

- The **data world** is a single plain JavaScript object called the `Project`. It
  describes the song — instruments, clips, notes, tempo, key — and nothing about
  *how* sound is made. It lives in a [Zustand](https://github.com/pmndrs/zustand)
  store (`src/store/useProjectStore.ts`). **It never imports Tone.js.**
- The **sound world** is a single object — the *engine* (`src/audio/engine.ts`) —
  that owns all the Tone.js machinery. **It never imports React.**
- Exactly **one** piece of code connects them: a "bridge" hook,
  `src/hooks/useEngineSync.ts`. It watches the data and tells the engine to catch
  up. Sound flows one way: data changes → engine reacts.

Why split it this way? Because it keeps the two clocks from interfering. React can
re-render as much as it wants; that's just the data world repainting. The engine
keeps playing on the audio clock, undisturbed, until the bridge hands it a
deliberate update. Neither side can accidentally reach into the other and cause a
glitch.

This is a very common and very powerful pattern, worth recognizing by name: it's
**unidirectional data flow with a single integration point.** The store is the
"source of truth"; everything else is a *view* or a *reaction*.

---

## 3. The "no wrong notes" trick: store the idea, not the pitch

Here's the elegant part. How do you guarantee a kid can't play a wrong note?

The naive way would be to let them pick any piano key and then *check* whether it's
"allowed." That's fragile — you'd need that check in a dozen places.

Instead, the app **never stores an actual pitch at all.** A note is stored as a
*scale degree* (the 1st, 2nd, 3rd... step of the scale) plus an octave:

```ts
// from the Note type — not "the note C#", but "the 3rd step of the scale"
{ degree: 2, octave: 0, start: 4, duration: 2 }
```

The real pitch is computed only at the last possible moment — when a note is about
to play — by `degreeToMidi()` in `src/lib/scales.ts`:

```ts
midi = baseMidi(root) + 12*octave + SCALES[scale][degree % len] + 12*floor(degree / len)
```

Because the scale table (`SCALES`) only *contains* in-key notes, there is **no
representable wrong note.** The piano-roll rows are scale degrees, so clicking row 3
literally means "the 3rd note of the scale," whatever scale that currently is.

This buys two things almost for free:

1. **Change the key or the mood instantly.** Flip the project from `majPent`
   (happy) to `minPent` (moody) and *every* note in the whole song re-pitches,
   in-key, with zero data changes — because the stored degrees never moved, only
   the table they're looked up in.
2. **Chords and the ✨ Surprise generators are in-key by construction.** A "triad"
   is just the offsets `[0, 2, 4]` *in scale steps* (`CHORD_SHAPES` in `scales.ts`).
   Stack scale steps and you can't land out of key — so the generators in
   `src/lib/generators.ts` can scribble random patterns and they always sound
   intentional.

The lesson: **choosing the right representation makes whole categories of bugs
impossible.** "No wrong notes" isn't enforced by validation; it's enforced by the
fact that a wrong note can't even be written down.

---

## 4. Two rules about who is allowed to drive whom

These two rules are the practical form of "sound is never driven by the screen."

**Rule A — All sound is scheduled on the audio clock, never on a timer or a frame.**
Every drum hit and every note is handed to Tone.js's transport *ahead of time*, and
fires from inside a `Tone.Part` callback using the callback's own precise `time`
argument (see `src/audio/scheduler.ts`). The code never uses `setTimeout`,
`setInterval`, or an animation frame to *make* a sound. Those are screen-world tools;
they jitter. The audio clock does not.

**Rule B — The moving visuals *read* the audio clock; they never keep their own
time.** There is exactly one `requestAnimationFrame` loop in the whole app for
timing, in `src/audio/transportClock.ts`. Look at what it does each frame:

```ts
const seconds = Tone.getTransport().seconds;   // ASK the audio clock
const ticks   = Tone.getTransport().ticks;     // ...where are we?
// ...turn that into a playhead position and notify subscribers
```

It never adds up its own elapsed time. It just *asks the sound where it is* and
moves the playhead to match. So if the screen stutters, the playhead doesn't
drift — the next good frame snaps it right back onto the audio. The playhead
literally cannot get ahead of or behind the music.

---

## 5. "Read the audio, draw it" — a pattern you'll see three times

Rule B generalizes into a little pattern used everywhere something needs to animate
in time with sound:

> Tap a *read-only* probe into the audio, run one animation-frame loop that reads
> the probe and draws the result **imperatively** (straight to the DOM/canvas),
> and keep React entirely out of it.

It shows up three times:

| Thing that moves | The probe it reads | Where |
|---|---|---|
| **Playhead** (the line sweeping the grid) | the transport clock | `src/components/transport/Playhead.tsx` |
| **Level meters** (the bars in the mixer) | a `Tone.Meter` on each channel | `src/components/mixer/MeterBar.tsx` |
| **Visualizer** (bars / scope / blob) | two `Tone.Analyser` taps on the master bus | `src/components/visualizer/Visualizer.tsx` |

Two things make this safe and smooth:

- The probes are **pure reads.** A meter or analyser tap listens to the signal but
  doesn't change it, so adding the visualizer cannot affect the timing or the sound
  one bit. (The master output node was deliberately left as an obvious "tap here
  later" seam back in phase 1 — phase 7's visualizer just hung two analysers off it.)
- The drawing is **imperative**, not React state. If the playhead updated React
  state 60 times a second, React would re-render 60 times a second and the app would
  crawl. Instead these components grab a DOM/canvas ref *once* and poke it directly
  in the animation loop. React renders the *static* parts; the animation loop
  handles the *moving* part.

---

## 6. The engine as a "reconciler": describe the goal, let it diff

The bridge (`useEngineSync.ts`) doesn't tell the engine *how* to change. It hands
over the current data and says "make yourself match this." The engine figures out
the difference. The key method is `engine.syncInstruments(instruments)`:

- An instrument in the data but not yet in the engine → **create** a voice.
- One in both → **update** it in place (change its waveform, filter, etc.).
- One in the engine but no longer in the data → **dispose** of it (free the audio
  nodes so they don't leak).

This "diff by id, then create/update/dispose" idea is exactly how React itself
keeps the screen in sync with your data — here it's applied to *audio nodes*
instead of DOM nodes. Once you've seen it in one place you'll see it everywhere; it's
one of the most reusable ideas in the whole field.

There's a small but important performance wrinkle in the bridge. Changes split into
two kinds:

- **Cheap, live changes** (turn up the filter, change the waveform) go straight
  through — you hear them immediately.
- **Structural changes** (you painted a drum cell, switched clips, changed key) need
  the playback schedule *rebuilt*, which is more expensive. Those are **debounced**
  ~80ms (`rebuild()` in `useEngineSync.ts`): while you're dragging a slider or
  scribbling cells, the engine waits for you to pause, then rebuilds once. The loop
  picks up your edits on its next time around. Smooth to use, cheap to run.

---

## 7. Why "just a plain object" was the most important choice

The `Project` is deliberately a **plain, serializable JavaScript object** — no class
instances, no Tone.js objects hiding inside it, nothing that can't survive
`JSON.stringify`. That single constraint paid for several whole features almost for
free:

- **Autosave** (phase 3) = `JSON.stringify` the project into the browser's
  `localStorage` on a debounce. That's nearly the whole feature.
- **Save / open a file** = download that same JSON as a `.vnjam.json`; opening one
  is `JSON.parse` + a tolerant validator. Share a song by sending a file.
- **Export to WAV/MP3** (phase 6) = hand the *same* project object to an offline
  renderer (`src/audio/offline.ts`) that rebuilds the audio graph inside Tone's
  offline context and renders faster than real time. Because the renderer reuses the
  *exact same* engine code as live playback, the exported file sounds like what you
  heard.

The lesson: **keep your source-of-truth data boring and portable, and features that
look unrelated — save, load, share, export, undo — turn out to be the same trick
applied in different directions.**

---

## 8. A worked example: what happens when a kid paints a drum cell

To tie it together, follow one click from finger to speaker:

1. The kid taps a cell in the **drum grid** (`src/components/drumgrid/`). The
   component calls a store action, `toggleStep(...)`.
2. The **store** flips that one boolean inside the `Project`. The data world is now
   updated. (Thanks to Immer, the action reads like a simple mutation but produces a
   new immutable object under the hood.)
3. The grid **re-renders** to show the cell lit. That's the data world repainting —
   no sound involved yet.
4. The **bridge** (`useEngineSync`) was subscribed to `project.clips`. It notices the
   change and schedules a debounced `rebuild()`.
5. ~80ms later the **engine** rebuilds the looping `Tone.Part` from the updated clip.
6. On the loop's **next pass**, the transport fires that part's events on the audio
   clock — and the new drum hit plays, perfectly in time.

Notice the click never *directly* made a sound. It changed *data*; the sound world
reacted on its own clock. That indirection is the whole point — it's what keeps the
beat tight no matter what the screen is doing.

---

## 9. Where to look in the code

```
src/
  model/       The data shapes. types.ts = every interface in the Project.
               defaults.ts = how a fresh, fun-on-first-open project is built.
  lib/         Pure logic, no audio, no React:
               scales.ts     -> the "no wrong notes" math (start here)
               generators.ts -> the ✨ Surprise pattern makers
               sections.ts   -> song-section templates
  audio/       The sound world (the only place Tone.js is imported):
               engine.ts        -> the public facade everything else calls
               scheduler.ts     -> turns clips/songs into Tone.Parts (timing rules)
               transportClock.ts-> the ONE animation-frame clock
               InstrumentVoice.ts, drums.ts, effects.ts, offline.ts
  store/       useProjectStore.ts -> the single source of truth + all actions
  hooks/       useEngineSync.ts -> the ONE bridge (data -> sound)
               useAutosave.ts   -> data -> localStorage, same subscription trick
  components/  The screen: transport bar, drum grid, piano roll, instrument panel,
               song view, mixer, coach overlay, visualizer
```

A good reading order if you're learning from this codebase:
`scales.ts` → `model/types.ts` → `useProjectStore.ts` → `useEngineSync.ts` →
`transportClock.ts` → `engine.ts`. That path walks you from the data, across the
bridge, into the sound.

---

## 10. Hard-won lessons (the bugs that taught us the rules)

- **Don't create a brand-new array inside a store selector.** A Zustand selector
  that returns `something.map(...)` makes a *fresh* array every render; the store
  sees "a new value" every time and re-renders forever — an infinite loop. The fix,
  used throughout, is to select the *stable* reference and do the `.map()` in the
  component's render instead. We hit this more than once; it's a classic.
- **Animate imperatively, not through React state.** (See §5.) 60-times-a-second
  React updates will melt the app; a ref poked in an animation frame won't.
- **Pick the representation that makes bad states unrepresentable.** (See §3.)
  Storing scale degrees instead of pitches deleted a whole class of bugs.
- **Leave obvious seams for later.** The master output node was left as a tap point
  five phases before the visualizer existed; the `Project` was kept JSON-clean long
  before save/load/export were built. Cheap foresight, large payoff.

---

*If you read only one file to understand the magic, read `src/lib/scales.ts`. If you
read only one to understand the architecture, read `src/hooks/useEngineSync.ts` —
the whole "two worlds, one bridge" idea lives in 60 lines there.*

*Made for the boys. 🎵*
