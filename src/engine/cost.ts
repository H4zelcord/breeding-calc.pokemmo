/**
 * Función de coste configurable, separada del motor (requisitos 14 y 20).
 */
import type { CostWeights, MoneyBreakdown } from './types';
import type { BreedingRules, PriceKey } from './rules/config';

export interface CostProfile {
  id: string;
  label: string;
  description: string;
  weights: CostWeights;
}

export const COST_PROFILES: CostProfile[] = [
  {
    id: 'balanced',
    label: 'Equilibrado',
    description: 'Pocos cruces, aprovecha la colección y tiene en cuenta el dinero.',
    weights: { cross: 1, pokemon: 0.5, acquire: 1, money: 0.05, ownedUse: 0.2, generations: 0.3 },
  },
  {
    id: 'min-crosses',
    label: 'Mínimos cruces',
    description: 'Prioriza el número de cruces por encima de todo.',
    weights: { cross: 3, pokemon: 0.3, acquire: 0.5, money: 0.01, ownedUse: 0.1, generations: 0.5 },
  },
  {
    id: 'min-money',
    label: 'Mínimo dinero',
    description: 'Prioriza el coste monetario (braces, género, objetos).',
    weights: { cross: 0.2, pokemon: 0.2, acquire: 0.5, money: 1, ownedUse: 0.1, generations: 0 },
  },
  {
    id: 'min-pokemon',
    label: 'Mínimos Pokémon',
    description: 'Prioriza conseguir el menor número de Pokémon nuevos.',
    weights: { cross: 0.5, pokemon: 1, acquire: 3, money: 0.02, ownedUse: 0.1, generations: 0.2 },
  },
  {
    id: 'keep-collection',
    label: 'Conservar mi colección',
    description: 'Sólo usa Pokémon de la colección cuando ahorran mucho.',
    weights: { cross: 1, pokemon: 0.5, acquire: 1, money: 0.05, ownedUse: 2.5, generations: 0.3 },
  },
];

export function profileById(id: string): CostProfile {
  return COST_PROFILES.find((p) => p.id === id) ?? COST_PROFILES[0];
}

export function emptyMoney(): MoneyBreakdown {
  return { pokemon: 0, items: 0, breeding: 0, unknown: [], keys: [] };
}

export function addMoney(a: MoneyBreakdown, b: MoneyBreakdown): MoneyBreakdown {
  return {
    pokemon: a.pokemon + b.pokemon,
    items: a.items + b.items,
    breeding: a.breeding + b.breeding,
    unknown: [...new Set([...a.unknown, ...b.unknown])],
    keys: [...new Set([...a.keys, ...b.keys])],
  };
}

export function moneyTotal(m: MoneyBreakdown): number {
  return m.pokemon + m.items + m.breeding;
}

/** Añade un precio a una partida; si el precio es desconocido lo registra en `unknown`. */
export function charge(
  rules: BreedingRules,
  m: MoneyBreakdown,
  part: 'pokemon' | 'items' | 'breeding',
  key: PriceKey,
  times = 1,
): MoneyBreakdown {
  if (times <= 0) return m;
  const price = rules.prices[key];
  const out = { ...m, unknown: [...m.unknown], keys: m.keys.includes(key) ? m.keys : [...m.keys, key] };
  if (price.value === null) {
    if (!out.unknown.includes(key)) out.unknown.push(key);
  } else {
    out[part] += price.value * times;
  }
  return out;
}

export function moneyCost(weights: CostWeights, m: MoneyBreakdown): number {
  return (weights.money * moneyTotal(m)) / 1000;
}
