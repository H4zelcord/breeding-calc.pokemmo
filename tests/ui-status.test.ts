import { describe, expect, it } from 'vitest';
import { ivStatus, traitPath } from '../src/ui/tree/status';
import { desired, moveId, plan, rootOf } from './helpers';

describe('Resaltado de orígenes y estados visuales (requisitos 10, 24)', () => {
  const d = desired('Azumarill', ['hp', 'attack'], { nature: 'Adamant', eggMoves: [{ moveId: moveId('Belly Drum'), priority: 'required' }] });
  const sol = plan(d).best!;

  it('el camino de un IV llega hasta una hoja que lo tiene', () => {
    const path = traitPath(sol, { kind: 'iv', stat: 'hp' });
    expect(path.has(sol.rootId)).toBe(true);
    const leaves = [...path].map((id) => sol.nodes[id]).filter((n) => !n.parentA);
    expect(leaves.length).toBeGreaterThan(0);
    for (const l of leaves) expect(l.ivs.hp.min).toBe(31);
  });

  it('el camino de la naturaleza pasa sólo por portadores de Everstone', () => {
    const path = [...traitPath(sol, { kind: 'nature' })].map((id) => sol.nodes[id]);
    for (const n of path) expect(n.nature).toBe('Adamant');
    expect(path.some((n) => n.heldItem?.itemId === 'everstone')).toBe(true);
  });

  it('el camino del movimiento huevo termina en quien lo aprende sin crianza', () => {
    const path = [...traitPath(sol, { kind: 'move', moveId: moveId('Belly Drum') })].map((id) => sol.nodes[id]);
    const origin = path.find((n) => n.eggMoveSources[moveId('Belly Drum')] === 'teach');
    expect(origin).toBeDefined();
  });

  it('estados: conseguido en hojas, brace / heredado en cruces, pendiente si falta', () => {
    const root = rootOf(sol);
    const st = ivStatus(root, 'hp', d);
    expect(['new', 'inh']).toContain(st);
    expect(ivStatus(root, 'speed', d)).toBe('none');
    const leaf = Object.values(sol.nodes).find((n) => !n.parentA && n.ivs.attack.min === 31)!;
    expect(ivStatus(leaf, 'attack', d)).toBe('ok');
    expect(ivStatus(leaf, 'hp', d)).toBe('pend');
  });
});
