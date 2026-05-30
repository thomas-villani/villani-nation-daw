import * as Tone from 'tone';
import type { EffectConfig, EffectType } from '../model/types';

// Build an ordered effect chain from EffectConfig[] (spec §4.2). Each enabled
// effect becomes a Tone node; we return the chain's head/tail so InstrumentVoice
// can splice it between the source and the panner. Disabled effects are skipped
// entirely (phase 2 keeps it simple; phase 6 can switch to wet-ramped bypass).

export interface BuiltEffect {
  type: EffectType;
  node: Tone.ToneAudioNode;
  dispose(): void;
}

export interface EffectChain {
  nodes: BuiltEffect[];
  input: Tone.ToneAudioNode | null; // first node, or null if chain is empty
  output: Tone.ToneAudioNode | null; // last node, or null if chain is empty
  // Resolves once every node's async setup is done (only Tone.Reverb has any: it
  // renders its impulse response off-thread). The offline exporter awaits this so a
  // reverb tail isn't missing from the render; live playback ignores it.
  ready: Promise<unknown>;
  dispose(): void;
}

function buildOne(cfg: EffectConfig): BuiltEffect | null {
  switch (cfg.type) {
    case 'distortion': {
      const node = new Tone.Distortion({ distortion: cfg.params.amount ?? 0.3, wet: 1 });
      return { type: 'distortion', node, dispose: () => node.dispose() };
    }
    case 'reverb': {
      const node = new Tone.Reverb({ decay: 2.5, wet: cfg.params.wet ?? 0.3 });
      return { type: 'reverb', node, dispose: () => node.dispose() };
    }
    case 'delay': {
      const node = new Tone.FeedbackDelay({
        delayTime: cfg.params.time ?? 0.25,
        feedback: cfg.params.feedback ?? 0.3,
        wet: cfg.params.wet ?? 0.3,
      });
      return { type: 'delay', node, dispose: () => node.dispose() };
    }
    case 'filter': {
      const node = new Tone.Filter({
        type: 'lowpass',
        frequency: cfg.params.cutoff ?? 2000,
        Q: cfg.params.resonance ?? 1,
      });
      return { type: 'filter', node, dispose: () => node.dispose() };
    }
    default:
      return null;
  }
}

export function buildEffectChain(configs: EffectConfig[]): EffectChain {
  const nodes: BuiltEffect[] = [];
  for (const cfg of configs) {
    if (!cfg.enabled) continue;
    const built = buildOne(cfg);
    if (built) nodes.push(built);
  }
  // Wire them in series.
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i].node.connect(nodes[i + 1].node);
  }
  // Reverb nodes carry a `ready` promise (impulse-response generation).
  const readies = nodes
    .map((n) => (n.node as { ready?: Promise<unknown> }).ready)
    .filter((r): r is Promise<unknown> => Boolean(r));
  return {
    nodes,
    input: nodes.length ? nodes[0].node : null,
    output: nodes.length ? nodes[nodes.length - 1].node : null,
    ready: Promise.all(readies),
    dispose: () => nodes.forEach((n) => n.dispose()),
  };
}
