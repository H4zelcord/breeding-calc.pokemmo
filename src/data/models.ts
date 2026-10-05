/**
 * Modelos de datos puros (sin dependencias de UI ni del motor).
 */

export const STATS = ['hp', 'attack', 'defense', 'specialAttack', 'specialDefense', 'speed'] as const;
export type StatKey = (typeof STATS)[number];

export const STAT_LABELS: Record<StatKey, { short: string; name: string }> = {
  hp: { short: 'HP', name: 'PS' },
  attack: { short: 'ATK', name: 'Ataque' },
  defense: { short: 'DEF', name: 'Defensa' },
  specialAttack: { short: 'SPA', name: 'Ataque Especial' },
  specialDefense: { short: 'SPD', name: 'Defensa Especial' },
  speed: { short: 'SPE', name: 'Velocidad' },
};

export type IVs = Record<StatKey, number>;
export const IV_MIN = 0;
export const IV_MAX = 31;

export type Gender = 'male' | 'female' | 'genderless';
export const GENDER_SYMBOL: Record<Gender | 'any', string> = {
  male: '♂',
  female: '♀',
  genderless: '⚲',
  any: '⚥',
};

/** Grupos huevo tal y como aparecen en el volcado del cliente de PokeMMO. */
export type EggGroup =
  | 'monster'
  | 'water a'
  | 'water b'
  | 'water c'
  | 'bug'
  | 'flying'
  | 'field'
  | 'fairy'
  | 'plant'
  | 'humanoid'
  | 'mineral'
  | 'chaos'
  | 'dragon'
  | 'genderless'
  | 'ditto'
  | 'cannot breed';

export const EGG_GROUP_LABELS: Record<EggGroup, string> = {
  monster: 'Monstruo',
  'water a': 'Agua 1',
  'water b': 'Agua 2',
  'water c': 'Agua 3',
  bug: 'Bicho',
  flying: 'Volador',
  field: 'Campo',
  fairy: 'Hada',
  plant: 'Planta',
  humanoid: 'Humanoide',
  mineral: 'Mineral',
  chaos: 'Amorfo',
  dragon: 'Dragón',
  genderless: 'Sin género',
  ditto: 'Ditto',
  'cannot breed': 'No puede criar',
};

export interface Evolution {
  id: number;
  method: string;
  value: number;
}

export interface Abilities {
  primary: string | null;
  secondary: string | null;
  hidden: string | null;
}

/** Especie tal y como se genera desde el volcado (src/data/generated/species.json). */
export interface SpeciesData {
  id: number;
  name: string;
  types: string[];
  /** Codificación Gen 5: 0 = sólo macho, 254 = sólo hembra, 255 = sin género, resto = probabilidad de hembra. */
  genderRatio: number;
  eggGroups: EggGroup[];
  abilities: Abilities;
  evolvesTo: Evolution[];
  /** Movimientos huevo de esta especie cuando eclosiona. */
  eggMoves: number[];
  /** Movimientos huevo especiales (Volt Tackle). */
  specialEggMoves: number[];
  /** Movimientos aprendibles sin crianza (nivel, MT, tutor, evolución). */
  learnable: number[];
  obtainable: boolean;
  baseStats: Record<StatKey, number>;
}

export interface MoveData {
  id: number;
  name: string;
  type: string;
  category: string;
  power: number;
  accuracy: number;
  pp: number;
}

export interface Nature {
  name: string;
  nameEs: string;
  plus: StatKey | null;
  minus: StatKey | null;
}

export type GenderRatioKind = 'male-only' | 'female-only' | 'genderless' | 'mixed';

/** Familia = línea evolutiva completa. Es la unidad relevante para la crianza. */
export interface Family {
  /** Id de la especie raíz (forma más básica). */
  id: number;
  members: number[];
  /** Grupos huevo de los miembros que pueden criar. */
  eggGroups: EggGroup[];
  canBreed: boolean;
  genderRatio: number;
  genderKind: GenderRatioKind;
  /** Especie que eclosiona normalmente (sin incienso). */
  defaultEggSpecies: number;
  /** Especie bebé obtenible sólo con incienso, si existe. */
  incense: IncenseInfo | null;
  /** Primer miembro que puede criar (para sugerir qué capturar). */
  firstBreedable: number | null;
}

export interface IncenseInfo {
  itemId: string;
  babySpecies: number;
  /** Especies exactas que deben llevar el incienso (texto del objeto). */
  holders: number[];
}
