import { describe, expect, it } from 'vitest';
import { STATS, type StatKey } from '../src/data/models';
import { ALL6, desired, plan, rootOf, verifySolution } from './helpers';

describe('Árbol de IVs (R20-R24)', () => {
  for (const stat of STATS) {
    it(`herencia de ${stat}: 2x31 con un brace en cada padre`, () => {
      const other: StatKey = stat === 'hp' ? 'speed' : 'hp';
      const p = plan(desired('Gible', [stat, other]));
      expect(p.ok).toBe(true);
      const sol = p.best!;
      verifySolution(sol);
      const root = rootOf(sol);
      expect(root.ivs[stat]).toEqual({ min: 31, max: 31 });
      // El IV procede de un padre con el brace correspondiente
      const src = root.ivSources[stat]!;
      expect(src.via).toBe('brace');
      const holder = sol.nodes[src.nodeIds[0]];
      expect(holder.contributes.ivs).toContain(stat);
      expect(sol.stats.crosses).toBe(1);
    });
  }

  it.each([
    [2, 1],
    [3, 3],
    [4, 7],
    [5, 15],
    [6, 31],
  ])('%ix31 desde cero necesita %i cruces (pirámide 2^(k-1)-1)', (k, crosses) => {
    const p = plan(desired('Gible', ALL6.slice(0, k)));
    expect(p.best!.stats.crosses).toBe(crosses);
    expect(p.best!.stats.pokemonUsed).toBe(crosses + 1);
    verifySolution(p.best!);
    const root = rootOf(p.best!);
    for (const s of ALL6.slice(0, k)) expect(root.ivs[s].min).toBe(31);
  });

  it('IVs parciales: 0 de Velocidad y 31 en el resto que se pide', () => {
    const d = desired('Gible', ['hp', 'attack']);
    d.ivs.speed = { min: 0, max: 0, priority: 'required' };
    const p = plan(d);
    expect(p.ok).toBe(true);
    verifySolution(p.best!);
    expect(rootOf(p.best!).ivs.speed).toEqual({ min: 0, max: 0 });
  });

  it('IVs mínimos (≥ 25) se rastrean como intervalos', () => {
    const d = desired('Gible');
    d.ivs.attack = { min: 25, max: 31, priority: 'required' };
    d.ivs.speed = { min: 31, max: 31, priority: 'required' };
    const p = plan(d);
    expect(p.ok).toBe(true);
    expect(rootOf(p.best!).ivs.attack.min).toBeGreaterThanOrEqual(25);
  });

  it('cada IV del resultado se puede rastrear hasta un Pokémon hoja', () => {
    const p = plan(desired('Gible', ALL6.slice(0, 4)));
    const sol = p.best!;
    const root = rootOf(sol);
    for (const s of ALL6.slice(0, 4)) {
      // Seguir el origen hasta una hoja
      let cur = root;
      let guard = 0;
      while (cur.parentA && guard++ < 10) {
        const src = cur.ivSources[s]!;
        cur = sol.nodes[src.nodeIds[0]];
      }
      expect(cur.parentA).toBeNull();
      expect(cur.ivs[s].min).toBe(31);
    }
  });

  it('cada progenitor lleva como mucho un objeto y los braces corresponden a stats pedidos', () => {
    const p = plan(desired('Gible', ALL6));
    for (const n of Object.values(p.best!.nodes)) {
      if (n.heldItem?.itemId.startsWith('power-')) expect(n.contributes.ivs.length).toBeGreaterThan(0);
    }
    const braces = p.best!.items.filter((i) => i.itemId.startsWith('power-')).reduce((a, i) => a + i.count, 0);
    expect(braces).toBe(62); // 31 cruces × 2 braces
  });
});
