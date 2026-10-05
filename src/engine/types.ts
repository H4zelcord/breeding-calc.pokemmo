import type { Gender, IVs, StatKey } from '../data/models';
import type { BreedingRules } from './rules/config';

export type Priority = 'required' | 'desired';

export interface IVTarget {
  min: number;
  max: number;
  priority: Priority;
}

export interface DesiredMove {
  moveId: number;
  priority: Priority;
}

/** Pokémon que el usuario quiere conseguir. */
export interface DesiredPokemon {
  speciesId: number;
  gender: 'any' | 'male' | 'female';
  genderPriority: Priority;
  /** Stats ausentes = no importan. */
  ivs: Partial<Record<StatKey, IVTarget>>;
  nature: string | null;
  naturePriority: Priority;
  /** Habilidad normal (se ajusta con Ability Pill, R40). */
  ability: string | null;
  hiddenAbility: boolean;
  hiddenAbilityPriority: Priority;
  eggMoves: DesiredMove[];
  shiny: boolean;
}

export type CollectionStatus = 'available' | 'mandatory' | 'forbidden';

/** Pokémon que el usuario ya posee ("Mis Pokémon"). */
export interface OwnedPokemon {
  id: string;
  speciesId: number;
  gender: Gender;
  ivs: IVs;
  nature: string;
  ability: string | null;
  hiddenAbility: boolean;
  moves: number[];
  heldItem: string | null;
  quantity: number;
  notes: string;
  status: CollectionStatus;
  shiny: boolean;
  alpha: boolean;
  /** Valor/coste opcional (para el cálculo de costes). */
  value: number | null;
}

/** Pesos de la función de coste (ver cost.ts). */
export interface CostWeights {
  /** Por cada cruce. */
  cross: number;
  /** Por cada Pokémon consumido como hoja (capturado, comprado o de la colección). */
  pokemon: number;
  /** Esfuerzo extra por cada Pokémon que hay que conseguir (no está en la colección). */
  acquire: number;
  /** Por cada 1.000 de dinero. */
  money: number;
  /** Penalización por usar un Pokémon de la colección (para no gastarlos innecesariamente). */
  ownedUse: number;
  /** Por cada generación (altura del árbol). Se aplica al ordenar soluciones. */
  generations: number;
}

export interface PlannerOptions {
  mode: 'scratch' | 'collection';
  weights: CostWeights;
  /** Nodos máximos expandidos por la búsqueda A*. */
  maxExpansions: number;
  maxAlternatives: number;
  /** Permitir conseguir Dittos para los cruces. */
  allowDitto: boolean;
  /** Familia preferida para machos cuando la especie objetivo no tiene machos. */
  fillerFamilyId: number | null;
}

export interface BreedingInput {
  desired: DesiredPokemon;
  owned: OwnedPokemon[];
  rules: BreedingRules;
  options: PlannerOptions;
}

// ---------------------------------------------------------------- salida

export interface IVInterval {
  min: number;
  max: number;
}

export type NodeSource = 'owned' | 'acquired' | 'bred' | 'chain';
export type NodeRole = 'root' | 'mother' | 'father' | 'ditto' | 'partner';

export interface HeldItemRef {
  itemId: string;
  name: string;
  reason: string;
}

export interface Contributions {
  ivs: StatKey[];
  nature: boolean;
  ability: boolean;
  hiddenAbility: boolean;
  eggMoves: number[];
  species: boolean;
}

export interface IVSource {
  /** Nodo del que viene el IV garantizado. */
  nodeIds: string[];
  via: 'brace' | 'both' | 'owned' | 'acquired';
}

/** Nodo del árbol de crianza (requisito 11). */
export interface PlanNode {
  id: string;
  speciesId: number;
  /** Especie con la que eclosiona (si es criado). */
  hatchSpeciesId: number | null;
  familyId: number;
  gender: Gender | 'any';
  nature: string | null;
  ability: string | null;
  hiddenAbility: 'yes' | 'no' | 'chance';
  /** IVs garantizados (intervalos). */
  ivs: Record<StatKey, IVInterval>;
  /** Valores exactos si el Pokémon es de la colección. */
  exactIvs: IVs | null;
  /** Stats que este nodo debe cumplir (requisito). */
  requiredIvs: Partial<Record<StatKey, IVInterval>>;
  eggMoves: number[];
  heldItem: HeldItemRef | null;
  eggGroups: string[];
  parentA: string | null;
  parentB: string | null;
  childId: string | null;
  role: NodeRole;
  generation: number;
  step: number;
  source: NodeSource;
  ownedId: string | null;
  required: string[];
  optional: string[];
  contributes: Contributions;
  ivSources: Partial<Record<StatKey, IVSource>>;
  natureSource: string | null;
  hiddenAbilitySource: string | null;
  eggMoveSources: Record<number, string>;
  reasons: string[];
  notes: string[];
  shiny: boolean;
  mandatory: boolean;
  /** Especie exacta exigida (portador de incienso / Light Ball). */
  requiredSpecies: number | null;
  /** Coste monetario del cruce que produce este nodo (o de conseguirlo). */
  money: MoneyBreakdown;
}

export interface MoneyBreakdown {
  pokemon: number;
  items: number;
  breeding: number;
  /** Claves de precio desconocidas (no se suman). */
  unknown: string[];
  /** Claves de precio utilizadas (para distinguir coste exacto de estimación). */
  keys: string[];
}

export interface PlanStep {
  index: number;
  kind: 'prepare' | 'cross' | 'post' | 'final';
  title: string;
  nodeIds: string[];
  resultNodeId: string | null;
  lines: string[];
}

export interface CostSummary {
  pokemon: number;
  items: number;
  breeding: number;
  total: number;
  exact: boolean;
  unknownPrices: string[];
  estimatedPrices: string[];
}

export interface PlanStats {
  crosses: number;
  pokemonUsed: number;
  ownedUsed: number;
  acquired: number;
  generations: number;
  score: number;
  hatchMinutes: number;
}

export interface PlanMessage {
  code: string;
  message: string;
  detail?: string;
  ownedId?: string;
}

export interface BreedingSolution {
  id: string;
  label: string;
  rootId: string;
  nodes: Record<string, PlanNode>;
  steps: PlanStep[];
  stats: PlanStats;
  cost: CostSummary;
  items: { itemId: string; name: string; count: number }[];
  requiredPokemon: string[];
  optionalPokemon: string[];
  warnings: PlanMessage[];
  droppedFeatures: string[];
  optimal: boolean;
}

export interface BreedingPlan {
  target: DesiredPokemon;
  ok: boolean;
  best: BreedingSolution | null;
  alternatives: BreedingSolution[];
  warnings: PlanMessage[];
  errors: PlanMessage[];
  info: PlanMessage[];
  searchStats: { expansions: number; ms: number };
}
