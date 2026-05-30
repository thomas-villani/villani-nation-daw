# VillaniNation Studio — Implementation Tracker

A scale-locked music studio for kids (spec codename "Loopa"; full design in
[`fruityloops-for-kids-spec.md`](./fruityloops-for-kids-spec.md)). This doc tracks
build progress across the spec's 8 phases. Update it as phases land.

**Stack:** Vite + React + TypeScript + Tone.js + Zustand + Tailwind. Desktop
browser first. npm (not uv). Windows dev box.

**Run:** `npm run dev` → http://localhost:5173 (click **Play** to start audio).
**Build / typecheck:** `npm run build` · `npm run typecheck`.

---

## Status at a glance

| Phase | Scope | Status |
|---|---|---|
| 1 | Audio engine spike (loop + synced playhead) | ✅ Done |
| 2 | Clip editor + instruments (drum grid, piano roll, synth panel, jam) | ✅ Done |
| 3 | Project model + persistence (localStorage autosave, JSON import/export) | ✅ Done |
| 4 | Multiple clips per instrument + chord stamp brush | ⬜ Not started |
| 5 | Song view (sections, arrangement timeline, automation, templates) | ⬜ Not started |
| 6 | Mix & export (mixer panel + meters, WAV/MP3 via `Tone.Offline`) | ⬜ Not started |
| 7 | Polish (generators / ✨ Surprise, coach overlay, audio visualizer) | ⬜ Not started |
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
- `engine.scheduleArrangement()` stub → phase 5.
- Master `Gain` node in the engine → phase 7 analyser tap.
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

### ⬜ Phase 4 — Multiple clips + chord stamp
Clip selector/duplicate per instrument; chord-mode brush on the piano roll that
stamps diatonic chord shapes (Triad/Power/7th/Sus) as normal editable notes.

### ⬜ Phase 5 — Song view
Section blocks, arrangement timeline, per-section clip assignments, automation
lanes + ramps, section templates (Build/Drop/Bridge/Outro). Wire
`engine.scheduleArrangement()`.

### ⬜ Phase 6 — Mix & export
Mixer panel (faders/mute/solo/pan + drum sub-mixer + `Tone.Meter` level meters);
render to WAV (and optional MP3) via `Tone.Offline`.

### ⬜ Phase 7 — Polish
Generators (incl. ✨ Surprise song), coach overlay, audio visualizer
(`Tone.Analyser` off the master bus).

### ⬜ Phase 8 — Optional Electron wrap
Sample-folder browser, native save, packaged installer.

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
