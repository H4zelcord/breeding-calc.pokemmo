import { getDex } from '../src/data/dex';
import { STATS, type StatKey } from '../src/data/models';
import { ITEM_BY_ID } from '../src/data/items';
import {
  BreedingEngine,
  canBreedPair,
  defaultOptions,
  defaultRules,
  emptyDesired,
  type BreedingPlan,
  type BreedingSolution,
  type DesiredPokemon,
  type OwnedPokemon,
  type PlannerOptions,
} from '../src/engine';
import { childIvs } from '../src/engine/rules/inheritance';

export const dex = getDex();
export const engine = new BreedingEngine(dex);

export function moveId(name: string): number {
  const m = [...dex.moves.values()].find((x) => x.name === name);
  if (!m) throw new Error(`move ${name}`);
  return m.id;
}

export function speciesId(name: string): number {
  const s = dex.allSpecies().find((x) => x.name === name);
  if (!s) throw new Error(`species ${name}`);
  return s.id;
}

export function desired(name: string, stats: StatKey[] = [], extra: Partial<DesiredPokemon> = {}): DesiredPokemon {
  const d = emptyDesired(speciesId(name));
  for (const s of stats) d.ivs[s] = { min: 31, max: 31, priority: 'required' };
  return { ...d, ...extra };
}

export function plan(d: DesiredPokemon, owned: OwnedPokemon[] = [], opts: Partial<PlannerOptions> = {}, rules = defaultRules()): BreedingPlan {
  return engine.plan({ desired: d, owned, rules, options: { ...defaultOptions(), maxAlternatives: 1, ...opts } });
}

export const ALL6: StatKey[] = [...STATS];

/**
 * Comprobación independiente de un árbol: vuelve a aplicar las reglas a cada cruce.
 * Si algo no cuadra lanza una excepción con el motivo.
 */
export function verifySolution(sol: BreedingSolution, owned: OwnedPokemon[] = [], opts: { motherMoves?: boolean } = {}): void {
  const nodes = sol.nodes;
  const usage = new Map<string, number>();
  for (const n of Object.values(nodes)) {
    // R68: un objeto por Pokémon (por construcción heldItem es único) y válido
    if (n.heldItem && !ITEM_BY_ID.has(n.heldItem.itemId)) throw new Error(`Objeto desconocido ${n.heldItem.itemId}`);
    if (n.source === 'owned') {
      usage.set(n.ownedId!, (usage.get(n.ownedId!) ?? 0) + 1);
      const m = owned.find((o) => o.id === n.ownedId);
      if (!m) throw new Error('Pokémon de colección inexistente');
      if (m.status === 'forbidden') throw new Error('Se ha usado un Pokémon PROHIBIDO');
    }
    if (!n.parentA || !n.parentB) continue;
    const A = nodes[n.parentA];
    const B = nodes[n.parentB];
    // R03-R05: compatibilidad real de la pareja
    const g = (x: typeof A) => (x.gender === 'any' ? (dex.isDittoFamily(x.familyId) || dex.isGenderlessFamily(x.familyId) ? 'genderless' : null) : x.gender);
    const ga = g(A);
    const gb = g(B);
    const dittoPair = dex.isDittoFamily(A.familyId) || dex.isDittoFamily(B.familyId);
    if (!dittoPair && (ga === null || gb === null)) throw new Error(`Género sin fijar en un cruce sin Ditto (${n.id})`);
    const check = canBreedPair(
      dex,
      { speciesId: A.speciesId, gender: (ga ?? (gb === 'male' ? 'female' : 'male')) as never, shiny: A.shiny },
      { speciesId: B.speciesId, gender: (gb ?? (ga === 'male' ? 'female' : 'male')) as never, shiny: B.shiny },
    );
    if (!check.ok) throw new Error(`Cruce inválido ${n.id}: ${check.reason}`);
    // R07: especie del hijo
    if (dex.familyIdOf(n.hatchSpeciesId ?? n.speciesId) !== check.childFamily) throw new Error(`Especie del hijo incorrecta en ${n.id}`);
    // R21/R20: IVs garantizados recalculados
    const braceOf = (x: typeof A): StatKey | null => {
      const it = x.heldItem && ITEM_BY_ID.get(x.heldItem.itemId);
      return it && it.data.kind === 'iv' ? it.data.stat : null;
    };
    const ivs = childIvs(A.ivs, B.ivs, braceOf(A), braceOf(B));
    for (const s of STATS) {
      if (ivs[s].min !== n.ivs[s].min || ivs[s].max !== n.ivs[s].max) throw new Error(`IV ${s} incoherente en ${n.id}`);
      const req = n.requiredIvs[s];
      if (req && (n.ivs[s].min < req.min || n.ivs[s].max > req.max)) throw new Error(`IV ${s} no garantizado en ${n.id}`);
    }
    // R30: naturaleza sólo con Everstone
    const holder = [A, B].find((x) => x.heldItem?.itemId === 'everstone');
    if (n.nature && (!holder || holder.nature !== n.nature)) throw new Error(`Naturaleza sin Everstone en ${n.id}`);
    // R42: HA desde un progenitor de la misma familia
    if (n.hiddenAbility === 'chance') {
      const src = nodes[n.hiddenAbilitySource!];
      if (src.familyId !== n.familyId || src.hiddenAbility === 'no') throw new Error(`HA de origen inválido en ${n.id}`);
      if (src.gender === 'male' && !(dex.isDittoFamily(A.familyId) || dex.isDittoFamily(B.familyId)) && A.familyId !== B.familyId) {
        throw new Error(`HA de un macho con hembra de otra línea en ${n.id}`);
      }
    }
    // R50/R51: movimientos huevo desde el padre y en la lista de la especie del huevo
    for (const mv of n.eggMoves) {
      const src = n.eggMoveSources[mv];
      if (!src) throw new Error(`Movimiento sin origen en ${n.id}`);
      if (src === 'teach') continue;
      const p = nodes[src];
      if (mv === 344) {
        if (p.heldItem?.itemId !== 'light-ball' || p.speciesId !== 25) throw new Error('Volt Tackle sin Pikachu con Light Ball');
        continue;
      }
      if (p.gender !== 'male' && !opts.motherMoves) throw new Error(`Movimiento huevo transmitido por un progenitor no macho en ${n.id}`);
      if (!dex.eggMovesOf(n.hatchSpeciesId ?? n.speciesId).includes(mv)) throw new Error(`Movimiento no heredable en ${n.id}`);
      if (!p.eggMoves.includes(mv)) throw new Error(`El padre no conoce el movimiento en ${n.id}`);
    }
  }
  for (const [id, count] of usage) {
    const m = owned.find((o) => o.id === id)!;
    if (count > m.quantity) throw new Error(`Se ha usado ${id} ${count} veces (cantidad ${m.quantity})`);
  }
}

export function rootOf(sol: BreedingSolution) {
  return sol.nodes[sol.rootId];
}
