import { describe, expect, it } from 'vitest';
import { defaultRules } from '../src/engine';
import { ALL6, desired, dex, moveId, plan, rootOf, speciesId, verifySolution } from './helpers';

describe('Naturaleza (R30-R33)', () => {
  it('Everstone transmite la naturaleza y el árbol con naturaleza duplica los cruces', () => {
    const p = plan(desired('Gible', ALL6.slice(0, 5), { nature: 'Jolly' }));
    const sol = p.best!;
    verifySolution(sol);
    const root = rootOf(sol);
    expect(root.nature).toBe('Jolly');
    expect(sol.nodes[root.natureSource!].heldItem?.itemId).toBe('everstone');
    expect(sol.stats.crosses).toBe(31);
    expect(sol.items.find((i) => i.itemId === 'everstone')!.count).toBe(5);
  });

  it('sin Everstone la naturaleza es aleatoria', () => {
    const p = plan(desired('Gible', ['hp', 'attack']));
    expect(rootOf(p.best!).nature).toBeNull();
  });
});

describe('Habilidades (R40-R45)', () => {
  it('habilidad normal: paso final con Ability Pill', () => {
    const p = plan(desired('Garchomp', ['hp'], { ability: 'Sand Veil' }));
    const post = p.best!.steps.find((s) => s.kind === 'post')!;
    expect(post.lines.join(' ')).toMatch(/Ability Pill/);
  });

  it('habilidad que no tiene la especie → error', () => {
    const p = plan(desired('Garchomp', ['hp'], { ability: 'Levitate' }));
    expect(p.ok).toBe(false);
    expect(p.errors[0].code).toBe('ABILITY');
  });

  it('HA: la aporta un progenitor de la misma línea y se avisa de la probabilidad desconocida', () => {
    const p = plan(desired('Garchomp', ['hp', 'attack'], { hiddenAbility: true }));
    const sol = p.best!;
    verifySolution(sol);
    const root = rootOf(sol);
    expect(root.hiddenAbility).toBe('chance');
    const src = sol.nodes[root.hiddenAbilitySource!];
    expect(src.familyId).toBe(dex.familyIdOf(speciesId('Gible')));
    expect(sol.warnings.map((w) => w.code)).toContain('R44');
  });

  it('HA en una especie sin HA → error', () => {
    const p = plan(desired('Chimecho', ['hp'], { hiddenAbility: true }));
    expect(p.errors.map((e) => e.code)).toContain('NO_HA');
  });
});

describe('Movimientos huevo (R50-R56)', () => {
  it('un movimiento huevo llega por el padre y se rastrea su origen', () => {
    const outrage = dex.desiredEggMoveOptions(speciesId('Gible'))[0];
    const p = plan(desired('Garchomp', ['hp', 'attack'], { eggMoves: [{ moveId: outrage, priority: 'required' }] }));
    const sol = p.best!;
    verifySolution(sol);
    const root = rootOf(sol);
    expect(root.eggMoves).toContain(outrage);
    expect(sol.nodes[root.eggMoveSources[outrage]].gender).toBe('male');
  });

  it('cadena entre especies: Belly Drum para Azurill vía un padre de Agua 1', () => {
    const p = plan(desired('Azurill', ['hp'], { eggMoves: [{ moveId: moveId('Belly Drum'), priority: 'required' }] }));
    const sol = p.best!;
    verifySolution(sol);
    expect(rootOf(sol).eggMoves).toContain(moveId('Belly Drum'));
    expect(Object.values(sol.nodes).some((n) => n.source === 'chain')).toBe(true);
  });

  it('varios movimientos combinados en el mismo padre (Aqua Jet + ExtremeSpeed en Dragonite)', () => {
    const opts = dex.desiredEggMoveOptions(speciesId('Dratini'));
    const moves = [moveId('Aqua Jet'), moveId('ExtremeSpeed')].filter((m) => opts.includes(m));
    expect(moves.length).toBe(2);
    const p = plan(desired('Dragonite', ['hp', 'attack'], { eggMoves: moves.map((m) => ({ moveId: m, priority: 'required' as const })) }));
    expect(p.ok).toBe(true);
    verifySolution(p.best!);
    for (const m of moves) expect(rootOf(p.best!).eggMoves).toContain(m);
  });

  it('Belly Drum + Aqua Jet en Azumarill es imposible si sólo transmite el padre (R50/R52)', () => {
    const moves = [moveId('Belly Drum'), moveId('Aqua Jet')];
    const d = desired('Azumarill', ['hp', 'attack'], { eggMoves: moves.map((m) => ({ moveId: m, priority: 'required' as const })) });
    const p = plan(d);
    expect(p.ok).toBe(false);
    expect(p.errors[0].code).toBe('IMPOSSIBLE_MOVE_COMBO');
    // Con la opción experimental R52 (la madre también transmite) sí es posible.
    const rules = defaultRules();
    rules.mechanics.eggMovesFromMother = true;
    const p2 = plan(d, [], {}, rules);
    expect(p2.ok).toBe(true);
    verifySolution(p2.best!, [], { motherMoves: true });
    for (const m of moves) expect(rootOf(p2.best!).eggMoves).toContain(m);
  });

  it('movimiento que no es huevo → error con explicación', () => {
    const p = plan(desired('Gible', ['hp'], { eggMoves: [{ moveId: moveId('Earthquake'), priority: 'required' }] }));
    expect(p.ok).toBe(false);
    expect(p.errors[0].code).toBe('NOT_EGG_MOVE');
  });

  it('más de 4 movimientos → error', () => {
    const opts = dex.desiredEggMoveOptions(speciesId('Marill')).slice(0, 5);
    const p = plan(desired('Marill', ['hp'], { eggMoves: opts.map((m) => ({ moveId: m, priority: 'required' as const })) }));
    expect(p.errors.map((e) => e.code)).toContain('MOVES_MAX');
  });

  it('Volt Tackle: un Pikachu con Light Ball en el cruce final (R55)', () => {
    const p = plan(desired('Pichu', ['hp', 'attack'], { eggMoves: [{ moveId: 344, priority: 'required' }] }));
    const sol = p.best!;
    verifySolution(sol);
    const root = rootOf(sol);
    expect(root.eggMoves).toContain(344);
    const holder = sol.nodes[root.eggMoveSources[344]];
    expect(holder.speciesId).toBe(speciesId('Pikachu'));
    expect(holder.heldItem?.itemId).toBe('light-ball');
  });
});

describe('Ditto, género y especies especiales', () => {
  it('Tauros (sólo machos) usa Ditto en cada cruce', () => {
    const p = plan(desired('Tauros', ['hp', 'attack']));
    const sol = p.best!;
    verifySolution(sol);
    const root = rootOf(sol);
    expect([root.parentA, root.parentB].some((id) => dex.isDittoFamily(sol.nodes[id!].familyId))).toBe(true);
  });

  it('Tauros 3x31 desde cero es imposible (los Ditto no se crían) con explicación', () => {
    const p = plan(desired('Tauros', ['hp', 'attack', 'speed']));
    expect(p.ok).toBe(false);
    expect(p.errors[0].code).toBe('IMPOSSIBLE_MALE_ONLY');
  });

  it('sin Ditto permitido, Tauros 2x31 es imposible (1x31 se puede capturar)', () => {
    expect(plan(desired('Tauros', ['hp', 'attack']), [], { allowDitto: false }).ok).toBe(false);
    expect(plan(desired('Tauros', ['hp']), [], { allowDitto: false }).ok).toBe(true);
  });

  it('Magnemite (sin género) cría con su línea', () => {
    const p = plan(desired('Magnezone', ['hp', 'attack', 'speed']), [], { allowDitto: false });
    const sol = p.best!;
    verifySolution(sol);
    for (const n of Object.values(sol.nodes)) expect(n.familyId).toBe(dex.familyIdOf(speciesId('Magnemite')));
  });

  it('Chansey (sólo hembras) usa machos de otra especie del mismo grupo huevo', () => {
    const p = plan(desired('Blissey', ['hp', 'specialDefense']));
    const sol = p.best!;
    verifySolution(sol);
    const root = rootOf(sol);
    const father = sol.nodes[root.parentB!];
    expect(father.familyId).not.toBe(root.familyId);
  });

  it('género del objetivo: se paga la elección y aparece en el último cruce y en el resultado final', () => {
    const p = plan(desired('Garchomp', ['hp', 'attack'], { gender: 'female' }));
    const root = rootOf(p.best!);
    expect(root.gender).toBe('female');
    expect(p.best!.cost.breeding).toBeGreaterThan(0);
    const steps = p.best!.steps;
    const lastCross = steps.filter((s) => s.kind === 'cross').slice(-1)[0];
    expect(lastCross.lines.join('\n')).toMatch(/Género: elegir ♀ Hembra/);
    const final = steps[steps.length - 1];
    expect(final.kind).toBe('final');
    expect(final.lines[0]).toBe('Garchomp');
    expect(final.lines).toContain('Género: ♀ Hembra');
  });

  it('sin género pedido, el resultado final no fija género', () => {
    const p = plan(desired('Gible', ['hp', 'attack']));
    const final = p.best!.steps[p.best!.steps.length - 1];
    expect(final.lines.some((l) => l.startsWith('Género'))).toBe(false);
  });

  it('género imposible → error', () => {
    const p = plan(desired('Tauros', ['hp'], { gender: 'female' }));
    expect(p.errors[0].code).toBe('GENDER');
  });
});

describe('Pokémon bebé (R06-R10)', () => {
  it('Pichu: se cría con Pikachu y los nodos intermedios se evolucionan', () => {
    const p = plan(desired('Pichu', ['hp', 'attack', 'speed']));
    const sol = p.best!;
    verifySolution(sol);
    expect(rootOf(sol).speciesId).toBe(speciesId('Pichu'));
    expect(p.info.map((i) => i.code)).toContain('BABY');
    for (const n of Object.values(sol.nodes)) {
      if (n.role !== 'root') expect(dex.speciesCanBreed(n.speciesId)).toBe(true);
    }
    expect(Object.values(sol.nodes).some((n) => n.notes.some((x) => /evolucionar a Pikachu/.test(x)))).toBe(true);
  });

  it('Munchlax: Snorlax con Full Incense en el cruce final', () => {
    const p = plan(desired('Munchlax', ['hp', 'defense']));
    const sol = p.best!;
    verifySolution(sol);
    const root = rootOf(sol);
    expect(root.speciesId).toBe(speciesId('Munchlax'));
    const holder = [root.parentA, root.parentB].map((id) => sol.nodes[id!]).find((n) => n.heldItem?.itemId === 'full-incense')!;
    expect(holder.speciesId).toBe(speciesId('Snorlax'));
    expect(sol.warnings.map((w) => w.code)).not.toContain('R09b'); // 100 % (R09b, comprobado en el juego)
  });

  it('Happiny: el incienso lo lleva Chansey (no Blissey)', () => {
    const p = plan(desired('Happiny', ['hp']));
    const root = rootOf(p.best!);
    const holder = [root.parentA, root.parentB].map((id) => p.best!.nodes[id!]).find((n) => n.heldItem?.itemId === 'luck-incense')!;
    expect(holder.speciesId).toBe(speciesId('Chansey'));
  });
});

describe('Validación de imposibles (requisito 15)', () => {
  it('legendario', () => {
    const p = plan(desired('Mewtwo', ['hp']));
    expect(p.ok).toBe(false);
    expect(p.best).toBeNull();
    expect(p.errors[0].code).toBe('NOT_BREEDABLE');
  });
  it('Ditto como objetivo', () => {
    expect(plan(desired('Ditto', ['hp'])).errors[0].code).toBe('DITTO_TARGET');
  });
  it('rango de IVs inválido', () => {
    const d = desired('Gible');
    d.ivs.hp = { min: 30, max: 10, priority: 'required' };
    expect(plan(d).errors[0].code).toBe('IV_RANGE');
  });
  it('naturaleza inválida', () => {
    expect(plan(desired('Gible', ['hp'], { nature: 'Feliz' })).errors[0].code).toBe('NATURE');
  });
  it('un objetivo shiny sin shinies en la colección es imposible', () => {
    const p = plan(desired('Gible', ['hp'], { shiny: true }));
    expect(p.ok).toBe(false);
  });
});

describe('Costes (requisito 32)', () => {
  it('separa partidas y marca estimaciones y precios desconocidos', () => {
    const p = plan(desired('Gible', ALL6.slice(0, 3), { nature: 'Adamant' }));
    const c = p.best!.cost;
    expect(c.items).toBeGreaterThan(0);
    expect(c.breeding).toBeGreaterThan(0);
    expect(c.total).toBe(c.items + c.breeding + c.pokemon);
    expect(c.exact).toBe(false);
    expect(c.unknownPrices).toContain('Piedraeterna (Everstone)');
    expect(c.estimatedPrices.some((p) => p.startsWith('Brace'))).toBe(true);
  });
});
