import { STATS, type IVs } from '../data/models';
import { COST_PROFILES } from './cost';
import type { DesiredPokemon, OwnedPokemon, PlannerOptions } from './types';

export function defaultOptions(): PlannerOptions {
  return {
    mode: 'collection',
    weights: { ...COST_PROFILES[0].weights },
    maxExpansions: 30000,
    maxAlternatives: 2,
    allowDitto: true,
    fillerFamilyId: null,
  };
}

export function emptyDesired(speciesId: number): DesiredPokemon {
  return {
    speciesId,
    gender: 'any',
    genderPriority: 'required',
    ivs: {},
    nature: null,
    naturePriority: 'required',
    ability: null,
    hiddenAbility: false,
    hiddenAbilityPriority: 'required',
    eggMoves: [],
    shiny: false,
  };
}

export function zeroIvs(): IVs {
  return Object.fromEntries(STATS.map((s) => [s, 0])) as IVs;
}

export function newOwned(partial: Partial<OwnedPokemon> & { speciesId: number }): OwnedPokemon {
  return {
    id: partial.id ?? `own-${Math.random().toString(36).slice(2, 10)}`,
    gender: 'male',
    ivs: zeroIvs(),
    nature: 'Hardy',
    ability: null,
    hiddenAbility: false,
    moves: [],
    heldItem: null,
    quantity: 1,
    notes: '',
    status: 'available',
    shiny: false,
    alpha: false,
    value: null,
    ...partial,
  };
}
