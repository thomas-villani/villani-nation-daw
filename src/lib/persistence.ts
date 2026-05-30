import type { Project } from '../model/types';

// Phase 3 — persistence. The whole app is a view onto one serializable `Project`
// (spec §3), so save = JSON.stringify and load = parse + validate. This module is
// the only place that knows about localStorage and file blobs; it imports no Tone
// and no store, just the data types.

export const STORAGE_KEY = 'villani-nation-studio:project';
const CURRENT_VERSION = 1;

const SCALES = new Set(['majPent', 'minPent', 'major', 'minor']);

/** Stable JSON for a project. Pretty-printed so exported files are human-readable. */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Parse + structurally validate a project. Throws a friendly Error on anything
 * that isn't a project we can load, so callers can surface it to the user. We
 * stay tolerant of missing optional fields (sections/arrangement) by filling
 * defaults, but reject anything missing the load-bearing pieces.
 */
export function deserializeProject(json: string): Project {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("That file isn't valid JSON — it may be corrupted.");
  }
  return validateProject(raw);
}

export function validateProject(raw: unknown): Project {
  if (!raw || typeof raw !== 'object') {
    throw new Error("That doesn't look like a VillaniNation song.");
  }
  const p = raw as Record<string, unknown>;

  if (p.version !== CURRENT_VERSION) {
    throw new Error(
      `This song was made with a different version (v${String(p.version)}); can't open it.`,
    );
  }
  if (!Array.isArray(p.instruments) || !Array.isArray(p.clips)) {
    throw new Error('This song file is missing its instruments or clips.');
  }
  const key = p.key as Record<string, unknown> | undefined;
  if (!key || typeof key.root !== 'number' || !SCALES.has(key.scale as string)) {
    throw new Error('This song file has an invalid key/scale.');
  }

  // Coerce into a well-formed Project, filling phase-5 fields if absent.
  const project: Project = {
    version: CURRENT_VERSION,
    name: typeof p.name === 'string' && p.name.trim() ? p.name : 'Untitled Jam',
    bpm: clampNum(p.bpm, 40, 220, 100),
    swing: clampNum(p.swing, 0, 1, 0),
    key: {
      root: ((Math.round(key.root as number) % 12) + 12) % 12,
      scale: key.scale as Project['key']['scale'],
    },
    instruments: p.instruments as Project['instruments'],
    clips: p.clips as Project['clips'],
    sections: Array.isArray(p.sections) ? (p.sections as Project['sections']) : [],
    arrangement: Array.isArray(p.arrangement) ? (p.arrangement as string[]) : [],
  };
  return project;
}

function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  return Math.min(max, Math.max(min, n));
}

// --- localStorage (autosave) ---

export function saveToLocal(project: Project): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeProject(project));
  } catch {
    // Storage full / disabled (private mode). Autosave is best-effort; ignore.
  }
}

/** The saved project, or null if none / unreadable (we never crash startup on it). */
export function loadFromLocal(): Project | null {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    return deserializeProject(json);
  } catch {
    return null;
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// --- file import / export ---

const safeFileName = (name: string) =>
  (name.trim() || 'jam').replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').toLowerCase();

/** Trigger a browser download of the project as a .json file. */
export function downloadProject(project: Project): void {
  const blob = new Blob([serializeProject(project)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(project.name)}.vnjam.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke after the click has been processed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Read + validate a project from a user-picked File. Rejects with a friendly message. */
export function readProjectFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.onload = () => {
      try {
        resolve(deserializeProject(String(reader.result)));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Could not open that song.'));
      }
    };
    reader.readAsText(file);
  });
}
