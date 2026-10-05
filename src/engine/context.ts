import type { Dex } from '../data/dex';
import type { BreedingRules } from './rules/config';
import type { CostWeights, OwnedPokemon, PlannerOptions } from './types';

/** Todo lo que necesita la búsqueda; independiente de cualquier framework de UI. */
export interface EngineContext {
  dex: Dex;
  rules: BreedingRules;
  weights: CostWeights;
  options: PlannerOptions;
  /** Pokémon de la colección utilizables (sin prohibidos). */
  owned: OwnedPokemon[];
  ownedById: Map<string, OwnedPokemon>;
  /** Familia de relleno para machos cuando la familia objetivo no tiene machos. */
  fillerFamilyFor: (familyId: number) => number | null;
  /** Familias de machos compatibles con `familyId` capaces de llevar `moves` (heredados o enseñados). */
  moveCarrierFamilies: (familyId: number, moves: number[]) => number[];
}

export function createContext(
  dex: Dex,
  rules: BreedingRules,
  weights: CostWeights,
  options: PlannerOptions,
  owned: OwnedPokemon[],
): EngineContext {
  const usable = owned.filter((m) => m.status !== 'forbidden' && m.quantity > 0);
  const fillerCache = new Map<number, number | null>();
  const carrierCache = new Map<string, number[]>();
  return {
    dex,
    rules,
    weights,
    options,
    owned: usable,
    ownedById: new Map(usable.map((m) => [m.id, m])),
    fillerFamilyFor(familyId: number) {
      if (fillerCache.has(familyId)) return fillerCache.get(familyId)!;
      let pick: number | null = null;
      const pref = options.fillerFamilyId;
      if (pref !== null && pref !== familyId && dex.families.has(pref) && dex.canBeMale(pref) && !dex.isGenderlessFamily(pref) && dex.shareEggGroup(pref, familyId)) {
        pick = pref;
      } else {
        // Primera familia obtenible con ratio 50/50 que comparte grupo huevo (elección determinista).
        const candidates = dex
          .breedingFamilies()
          .filter((f) => f.id !== familyId && f.genderKind === 'mixed' && dex.shareEggGroup(f.id, familyId))
          .filter((f) => dex.getSpecies(f.firstBreedable ?? f.id).obtainable);
        // Preferencia: ratio 50/50 (género más barato) y que el huevo pueda criar sin evolucionar.
        const babyPenalty = (f: (typeof candidates)[number]) => (dex.speciesCanBreed(f.defaultEggSpecies) ? 0 : 1000);
        candidates.sort((a, b) => babyPenalty(a) - babyPenalty(b) || Math.abs(a.genderRatio - 127) - Math.abs(b.genderRatio - 127) || a.id - b.id);
        pick = candidates[0]?.id ?? null;
      }
      fillerCache.set(familyId, pick);
      return pick;
    },
    moveCarrierFamilies(familyId: number, moves: number[]) {
      const key = `${familyId}|${moves.join('.')}`;
      if (carrierCache.has(key)) return carrierCache.get(key)!;
      const out = dex
        .breedingFamilies()
        .filter((f) => f.id !== familyId && dex.canBeMale(f.id) && dex.canBeFemale(f.id) && !dex.isGenderlessFamily(f.id))
        .filter((f) => dex.shareEggGroup(f.id, familyId))
        .filter((f) => {
          const egg = dex.eggMovesOf(f.defaultEggSpecies);
          const nat = dex.naturalMoves(f.id);
          return moves.every((m) => egg.includes(m) || nat.has(m));
        })
        .sort((a, b) => {
          const baby = (x: typeof a) => (dex.speciesCanBreed(x.defaultEggSpecies) ? 0 : 1);
          return baby(a) - baby(b) || Math.abs(a.genderRatio - 127) - Math.abs(b.genderRatio - 127) || a.id - b.id;
        })
        .slice(0, 2)
        .map((f) => f.id);
      carrierCache.set(key, out);
      return out;
    },
  };
}
