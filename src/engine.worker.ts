/// <reference lib="webworker" />
import { BreedingEngine } from './engine/BreedingEngine';
import type { BreedingInput } from './engine/types';

const engine = new BreedingEngine();

self.onmessage = (e: MessageEvent<{ id: number; input: BreedingInput }>) => {
  const { id, input } = e.data;
  try {
    const plan = engine.plan(input);
    (self as unknown as Worker).postMessage({ id, plan });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
