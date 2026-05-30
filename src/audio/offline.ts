import * as Tone from 'tone';
import type { Clip, Project, Section } from '../model/types';
import { InstrumentVoice } from './InstrumentVoice';
import { buildJam, buildSong } from './scheduler';

// Phase 6 — offline render (spec §4.4). `Tone.Offline` swaps the global context for
// an OfflineContext, so everything we build inside the callback — voices, parts,
// automation, the master gain — attaches to it and renders faster-than-realtime to
// an AudioBuffer, fully client-side. We REBUILD a fresh graph from the Project here
// rather than reuse the live `engine` voices (those belong to the realtime context),
// reusing the very same InstrumentVoice + scheduler the live engine uses so the
// render matches what the kid hears: mixer levels, mutes/solos, effects, automation.

export type ExportFormat = 'wav' | 'mp3';

export interface RenderOptions {
  /** 'song' renders the whole arrangement once; 'jam' loops the active clips. */
  mode: 'song' | 'jam';
  /** Active clip per instrument — used in jam mode (ignored in song mode). */
  activeClips: Clip[];
  /** Master gain (0..1), the transport bar's master volume. */
  masterVolume: number;
  /** How many times to repeat the jam loop in jam-mode export. */
  jamRepeats?: number;
}

const SECONDS_PER_BAR = (bpm: number) => (4 * 60) / bpm; // 4/4
const RENDER_TAIL_SEC = 2; // let the last notes / reverb ring out at the song end

/** Sum the arrangement's section lengths (bars), resolving ids like the scheduler. */
function songLengthBars(project: Project): number {
  const total = project.arrangement
    .map((id) => project.sections.find((s) => s.id === id))
    .filter((s): s is Section => Boolean(s))
    .reduce((n, s) => n + Math.max(1, s.lengthBars), 0);
  return Math.max(1, total);
}

/** Whether a real song render is possible (an arrangement with sections exists). */
export function canRenderSong(project: Project): boolean {
  return project.arrangement.length > 0 && project.sections.length > 0;
}

/**
 * Render the project to a stereo AudioBuffer offline. Song mode walks the
 * arrangement once (plus a short tail); jam mode loops the active clips.
 */
export async function renderProject(project: Project, opts: RenderOptions): Promise<AudioBuffer> {
  const bpm = project.bpm;
  const useSong = opts.mode === 'song' && canRenderSong(project);

  let durationSec: number;
  if (useSong) {
    durationSec = songLengthBars(project) * SECONDS_PER_BAR(bpm) + RENDER_TAIL_SEC;
  } else {
    const maxBars = Math.max(1, ...opts.activeClips.map((c) => c.lengthBars), 1);
    const repeats = Math.max(1, opts.jamRepeats ?? 4);
    durationSec = maxBars * repeats * SECONDS_PER_BAR(bpm);
  }

  const rendered = await Tone.Offline(
    async (context) => {
      const transport = context.transport;
      transport.bpm.value = bpm;
      transport.swing = project.swing;
      transport.swingSubdivision = '16n';

      const master = new Tone.Gain(Math.max(0, opts.masterVolume)).toDestination();

      // Build a voice per instrument, folding in the solo logic the live engine uses.
      const anySolo = project.instruments.some((i) => i.solo);
      const voices = new Map<string, InstrumentVoice>();
      for (const inst of project.instruments) {
        const voice = new InstrumentVoice(inst, master);
        voice.applyConfig(inst, inst.mute || (anySolo && !inst.solo));
        voices.set(inst.id, voice);
      }
      // Wait for any reverb impulse responses before rendering so tails aren't lost.
      await Promise.all([...voices.values()].map((v) => v.whenReady()));

      if (useSong) {
        // One clean pass: kill the looping buildSong sets up so the tail stays dry.
        const schedule = buildSong(project, voices);
        schedule.parts.forEach((p) => (p.loop = false));
        transport.loop = false;
      } else {
        buildJam(project, voices, opts.activeClips); // keeps the loop -> repeats fill the duration
      }

      transport.start(0);
    },
    durationSec,
    2,
  );

  return rendered.get() as AudioBuffer;
}

// --- encoders ----------------------------------------------------------------

/** Interleave planar float channels into one Int16 PCM array (little-endian). */
function interleaveToInt16(buffer: AudioBuffer): Int16Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const out = new Int16Array(length * channels);
  const chData = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let o = 0;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chData[c][i]));
      out[o++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return out;
}

/** Encode an AudioBuffer to a 16-bit PCM WAV blob (no dependencies). */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const pcm = interleaveToInt16(buffer);
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = pcm.length * bytesPerSample;

  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // audio format = PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // little-endian Int16Array on LE hosts; browsers are LE, so the typed array's
  // bytes are already the byte order WAV wants.
  return new Blob([header, pcm.buffer as ArrayBuffer], { type: 'audio/wav' });
}

/** Encode an AudioBuffer to an MP3 blob via lamejs (dynamic import — best-effort). */
export async function audioBufferToMp3(buffer: AudioBuffer, kbps = 192): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  const toInt16 = (data: Float32Array): Int16Array => {
    const out = new Int16Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const s = Math.max(-1, Math.min(1, data[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  };

  const left = toInt16(buffer.getChannelData(0));
  const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : undefined;

  const blockSize = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < left.length; i += blockSize) {
    const l = left.subarray(i, i + blockSize);
    const r = right ? right.subarray(i, i + blockSize) : undefined;
    const mp3 = channels > 1 ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (mp3.length) chunks.push(new Uint8Array(mp3));
  }
  const end = encoder.flush();
  if (end.length) chunks.push(new Uint8Array(end));

  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}

/** Trigger a browser download of a blob under the given filename. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
