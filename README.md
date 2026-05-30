# 🎛️ VillaniNation Studio

A music studio for kids where **there are no wrong notes**. Everything melodic is
locked to a key and scale, so a kid mashing the grid still sounds intentional. Lay
down a beat, draw a bassline, and jam — fun in about 30 seconds — with a real path
to building full tracks later.

Built from [`fruityloops-for-kids-spec.md`](./fruityloops-for-kids-spec.md)
(design codename "Loopa").

**▶ Play it now:** [thomas-villani.github.io/villani-nation-daw](https://thomas-villani.github.io/villani-nation-daw/)
(desktop Chrome/Edge — click **Play** to start the audio). Curious how it's built?
[`ARCHITECTURE.md`](./ARCHITECTURE.md) walks through the design.

## What works today (phases 1–7)

- **🥁 Drum grid** — tap a 16-step grid to build a beat with procedural
  kick / snare / hat / clap. Mute pads, or drag a `.wav` onto a row to swap in your
  own sound.
- **🎹 Scale-degree piano roll** — every row is in-key (the home/root row is
  marked ★), so you can't play a wrong note. Click to add, click a note to remove,
  drag to lengthen.
- **🎼 Chord stamp** — switch the piano-roll brush from a single note to **Triad /
  Power / 7th / Sus** and one click lays down a whole chord — always in-key, and
  each note stays individually editable.
- **🗂️ Multiple clips per track** — keep several patterns per instrument (e.g.
  "Verse bass" / "Drop bass"), switch between them, duplicate, and rename. The
  highlighted clip is the one you hear.
- **🎚️ Synth + effects** — mono / poly / FM engines, waveform, voices & detune,
  filter, envelope (friendly *or* full ADSR), glide, plus toggleable distortion,
  reverb, and delay.
- **🎶 Jam mode** — multiple tracks loop together, locked tight to the beat. Set
  tempo, swing, key, scale, and master volume from the top bar.
- **🎬 Song mode** — flip from Jam to Song and arrange a whole track on a timeline
  of section blocks (Intro / Verse / Build / Drop / Bridge / Breakdown / Outro).
  Each section picks which clip every instrument plays (or goes silent) and carries
  **automation moves** — a build sweeps the filters open and swells the volume, an
  outro fades out — that ramp during the section, then return. Hit **✨ Auto-arrange**
  for an instant full song from your clips, then tweak it.
- **🎚️ Mixer + export** — a board with one channel strip per track (fader, mute,
  solo, pan, live level meter), and drum channels expand to a per-pad sub-mixer.
  When it sounds right, **Save your song** as a **WAV** (lossless) or **MP3** (small) —
  rendered right in the browser, mix and all.
- **✨ Surprise generators** — stuck? One click fills the clip with an in-key beat,
  bassline, melody, or chord progression. **✨ Surprise beat** on the drum grid;
  **🎵 Melody / 🎸 Bass / 🎹 Chords** on the piano roll; **✨ Auto-arrange** for a whole
  song. Every result is in-key by construction.
- **🧭 Coach** — an optional, never-blocking banner that walks you through *beat →
  bass → melody → chords → arrange*, lighting up each step as you do it. Hide it
  anytime.
- **🎇 Visualizer** — a little screen that dances to the music: spectrum **bars**, an
  **oscilloscope** (see what a sawtooth vs sine actually looks like), or a pulsing
  bass-reactive **blob**. Pure eye candy tapped off the master — it never touches the
  sound.
- **✨ No wrong notes** — change the key or scale and your whole song re-pitches
  *in-key* instantly (happy ↔ moody with one control).
- **💾 Never lose a jam** — every edit auto-saves to your browser and reopens next
  time. Name your jam, start a fresh one, or **Save File** / **Open** it as JSON to
  share or back up.

See [`implementation.md`](./implementation.md) for the full progress tracker. The
only thing left is an optional Electron desktop wrapper (sample-folder browser,
native save, installer).

## Quick start

```bash
npm install
npm run dev      # → http://localhost:5173
```

Click **▶ Play** to start the audio (browsers require a click before sound).

Other scripts:

```bash
npm run build      # production build
npm run typecheck  # type-check only
```

> Desktop browser first (Chrome/Edge). An Electron wrapper is a possible later
> phase.

## How it's built

| Layer | Choice |
|---|---|
| Build | Vite |
| UI | React + TypeScript |
| Audio | Tone.js (transport, synths, effects, sampling) |
| State | Zustand (one serializable `Project` object) |
| Styling | Tailwind |

**Core idea:** the Zustand store is the single source of truth for a serializable
`Project`; a singleton Tone.js engine is reconciled *from* the store by one bridge
hook, so the UI never touches audio directly. Notes are stored as **scale
degree + octave** and resolved to pitch only at playback — which is why changing
key/scale re-pitches everything in-key for free.

📖 **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** is a narrative walkthrough of *why*
it's built this way (the two-clocks problem, "no wrong notes," the one bridge,
"read the audio / draw it"), written to be read while learning. The phase-by-phase
build log is in [`implementation.md`](./implementation.md).

## Deploying

Pushing to `main` builds and publishes to **GitHub Pages** via
[`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml). One-time repo
setup: **Settings → Pages → Build and deployment → Source: "GitHub Actions."** The
Vite `base` is set to `/villani-nation-daw/` for production builds only, so local
`npm run dev` still serves at the root.

### Project layout

```
src/
  model/       # Project data types + factory defaults
  lib/         # scale math (the "no wrong notes" core), ✨ generators, time + constants
  audio/       # Tone.js engine, instrument voices, drums, scheduler, clock, offline render
  store/       # Zustand project store
  hooks/       # store → engine bridge, playhead subscription
  components/  # transport bar, drum grid, piano roll, instrument panel, song view,
               #   mixer, coach overlay, visualizer
```

---

*Made for the boys. 🎵*
