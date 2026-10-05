import type { BreedingInput, BreedingPlan } from '../engine/types';

/** Ejecuta el motor en un Web Worker para no bloquear la interfaz. */
let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (p: BreedingPlan) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  worker = new Worker(new URL('../engine.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<{ id: number; plan?: BreedingPlan; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.plan) p.resolve(e.data.plan);
    else p.reject(new Error(e.data.error ?? 'Error desconocido'));
  };
  return worker;
}

export async function computePlan(input: BreedingInput): Promise<BreedingPlan> {
  const w = getWorker();
  if (!w) {
    const { BreedingEngine } = await import('../engine/BreedingEngine');
    return new BreedingEngine().plan(input);
  }
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, input });
  });
}
