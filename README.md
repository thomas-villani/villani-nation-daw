# 🎛️ VillaniNation Studio

A music studio for kids where **there are no wrong notes**. Everything melodic is
locked to a key and scale, so a kid mashing the grid still sounds intentional. Lay
down a beat, draw a bassline, and jam — fun in about 30 seconds — with a real path
to building full tracks later.

Built from [`fruityloops-for-kids-spec.md`](./fruityloops-for-kids-spec.md)
(design codename "Loopa").

## What works today (phases 1–3)

- **🥁 Drum grid** — tap a 16-step grid to build a beat with procedural
  kick / snare / hat / clap. Mute pads, or drag a `.wav` onto a row to swap in your
  own sound.
- **🎹 Scale-degree piano roll** — every row is in-key (the home/root row is
  marked ★), so you can't play a wrong note. Click to add, click a note to remove,
  drag to lengthen.
- **🎚️ Synth + effects** — mono / poly / FM engines, waveform, voices & detune,
  filter, envelope (friendly *or* full ADSR), glide, plus toggleable distortion,
  reverb, and delay.
- **🎶 Jam mode** — multiple tracks loop together, locked tight to the beat. Set
  tempo, swing, key, scale, and master volume from the top bar.
- **✨ No wrong notes** — change the key or scale and your whole song re-pitches
  *in-key* instantly (happy ↔ moody with one control).
- **💾 Never lose a jam** — every edit auto-saves to your browser and reopens next
  time. Name your jam, start a fresh one, or **Save File** / **Open** it as JSON to
  share or back up.

See [`implementation.md`](./implementation.md) for the full progress tracker and
what's coming (song arrangement, mixer + export, generators, visualizer).

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
key/scale re-pitches everything in-key for free. Architecture details live in
[`implementation.md`](./implementation.md).

### Project layout

```
src/
  model/       # Project data types + factory defaults
  lib/         # scale math (the "no wrong notes" core), time + constants
  audio/       # Tone.js engine, instrument voices, drums, scheduler, clock
  store/       # Zustand project store
  hooks/       # store → engine bridge, playhead subscription
  components/  # transport bar, drum grid, piano roll, instrument panel
```

---

*Made for the boys. 🎵*
