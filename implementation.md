# VillaniNation Studio — Implementation Tracker

A scale-locked music studio for kids (spec codename "Loopa"; full design in
[`fruityloops-for-kids-spec.md`](./fruityloops-for-kids-spec.md)). This doc tracks
build progress across the spec's 8 phases. Update it as phases land.

**Stack:** Vite + React + TypeScript + Tone.js + Zustand + Tailwind. Desktop
browser first. npm (not uv). Windows dev box.

**Run:** `npm run dev` → http://localhost:5173 (click **Play** to start audio).
**Build / typecheck:** `npm run build` · `npm run typecheck`.
**Live:** auto-deployed to GitHub Pages on push to `main` —
[thomas-villani.github.io/villani-nation-daw](https://thomas-villani.github.io/villani-nation-daw/).
**Design narrative:** [`ARCHITECTURE.md`](./ARCHITECTURE.md) (the "why" companion to
this build log).

---

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 1 | Audio engine spike (loop + synced playhead) | ✅ Done |
| 2 | Clip editor + instruments (drum grid, piano roll, synth panel, jam) | ✅ Done |
| 3 | Project model + persistence (localStorage autosave, JSON import/export) | ✅ Done |
| 4 | Multiple clips per instrument + chord stamp brush | ✅ Done |
| 5 | Song view (sections, arrangement timeline, automation, templates) | ✅ Done |
| 6 | Mix & export (mixer panel + meters, WAV/MP3 via `Tone.Offline`) | ✅ Done |
| 7 | Polish (generators / ✨ Surprise, coach overlay, audio visualizer) | ✅ Done |
| 8 | Optional Electron wrap (sample-folder browser, native save, installer) | ⬜ Not started |

---

## Architecture (the load-bearing decisions)

- **Store is the only source of truth.** `src/store/useProjectStore.ts` holds a
  serializable `Project` (+ small UI state). It never imports Tone.
- **Engine is a singleton facade.** `src/audio/engine.ts` owns the Tone graph and
  is reconciled *from* the store by **one** bridge, `src/hooks/useEngineSync.ts`,
  via selector subscriptions — so React never touches audio and 60fps edits don't
  trigger re-renders.
- **Notes = scale degree + octave**, never absolute pitch. Resolved to MIDI/freq
  only at playback in `src/lib/scales.ts` (spec §3.1). Changing key/scale
  re-pitches the whole song in-key with zero data migration.
- **One rAF for timing.** `src/audio/transportClock.ts` *reads* the Tone transport
  clock each frame to drive the playhead — never integrates its own time, so no
  drift.
- **All sound is scheduled via `Tone.Transport`/`Tone.Part`** (spec §4.1). Never
  `setTimeout`/`setInterval`/rAF for audio.

### Seams already in place for later phases
- `Project` is plain JSON → phase 3 persistence = `JSON.stringify`/hydrate.
- `engine.scheduleArrangement()` → **implemented in phase 5** (walks the arrangement).
- Master `Gain` node in the engine → **used in phase 7**: two `Tone.Analyser` taps
  (FFT + waveform) hang off it to feed the visualizer.
- Uniform `{ trigger, output, dispose }` voice/pad interface → reused by the
  phase-5 arrangement walker.
- Pure scale math (`lib/scales.ts`) → reused by phase-4 chord stamp + phase-7
  generators.

---

## Phase detail

### ✅ Phase 1 — Audio engine spike
`Tone.Transport` loops the active clips; procedural kick/snare/hat/clap; visual
playhead synced to the audio clock with no drift.
Files: `src/audio/{engine,scheduler,transportClock,drums,InstrumentVoice}.ts`,
`src/components/transport/Playhead.tsx`.

### ✅ Phase 2 — Clip editor + instruments
- **Drum grid** (`src/components/drumgrid/`): tap-to-toggle 16-step lanes, per-pad
  mute, `.wav`/`.ogg` drag-drop onto a lane to swap a pad's sound.
- **Scale-degree piano roll** (`src/components/pianoroll/PianoRoll.tsx`): every row
  in-key, home/root marked ★, click-add / click-remove / drag-to-lengthen.
- **Instrument panel** (`src/components/instruments/InstrumentPanel.tsx`):
  mono/poly/FM, waveform, voices/detune, filter cutoff+resonance, friendly +
  advanced ADSR, glide, toggleable distortion/reverb/delay.
- **Multi-instrument jam**: add Synth/Drums tracks, per-track mute, phase-locked
  loop; transport bar (tempo/swing/key/scale/volume).
- Verified end-to-end in Chrome incl. scale re-pitch (majPent → minor).

### ✅ Phase 3 — Project model + persistence
- **`src/lib/persistence.ts`**: the only module that touches `localStorage` and
  file blobs. `serialize`/`deserialize` (with tolerant `validateProject` — rejects
  wrong version / missing instruments-clips-key, fills phase-5 fields), `saveToLocal`
  / `loadFromLocal`, `downloadProject` (→ `<name>.vnjam.json`), `readProjectFile`.
- **Autosave** (`src/hooks/useAutosave.ts`): subscribes to `project` outside the
  render cycle (same pattern as the engine bridge), debounced 800ms → localStorage,
  then stamps `ui.lastSavedAt` to drive the "Auto-saved ✓" hint.
- **Startup hydrate**: the store seeds from `loadFromLocal() ?? makeDefaultProject()`
  so a kid's last jam reopens automatically.
- **`ProjectMenu`** (in the transport bar): editable jam name, ✨ New (with confirm),
  ⬇ Save File (download JSON), ⬆ Open (file picker → validate → `replaceProject`).
  Loading stops the transport first so the playhead doesn't point at a stale loop.
- **Store**: added `newProject` / `replaceProject` / `renameProject` / `markSaved`.
  Whole-project swaps resync cleanly through the existing bridge (instruments diff by
  id → dispose/create; clips/key → rebuild Parts) — no engine changes needed.
- *Known limit:* sample pads loaded via drag-drop use ephemeral `blob:` object URLs
  that don't survive a reload (procedural pads + all notes/steps round-trip fine).
  Resolved later by a bundled sound set / embedding samples.
- Verified in Chrome: rename → autosave to localStorage, JSON round-trips, zero
  console errors.

### ✅ Phase 4 — Multiple clips + chord stamp
- **Multiple clips per instrument.** The model already held a flat `clips[]` keyed
  by `instrumentId`; what was missing was *which* clip is live. Added a **sparse**
  `ui.activeClipByInstrument` map (instrumentId → clipId) — a missing entry falls
  back to the instrument's first clip, so loading a project or adding clips needs
  no eager bookkeeping. The active clip is both what the editor shows AND what the
  jam loops.
- **`ClipBar`** (`src/components/clips/ClipBar.tsx`, above the editor): clip pills
  per instrument — click to switch, double-click to rename, ✕ to delete (kept ≥1),
  `＋` new empty clip, `⧉ Copy` to duplicate the current pattern. Store actions
  `selectClip` / `addClip` / `duplicateClip` / `removeClip` / `renameClip`.
- **Engine bridge** now also subscribes to `ui.activeClipByInstrument`, so switching
  the active clip re-jams through the existing debounced `loadJam` — no engine
  changes. `selectActiveClips(project, activeMap)` resolves the live clip per track.
- **Chord-stamp brush** on the piano roll: a Brush selector (● Note · Triad · Power ·
  7th · Sus). Chord shapes live in `lib/scales.ts` as **diatonic scale-step offsets**
  (`triad [0,2,4]`, `power [0,4]`, `seventh [0,2,4,6]`, `sus [0,3,4]`) — stacked in
  *scale steps*, not semitones, so a stamped chord is always in-key for any
  key/scale (the "no wrong notes" rule still holds). Each tone is a normal,
  independently editable `Note`; the drag preview shows the whole stack and all
  tones audition on stamp. New batch action `addNotes(clipId, notes)`.
- **Drive-by fix:** `addInstrument` now gives a *drum* track a starter clip too
  (previously only synths got one, so a freshly added drum kit had nothing to edit).
- Verified in Chrome: add 2nd clip pill, switch tracks, Triad stamp adds exactly 3
  in-key notes to the active clip (persisted round-trip), zero console errors.

### ✅ Phase 5 — Song view
- **Two modes.** A Jam/Song toggle in the transport bar (`ui.mode`). Jam loops the
  active clips (phase 4); **Song** walks the `arrangement` — an ordered list of
  `Section` ids. The engine bridge picks `loadJam` vs `scheduleArrangement` by mode
  and re-syncs on any change to clips/key/active-clip (jam) or mode/sections/
  arrangement (song).
- **Section templates** (`src/lib/sections.ts`): the seven `SectionType`s each carry
  a kid preset — label/emoji/color, default bars, which instrument *kinds* it
  silences, and the automation "moves" it pre-fills. `makeSection(type, instruments)`
  (in `model/defaults.ts`) builds one with **sparse** clip assignments (a missing
  entry = "play this track's default clip", an explicit `null` = silent), mirroring
  the jam's active-clip fallback so adding tracks later needs no section bookkeeping.
- **`engine.scheduleArrangement`** (`audio/scheduler.ts` → `buildSong`): walks the
  sections accumulating a bar offset; for each instrument it resolves the section's
  clip and repeats it to fill the section length, emitting events at absolute song
  time into one looping `Tone.Part` per instrument (the whole song loops as a unit).
  Each section's automation is scheduled via `Transport.schedule` at its start: a
  param with a lane **ramps** (`linear`/`exponential`), a param without one **snaps
  back to the instrument's home value** — so a build's open filter never bleeds into
  the next section (spec §5.7).
- **Automation targets.** `InstrumentVoice` gained a dedicated `autoGain` (0..1,
  home = 1) inserted `panner → autoGain → volume`, so section volume swells/fades are
  a temporary move that *returns to the mix* rather than overwriting the kid's fader.
  `getAutomationSignal(param)` exposes `filter.cutoff` (voice filter), `volume`
  (autoGain), and `effect.reverb.wet`/`effect.delay.wet` (when the effect is on);
  `resetAutomation` snaps everything home when leaving song mode.
- **Song view UI** (`src/components/song/`): `SongView` = a section palette + an
  **✨ Auto-arrange** button (assembles Intro→Verse→Build→Drop→Bridge→Build→Drop→Outro
  from existing clips) + a proportional-width timeline with a bar ruler and a song
  playhead. `SectionInspector` = rename / type / length / reorder / duplicate /
  delete, plus per-instrument **clip dropdown** (Default / a clip / 🔇 Silent) and
  editable **automation chips** ("Filter: muffled → open", "Volume: 55% → full").
- **Zustand pitfall (again):** `SongView` selects the stable `arrangement` +
  `sections` refs and resolves play order *in render* — an early version selected a
  freshly-mapped array and hit the infinite-render loop (caught in the browser).
- Verified in Chrome: Auto-arrange builds the 8-section shape, adding a section +
  Silent assignment + automation chips all work, **playback in Song mode runs with
  zero console errors**, and Jam↔Song round-trips cleanly.

### ✅ Phase 6 — Mix & export
- **Mixer "board"** (`src/components/mixer/`): a bottom drawer toggled by 🎚️ Mixer in
  the transport bar (`ui.showMixer`). One `ChannelStrip` per instrument — vertical
  **fader** + live **meter**, **Mute**/**Solo**, **Pan** — all writing to the
  `Instrument`'s channel state, which is part of the `Project` JSON, so **saving the
  song saves the mix** (spec §5.7). Drum channels expand to a **sub-mixer**: a
  mini-fader + mute per pad (`DrumPad.gain`/`mute`).
- **Solo is a whole-board decision**, so it can't live in one voice. `engine.syncInstruments`
  computes `anySolo` and silences every non-soloed channel, folding it on top of each
  channel's own mute via a `silenced` flag passed to `InstrumentVoice.applyConfig`.
- **Level meters.** Each `InstrumentVoice` taps a `Tone.Meter` (normalRange) off its
  post-fader signal — a pure read, zero audio effect. `MeterBar` runs one rAF per
  strip, reading `engine.getMeterLevel(id)` and writing the fill height imperatively
  (the same "read the audio, draw it" pattern as the playhead — no 60fps React churn).
- **Offline render** (`src/audio/offline.ts`): `renderProject` wraps `Tone.Offline`,
  which swaps the global context for an `OfflineContext`. We **rebuild a fresh graph**
  from the `Project` inside the callback — reusing the very same `InstrumentVoice` +
  `buildSong`/`buildJam` the live engine uses — so the render matches what the kid
  hears (levels, mutes/solos, effects, automation). Song mode walks the arrangement
  once (loop disabled, +2s tail so the last notes ring out); with no arrangement yet
  it loops the active jam clips ×4. Reverb impulse responses are awaited (`whenReady`)
  before rendering so tails aren't lost.
- **Encoders.** `audioBufferToWav` (16-bit PCM, no deps, lossless) and
  `audioBufferToMp3` (`@breezystack/lamejs`, dynamically imported so it's code-split
  and failures stay contained — "send the song to grandpa" as a small file). Export
  stops live playback first (the offline render briefly owns the audio context).
- Verified in Chrome (headless): mixer renders both strips with faders/meters/pan +
  the expanded drum sub-mixer; Play animates meters; **WAV (~1.8 MB) and MP3 (~225 KB)
  both render and download** from the default jam, with **zero console errors**.

### ✅ Phase 7 — Polish
- **✨ Surprise generators** (`src/lib/generators.ts`): pure functions on the *model*
  (never raw audio), so everything they make is in-key for any key/scale (the "no
  wrong notes" rule still holds). `surpriseBeat` (kick on beats + backbeat snare +
  hat pattern + the odd clap), `surpriseBass` (root-led pulse), `surpriseMelody`
  (sparse, singable, with rests), `surpriseChords` (a canned I–V–vi–IV stamped as
  scale-step triads). They use `Math.random` for variety — each click is a
  fresh-but-tasteful pattern. Two store actions write the result wholesale into the
  active clip: `setClipSteps` / `setClipNotes` (so the existing engine bridge re-jams
  through the debounced `loadJam`, no engine change). Buttons live where the context
  is: **✨ Surprise beat** in the drum grid header; **🎵 Melody / 🎸 Bass / 🎹 Chords**
  in the piano-roll header. **✨ Surprise song** is the phase-5 **Auto-arrange** in the
  song view (assembles a full track from existing clips).
- **Coach overlay** (`src/components/coach/CoachOverlay.tsx`): a **non-blocking** banner
  under the transport bar that nudges through *beat → bass → melody → chords → arrange*.
  It only **reads** the project (selects the stable `project` ref, derives in render —
  no fresh-array selector) and **auto-advances** to the first incomplete step (steps
  detected from the data: a drum clip has steps, melodic notes exist, ≥8 notes, a
  chord = ≥2 notes sharing a start, arrangement ≥3 sections). Cheers when the whole
  shape exists. Dismissable; reopen from 🧭 in the transport bar (`ui.showCoach`).
- **Audio visualizer** (`src/components/visualizer/Visualizer.tsx`, spec §5.8 "for
  Louie 🎇"): two `Tone.Analyser` taps (FFT 64 + waveform 256) hang off the engine
  master bus — **pure reads, zero effect on the audio**, so they can't hurt timing.
  A self-contained floating `<canvas>` card with one rAF reads the analysers each
  frame and draws one of three kid-switchable styles: **📊 Bars** (spectrum, cyan→pink
  gradient), **〰️ Scope** (oscilloscope — *see* a saw vs sine), **🫧 Blob** (a pulsing
  radial glow driven by bass energy + overall loudness). Toggled by 🎇 in the
  transport bar (`ui.showVisualizer`).
- Verified in Chrome (headless): coach banner advances with the project, the
  visualizer animates on Play and cycles bars/scope/blob, ✨ Surprise beat fills the
  drum grid and ✨ Chords stamps an in-key triad — **zero console errors**;
  typecheck + production build clean.

### ⬜ Phase 8 — Optional Electron wrap
Sample-folder browser, native save, packaged installer.

---

## Deployment & docs (post-phase-7)
- **CI deploy to GitHub Pages.** `.github/workflows/deploy.yml` builds (`npm ci` +
  `npm run build`) and publishes `dist/` via the official Pages actions
  (`upload-pages-artifact` + `deploy-pages`) on every push to `main`. One-time repo
  setup: Settings → Pages → Source = "GitHub Actions."
- **Vite `base`.** `vite.config.ts` sets `base: '/villani-nation-daw/'` for
  `command === 'build'` only (dev/preview stay at `/`), so production assets resolve
  under the Pages sub-path. Verified the built `index.html` references
  `/villani-nation-daw/assets/...`. (The drums are procedural and nothing fetches
  from an absolute `/` path, so the sub-path is safe.)
- **`ARCHITECTURE.md`.** A narrative, teaching-oriented writeup of the design (the
  two-clocks problem, "no wrong notes" via scale-degree storage, the data/sound
  split + one bridge, "read the audio / draw it," the engine reconciler, a worked
  example) — the "why" companion to this phase log. Linked from the README.

## UX polish (post-phase-7 feedback)
- **Decluttered top bar.** The transport bar overflowed on smaller screens. It now
  keeps only the essentials — Play, 🔁Jam/🎬Song, Tempo, Key, Scale — and a new
  `⚙ More` click-away popover (`src/components/transport/MoreMenu.tsx`) holds Swing,
  Volume, the 🎚️Mixer/🎇Visualizer/🧭Coach toggles, and the File cluster. Keeping
  the bar uncrowded also keeps the **🎬 Song** toggle (the entry to the arrangement
  timeline) on-screen — the "where's the song view?" was a discoverability symptom of
  the overflow. `ProjectMenu` was reworked to a vertical layout for the menu.
- **✨ New asks blank vs. starter.** `newProject(blank)` + `makeEmptyProject()`: New
  now offers **🆕 Blank canvas** (empty drum+bass clips → coach resets to step 1) or
  **🎵 Starter jam** (the fun pre-filled project). Fixes "New stayed pre-populated and
  the coach was stuck mid-way" — the coach reads completion from the data, so a blank
  project resets it cleanly. New also returns to jam mode.
- **Synth presets** (`src/lib/synthPresets.ts`): a "Sounds" chip row above the voice
  controls (Deep Bass, Buzzy Bass, Bright Lead, Soft Pad, Pluck, Dreamy, FM Bell,
  Organ). Each is a complete `SynthConfig` stamped via `updateSynthConfig` so every
  control visibly jumps — exploration-first.
- **`? Help` mode** in the instrument panel: a toggle that reveals a one-line,
  kid-friendly blurb under each control (engine, wave, voices, detune, brightness,
  resonance, attack, release, glide, effects). Off by default; `Slider` gained
  optional `help`/`showHelp` props.

---

## Open questions / decisions
- Bundled sound set (curate ~1 drum kit + a few synth presets into
  `public/samples/`) — deferred; drag-drop works today via object URLs.
- Velocity editing stays binary on/off for now; velocity lane is an "advanced"
  add later (spec §7.4).

---

## Verification checklist (per the plan)
- Loop plays tight; playhead stays locked to audio over minutes (no drift).
- Drum edits reflect on the next loop; pads audition on click; `.wav` drop swaps a
  pad.
- Piano roll rows are all in-key; switching scale/root re-pitches melodies with no
  re-entry.
- Synth/FX changes are audible live; multiple instruments stay phase-locked.
- Song mode plays the arrangement end-to-end; per-section clip swaps + automation
  (filter sweep, fade) ramp during their section and return; ✨ Auto-arrange yields a
  playable full song; Jam↔Song round-trips cleanly.
- Mixer faders/mute/solo/pan + drum sub-mixer change the live mix and persist with
  the project; channel meters move with the audio; WAV/MP3 export renders the song
  (or jam loop) offline reproducing the mix exactly.
- ✨ Surprise generators fill a clip with an in-key beat/bass/melody/chords; the coach
  banner advances as the kid builds; the visualizer animates off the master bus and
  switches bars/scope/blob — all with zero console errors.
