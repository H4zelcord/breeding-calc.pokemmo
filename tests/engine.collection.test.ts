import { describe, expect, it } from 'vitest';
import { newOwned, type OwnedPokemon } from '../src/engine';
import type { IVs } from '../src/data/models';
import { ALL6, desired, dex, moveId, plan, rootOf, speciesId, verifySolution } from './helpers';

const iv = (p: Partial<IVs>): IVs => ({ hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0, ...p });

describe('Mis Pokémon: disponibles / obligatorios / prohibidos (requisitos 13, 27)', () => {
  const fourIv: OwnedPokemon = newOwned({
    id: 'g4',
    speciesId: speciesId('Gible'),
    gender: 'male',
    ivs: iv({ hp: 31, attack: 31, defense: 31, speed: 31 }),
  });

  it('usa un Pokémon disponible cuando ahorra cruces', () => {
    const p = plan(desired('Gible', ['hp', 'attack', 'defense', 'speed', 'specialDefense']), [fourIv]);
    const sol = p.best!;
    verifySolution(sol, [fourIv]);
    expect(sol.optionalPokemon).toContain('g4');
    expect(sol.stats.crosses).toBeLessThan(15);
  });

  it('modo "desde cero" ignora la colección', () => {
    const p = plan(desired('Gible', ['hp', 'attack', 'defense', 'speed', 'specialDefense']), [fourIv], { mode: 'scratch' });
    expect(p.best!.stats.ownedUsed).toBe(0);
    expect(p.best!.stats.crosses).toBe(15);
  });

  it('nunca usa un Pokémon PROHIBIDO', () => {
    const forbidden = { ...fourIv, status: 'forbidden' as const };
    const p = plan(desired('Gible', ['hp', 'attack', 'defense', 'speed', 'specialDefense']), [forbidden]);
    verifySolution(p.best!, [forbidden]);
    expect(p.best!.stats.ownedUsed).toBe(0);
  });

  it('respeta la cantidad (cada Pokémon se consume, R01)', () => {
    const one = newOwned({ id: 'one', speciesId: speciesId('Gible'), gender: 'female', ivs: iv({ hp: 31 }), quantity: 1 });
    const p = plan(desired('Gible', ['hp', 'attack', 'defense']), [one]);
    verifySolution(p.best!, [one]);
    const uses = Object.values(p.best!.nodes).filter((n) => n.ownedId === 'one').length;
    expect(uses).toBeLessThanOrEqual(1);
    const two = { ...one, id: 'two', quantity: 3 };
    const p2 = plan(desired('Gible', ['hp', 'attack', 'defense']), [two]);
    verifySolution(p2.best!, [two]);
    expect(Object.values(p2.best!.nodes).filter((n) => n.ownedId === 'two').length).toBeGreaterThan(1);
  });

  it('un OBLIGATORIO se usa aunque no sea lo más barato (estilo "Conservar mi colección")', () => {
    const dratini = newOwned({ id: 'dra', speciesId: speciesId('Dratini'), gender: 'male', ivs: iv({ hp: 31 }), status: 'mandatory' });
    const p = plan(desired('Gible', ['hp', 'attack']), [dratini]);
    verifySolution(p.best!, [dratini]);
    expect(p.best!.requiredPokemon).toContain('dra');
    expect(p.errors).toHaveLength(0);
  });

  it('OBLIGATORIO imposible: error con el motivo exacto y plan sin él', () => {
    const pika = newOwned({ id: 'pk', speciesId: speciesId('Pikachu'), gender: 'male', ivs: iv({ hp: 31 }), status: 'mandatory' });
    const p = plan(desired('Gible', ['hp', 'attack']), [pika]);
    const e = p.errors.find((x) => x.ownedId === 'pk')!;
    expect(e.code).toBe('MANDATORY_IMPOSSIBLE');
    expect(e.detail).toMatch(/grupo huevo/);
    expect(p.best).not.toBeNull();
    expect(p.best!.requiredPokemon).not.toContain('pk');
  });

  it('OBLIGATORIO que no aporta nada: motivo', () => {
    const useless = newOwned({ id: 'u', speciesId: speciesId('Gible'), gender: 'male', ivs: iv({}), status: 'mandatory' });
    const p = plan(desired('Gible', ['hp', 'attack']), [useless]);
    expect(p.errors.find((x) => x.ownedId === 'u')!.detail).toMatch(/No aporta/);
  });

  it('Ditto de la colección con varios IVs permite Tauros 3x31', () => {
    const ditto = newOwned({ id: 'dit', speciesId: 132, gender: 'genderless', ivs: iv({ hp: 31, attack: 31 }) });
    const p = plan(desired('Tauros', ['hp', 'attack', 'speed']), [ditto]);
    expect(p.ok).toBe(true);
    verifySolution(p.best!, [ditto]);
    expect(p.best!.optionalPokemon).toContain('dit');
  });

  it('un shiny objetivo se cría sólo con shinies de la colección', () => {
    const f = newOwned({ id: 'sf', speciesId: speciesId('Gible'), gender: 'female', ivs: iv({ hp: 31 }), shiny: true });
    const m = newOwned({ id: 'sm', speciesId: speciesId('Gible'), gender: 'male', ivs: iv({ attack: 31 }), shiny: true });
    const p = plan(desired('Gible', ['hp', 'attack'], { shiny: true }), [f, m]);
    expect(p.ok).toBe(true);
    verifySolution(p.best!, [f, m]);
    expect(p.best!.stats.ownedUsed).toBe(2);
  });
});

describe('Obligatorio vs deseable (requisito 7)', () => {
  it('si lo deseable es imposible se descarta y se avisa', () => {
    const d = desired('Tauros', ['hp', 'attack']);
    d.ivs.speed = { min: 31, max: 31, priority: 'desired' };
    const p = plan(d);
    expect(p.ok).toBe(true);
    expect(p.warnings.map((w) => w.code)).toContain('DESIRED_DROPPED');
    expect(p.best!.droppedFeatures).toContain('IV SPE');
  });

  it('ofrece una alternativa sólo con lo obligatorio', () => {
    const d = desired('Gible', ['hp', 'attack']);
    d.nature = 'Jolly';
    d.naturePriority = 'desired';
    const p = plan(d);
    expect(p.alternatives.some((a) => a.label === 'Sólo características obligatorias')).toBe(true);
  });
});

describe('Múltiples soluciones (requisito 21)', () => {
  it('devuelve alternativas con estadísticas comparables', () => {
    const owned = [
      newOwned({ id: 'a', speciesId: speciesId('Gible'), gender: 'female', ivs: iv({ hp: 31, attack: 31 }) }),
      newOwned({ id: 'b', speciesId: speciesId('Charmander'), gender: 'male', ivs: iv({ attack: 31, speed: 31 }) }),
    ];
    const p = plan(desired('Gible', ['hp', 'attack', 'speed', 'defense']), owned, { maxAlternatives: 2 });
    expect(p.best).not.toBeNull();
    expect(p.alternatives.length).toBeGreaterThan(0);
    for (const s of [p.best!, ...p.alternatives]) {
      verifySolution(s, owned);
      expect(s.stats.crosses).toBeGreaterThan(0);
    }
  });
});

describe('Caso completo del criterio de éxito (requisito 39)', () => {
  it('Garchomp 6x31 Jolly Rough Skin con movimiento huevo y colección con obligatorios', () => {
    const thrash = moveId('Thrash');
    const d = desired('Garchomp', ALL6, {
      nature: 'Jolly',
      ability: 'Rough Skin',
      hiddenAbility: true,
      eggMoves: [{ moveId: thrash, priority: 'required' }],
    });
    const owned: OwnedPokemon[] = [
      newOwned({ id: 'A', speciesId: speciesId('Gible'), gender: 'male', ivs: iv({ hp: 31 }) }),
      newOwned({ id: 'B', speciesId: speciesId('Gible'), gender: 'female', ivs: iv({ attack: 31 }), status: 'mandatory' }),
      newOwned({ id: 'C', speciesId: speciesId('Gible'), gender: 'male', moves: [thrash], ivs: iv({}) }),
      newOwned({ id: 'D', speciesId: speciesId('Gible'), gender: 'female', nature: 'Jolly', ivs: iv({}), status: 'mandatory' }),
      newOwned({ id: 'X', speciesId: speciesId('Gible'), gender: 'male', ivs: iv({ speed: 31 }), status: 'forbidden' }),
    ];
    const p = plan(d, owned);
    expect(p.ok).toBe(true);
    expect(p.errors).toHaveLength(0);
    const sol = p.best!;
    verifySolution(sol, owned);
    const root = rootOf(sol);
    for (const s of ALL6) expect(root.ivs[s].min).toBe(31);
    expect(root.nature).toBe('Jolly');
    expect(root.hiddenAbility).toBe('chance');
    expect(root.eggMoves).toContain(thrash);
    expect(sol.requiredPokemon.sort()).toEqual(['B', 'D']);
    expect(Object.values(sol.nodes).some((n) => n.ownedId === 'X')).toBe(false);
    // La explicación sale del árbol: un paso por cruce
    expect(sol.steps.filter((s) => s.kind === 'cross')).toHaveLength(sol.stats.crosses);
    // Cada nodo explica por qué está
    for (const n of Object.values(sol.nodes)) if (n.role !== 'root') expect(n.reasons.length).toBeGreaterThan(0);
    expect(dex.speciesName(root.speciesId)).toBe('Gible');
  });
});
