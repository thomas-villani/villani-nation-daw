# Loopa — Technical Spec (v1)

> A music studio for kids. Two modes: **Jam** (make a loop in 30 seconds) and **Song** (build a full track: intro → verse → bridge → drop → outro, with variations and automation). Scale-locked so there are no wrong notes. Built to be handed to Claude Code.

*"Loopa" is a placeholder name.*

---

## 1. Design goals (the non-negotiables)

1. **No wrong notes.** Everything melodic is locked to a key/scale. A kid mashing the grid still sounds intentional. Pentatonic is the default; major/minor are the "level up."
2. **Fun in 30 seconds.** Jam mode + per-section "✨ Surprise" generators give instant gratification before any concept is understood.
3. **A real progression to mastery.** The kid who wants more graduates from a single loop to arranging a whole track with variations, a bridge, a drop, automation, and a fade-out — the actual shape of electronica.
4. **The wizard is optional.** A coach can nudge through beat → bass → melody → chords → arrange, but never blocks free play.
5. **Their own sounds.** Bundle a curated sample set, but let kids drop in their own `.wav`/`.ogg` packs.

---

## 2. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Build/bundler | **Vite** | Fast dev loop, no SSR needed (this is an app, not a site). |
| UI | **React + TypeScript** | The grids, piano roll, and song timeline are deeply stateful — components + a typed model pay off fast. |
| Audio | **Tone.js** | Transport/scheduling, synths, effects, samplers, and signal automation all built in. See §4. |
| State | **Zustand** | One serializable project store; trivial to save/load as JSON; no prop-drilling into deep grids. |
| Styling | Tailwind (optional) | Fine; or plain CSS. Aesthetic = chunky/tactile/toy-but-not-babyish (see prototype). |
| Persistence | localStorage + JSON import/export | Project *is* a JSON object (§3). Export audio via `OfflineAudioContext`. |
| **Phase 2 (optional)** | **Electron wrapper** | Same codebase. Adds native filesystem (scan a sample-pack folder), no autoplay gesture, shippable downloadable app. |

**Why browser-first, not native/Node:** Web Audio's timing is sample-accurate *if* you use a lookahead scheduler (Tone.js does this internally). A Node *server* can't output audio at all. Electron's renderer is Chromium, so it runs the same Web Audio code — it's a wrapper decision, deferrable. Prefer Electron over Tauri for audio specifically: Electron bundles Chromium, so Web Audio/AudioWorklet behave identically on every OS, whereas Tauri uses each platform's system webview (Safari's WebKit is the historical troublemaker for audio).

---

## 3. The data model (the spine — get this right first)

The entire app is a view onto, and editor of, one `Project` object. Save = serialize to JSON. Load = hydrate. Export-to-audio = walk the arrangement and render.

```ts
interface Project {
  version: 1;
  name: string;
  bpm: number;                 // global tempo
  swing: number;               // 0..1, Tone.Transport.swing
  key: { root: number;         // 0..11 (C..B)
         scale: ScaleName };   // 'majPent' | 'minPent' | 'major' | 'minor'
  instruments: Instrument[];
  clips: Clip[];
  sections: Section[];
  arrangement: string[];       // ordered list of Section ids = the song timeline
}

type ScaleName = 'majPent' | 'minPent' | 'major' | 'minor';

interface Instrument {
  id: string;
  name: string;                // "Bass", "Lead", "Drums", "Chords"
  color: string;               // track color
  kind: 'synth' | 'sampler' | 'drumkit';
  synth?: SynthConfig;         // when kind === 'synth'
  sampler?: { sampleUrls: Record<number, string> }; // midi -> url
  drumkit?: DrumKit;           // when kind === 'drumkit'
  // --- mixer channel state (the "board"; persists with the project) ---
  volume: number;              // 0..1 (or dB), channel fader
  mute: boolean;
  solo: boolean;               // when any channel is soloed, non-soloed channels are silenced
  pan: number;                 // -1..1
  effects: EffectConfig[];     // ordered chain (filter, distortion, reverb, delay)
}

interface SynthConfig {
  engine: 'mono' | 'poly' | 'fm';
  voices: number;              // 1–3 (your 2/3-voice request)
  detune: number;              // cents, spreads voices for thickness
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  filter: { type: 'lowpass'; cutoff: number; resonance: number };
  envelope: { attack: number; decay: number; sustain: number; release: number };
  glide: number;               // portamento (mono only)
}

interface DrumKit {
  pads: DrumPad[];             // Kick, Snare, Hat, Clap, ... (extensible)
}
interface DrumPad {
  name: string;
  source: 'procedural' | 'sample';
  proceduralId?: 'kick' | 'snare' | 'hat' | 'clap';
  sampleUrl?: string;          // user-loaded or bundled
  gain: number;                // 0..1, per-pad level (kit sub-mixer)
  mute: boolean;               // per-pad mute
}

// A Clip is a short, loopable pattern for ONE instrument.
interface Clip {
  id: string;
  instrumentId: string;
  name: string;                // "Main beat", "Drop bass", "Bridge melody"
  lengthBars: number;          // usually 1, 2, or 4
  // For melodic instruments:
  notes?: Note[];
  // For drum instruments:
  steps?: DrumStep[];          // grid hits
}

interface Note {
  // Store as SCALE DEGREE + octave, NOT absolute pitch — see §3.1
  degree: number;              // index into the active scale
  octave: number;              // octave offset
  start: number;               // in 16th-note steps from clip start
  duration: number;            // in 16th-note steps
  velocity: number;            // 0..1
}

interface DrumStep {
  padIndex: number;
  step: number;                // 16th-note step
  velocity: number;
}

// A Section is a chunk of song time that says which clip each instrument plays,
// plus how parameters move during it (automation).
interface Section {
  id: string;
  name: string;                // "Intro" | "Verse" | "Build" | "Drop" | "Bridge" | "Outro" | custom
  type: SectionType;           // drives templates & default automation
  lengthBars: number;
  clipAssignments: Record<string /*instrumentId*/, string | null /*clipId or silent*/>;
  automation: AutomationLane[];
}

type SectionType = 'intro' | 'verse' | 'build' | 'drop' | 'bridge' | 'breakdown' | 'outro';

interface AutomationLane {
  instrumentId: string;
  param: 'filter.cutoff' | 'volume' | 'effect.reverb.wet' | 'effect.delay.wet';
  from: number;
  to: number;
  curve: 'linear' | 'exponential';   // ramp across the section's duration
}
```

### 3.1 Why notes are stored as scale degrees, not MIDI
If a note is `{degree: 0, octave: 0}` ("home"), then switching the project's `key.scale` from happy to moody, or transposing `key.root`, **re-maps the entire song in-key automatically** — every melody stays diatonic. "Make the whole song happier/sadder" becomes a one-control change. Resolve degree+octave → MIDI → frequency only at playback time:

```
midi(note) = baseMidi(key.root) + 12*note.octave + SCALES[key.scale][note.degree % len]
            + 12*floor(note.degree / len)
```

---

## 4. Audio engine (Tone.js)

### 4.1 Timing — the one thing not to get wrong
- All scheduling goes through `Tone.Transport`. Never trigger sound off `setTimeout`/`setInterval`/`requestAnimationFrame`.
- `Tone.Transport` runs a lookahead scheduler on the sample-accurate audio clock. You give it musical times (`"0:0:0"`, `"+8n"`); it fires precisely regardless of main-thread jank.
- The **visual playhead** is the *only* thing driven by `requestAnimationFrame`, and it reads `Tone.Transport.seconds`/`.position` to stay synced to the audio clock (don't run a parallel JS timer — it'll drift from the audio).
- Resume the context on first user gesture (Play button) to satisfy autoplay policy: `await Tone.start()`.

### 4.2 Instrument → Tone object mapping
- `synth` (mono) → `Tone.MonoSynth`; (poly) → `Tone.PolySynth`; (fm) → `Tone.FMSynth`. `voices`/`detune` via a small `Tone.PolySynth` or stacked detuned oscillators for thickness.
- `drumkit` procedural pads → the kick/snare/hat/clap generators from the prototype (oscillator+envelope / filtered noise). Sample pads → `Tone.Player`.
- `sampler` → `Tone.Sampler` (auto-pitches a few sample points across the keyboard).
- `effects` chain → `Tone.Filter`, `Tone.Distortion`, `Tone.Reverb`, `Tone.FeedbackDelay`, wired in order into the instrument's output, then to a per-instrument `Tone.Volume`, then master.

### 4.3 Playback
- **Jam mode:** loop a single clip per instrument. `Tone.Transport.loopEnd = "Nm"`, `loop = true`; schedule clip notes with `Tone.Part`.
- **Song mode:** walk `arrangement`. For each section, schedule its assigned clips at the right bar offset (looping the clip to fill the section length), and schedule its automation as `param.rampTo(to, sectionDuration)` at the section's start time. Fade-out = a `volume.rampTo` automation on the outro section.

### 4.4 Saving the mix & exporting audio
- **Save the mix:** the mixer is just channel state on each `Instrument` (volume/mute/solo/pan) plus per-pad `gain`/`mute` — all part of the `Project` JSON, so it persists automatically with save/load (§3). No separate "mix file" needed. Per-*part* loudness changes (drums quieter in the bridge, swell into the drop) are **section automation**, not channel state — see §5.7.
- **Render for export:** yes. `Tone.Offline(...)` (wraps `OfflineAudioContext`) renders the whole arrangement — respecting the mixer levels, mutes/solos, effects, and automation — to an `AudioBuffer` faster-than-realtime, fully client-side, no server. Encode to **WAV** (simple, lossless) for download. Optionally add **MP3** via a small encoder lib (e.g. `lamejs`) so "send the song to grandpa" is a small file. "Save your song" → `.wav`/`.mp3`.

---

## 5. UI surfaces

### 5.1 Global transport bar
Play/stop, tempo, master volume, key (root) + scale selectors, swing. (Already prototyped.)

### 5.2 Clip editor — two views sharing one component
The melodic editor and the chord editor are **the same piano-roll component** with a mode toggle.

- **Drum grid:** lanes × 16 steps, one row per pad. Tap to toggle. (Prototyped.)
- **Piano roll (melodic):** Y axis = **scale degrees** (not chromatic), so every visible row is in-key; home/root row marked. Click-drag to set note length. This is bass *and* lead (per-instrument piano rolls).
- **Chord mode (same roll):** a chord-shape palette — `Triad`, `Power`, `7th`, `Sus` — plus a diatonic chord picker. Clicking the roll **stamps** all of a chord's notes at once, anchored on the clicked scale degree, staying diatonic via scale-lock. Stamped notes become normal editable notes afterward (so a kid can stamp a chord then nudge one note). This unifies "click individual notes" and "click chord shapes" into one tool — exactly the backing-track behavior requested.

> Implementation note: a "chord stamp" is just a brush that paints N `Note`s with the right degree offsets. No separate chord data type needed — keeps the model clean.

Each instrument can hold **multiple clips** (e.g. "Main melody", "Variation A", "Drop melody"). A clip selector lets the kid create/duplicate/name clips. Duplicate-then-tweak is how variations get made.

### 5.3 Instrument panel (synth + effects)
Waveform, voices/detune, filter cutoff+resonance, ADSR (start simple: the prototype's brightness/soft-start/tail sliders map to cutoff/attack/release; expose full ADSR as "advanced"), octave, glide. Effects: toggle + one knob each for distortion, reverb, delay.

### 5.4 Song view (the graduation step)
A horizontal timeline of **section blocks**. This is where bridge/drop/variation/automation live.
- A palette of section templates: **Intro, Verse, Build-up, Drop, Bridge, Breakdown, Outro.** Drag onto the timeline; reorder; set length in bars.
- Click a section → a panel showing, per instrument, **which clip plays** (dropdown incl. "silent") and an **automation snapshot** ("this section's filter = muffled", "the drop = wide open"). Ramps interpolate between adjacent sections automatically.
- Section templates pre-fill sensible defaults so a kid gets a satisfying result without understanding automation:
  - **Build-up:** ramp lead/synth filter cutoff *up* across the section, optional rising snare roll, volume swell. The classic tension move.
  - **Drop:** full instrumentation, filters wide open, loudest. Where the build resolves.
  - **Bridge:** swap to variation clips, often drop the drums or thin them.
  - **Outro:** `volume.rampTo(0)` fade.
- This directly encodes the song shape you described: *beat → bass → melody → variations → automation transitions → bridge → drop → fade-out.*

### 5.5 Optional coach overlay
Non-blocking banner stepping through: lay a beat → add a bassline → build a melody → add chords → (unlock) → arrange a song (alt melody, bridge, drop). Auto-advances as the kid completes each. (Prototyped at the loop level; extend with the arrange steps.)

### 5.6 Generators (per section, "✨ Surprise")
Operate on the model, never on raw audio:
- **Surprise beat:** kick on beats, backbeat snare, hat pattern.
- **Surprise bass:** root-following pulse locked to scale.
- **Surprise melody:** sparse in-scale notes with rests.
- **Surprise chords:** a canned diatonic progression (e.g. I–V–vi–IV) stamped via the chord brush.
- **Surprise song (song view):** assembles Intro/Verse/Build/Drop/Bridge/Outro from existing clips with default automation — instant full track to then edit.

### 5.7 Mixer panel
A "board" view with one channel strip per instrument:
- **Fader** (volume 0..1), **Mute**, **Solo**, **Pan** — these write to the `Instrument` channel state and persist with the project.
- **Drum sub-mixer:** the drum channel expands to show one mini-fader + mute per pad (kick/snare/hat/clap), writing to `DrumPad.gain`/`mute`. So a kid can pull the hats down or mute the clap without leaving the kit.
- A small **level meter** per channel (tap a `Tone.Meter` off each instrument output) makes it visual and alive.

**Important design distinction (worth deciding now):** there are two different "loudness" concepts, and keeping them separate avoids confusion:
1. **The mix** = each instrument's *home* level on the board. Global, one value per channel. This is what the Mixer panel edits.
2. **Per-part changes** = "drums quieter in the bridge", "everything swells into the drop." These are **section automation** (§5.4), not mixer state — they ramp a channel's level *for that section only*, then return.

I'd recommend *not* putting volume on the clip itself. Per-clip gain sounds intuitive but gets confusing fast (same instrument, three clips, three mystery volumes). Channel mix + section automation covers every real case cleanly. (If you still want per-clip gain, it's a one-field add to `Clip` — but try it without first.)

Mixer state and per-pad gains are part of the `Project` JSON, so **saving the project saves the mix**, and the offline render (§4.4) reproduces it exactly.

### 5.8 Audio visualizer (for Louie 🎇)
Cheap and worth keeping. A visualizer is just an `AnalyserNode` (Tone wraps it as `Tone.Analyser` / `Tone.FFT` / `Tone.Waveform`) tapped off the master bus. Each `requestAnimationFrame` you read the latest data and draw to a `<canvas>`. It has **zero effect on the audio** (it only reads), so it can't hurt timing, and it's ~40–80 lines.

Offer two or three styles the kid can switch between:
- **Spectrum bars** — `getByteFrequencyData` → bars rising/falling with the music. The classic, instantly readable.
- **Oscilloscope** — `getByteTimeDomainData` → the waveform squiggle. Great for *seeing* what a sawtooth vs sine looks like (ties back to the synth).
- **Reactive blob/particles** (optional, the "wow") — map overall loudness or bass energy to the size/color of a pulsing shape or a burst of particles. Pure canvas, very kid-pleasing.

Implementation note: keep it a self-contained `<Visualizer analyser={masterAnalyser} mode="bars|scope|blob" />` component so it's trivial to drop in, restyle, or remove. Bass-energy reactivity reads nicely: sum the low FFT bins for the "thump."

---

## 6. Build phases (suggested order for Claude Code)

1. **Audio engine spike.** Tone.Transport + one instrument playing one hardcoded clip on loop, with a synced visual playhead. *Goal: prove timing feels tight before building UI.*
2. **Clip editor + instruments.** Drum grid, piano roll (scale-degree rows), instrument synth/effects panel, multiple instruments, jam-mode loop playback. Port the prototype's procedural drums + sample drag-drop.
3. **Project model + persistence.** Wire everything to the `Project` store (§3); save/load JSON; localStorage autosave.
4. **Multiple clips + chord stamp.** Clip selector/duplicate; chord-mode brush on the piano roll.
5. **Song view.** Sections, arrangement timeline, clip assignments, automation snapshots, section templates (Build/Drop/Bridge/Outro).
6. **Mix & export.** Mixer panel (channel faders/mute/solo/pan + drum sub-mixer + meters); save (already JSON); render to WAV/MP3 via `Tone.Offline`.
7. **Polish.** Generators (incl. Surprise song), coach overlay extension, **audio visualizer** (§5.8).
8. **Optional.** Electron wrap: sample-folder browser, native save, packaged installer.

---

## 7. Decisions still open (defaults chosen — override freely)

1. **Target device.** Spec assumes desktop/laptop browser first. If the kids will primarily use **iPads**, flag it — Safari needs the gesture-to-unlock handled carefully and AudioWorklet has had edge cases; still doable, just worth testing early. (Affects whether Electron or a PWA is the eventual phase-2 wrapper.)
2. **How "real" Song mode gets.** Default is **section-block arrangement** (Ableton-Session-flavored: build clips, then sequence named sections). The heavier alternative is a freeform linear arrangement with per-clip placement anywhere on a timeline. Section-blocks are far more learnable and teach song structure explicitly — recommended for kids, but the model in §3 supports extending toward freeform later.
3. **Tone.js vs raw Web Audio.** Default is Tone.js (faster, batteries-included, automation built-in). Raw Web Audio teaches more and gives total control but costs weeks. Given the goal is a working tool the kids use, Tone.js is recommended.
4. **Velocity/dynamics.** Default: notes carry velocity but the editor is binary on/off for simplicity; expose a velocity lane as "advanced."
5. **Bundled sound set.** Curate ~1 drum kit + a handful of synth presets to ship in `/public` so it's fun on first open, independent of the kid loading their own packs.
