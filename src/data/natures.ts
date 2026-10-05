import type { Nature } from './models';

/** Las 25 naturalezas (Gen 3+). PokeMMO usa los nombres en inglés. */
export const NATURES: Nature[] = [
  { name: 'Hardy', nameEs: 'Fuerte', plus: null, minus: null },
  { name: 'Lonely', nameEs: 'Huraña', plus: 'attack', minus: 'defense' },
  { name: 'Brave', nameEs: 'Audaz', plus: 'attack', minus: 'speed' },
  { name: 'Adamant', nameEs: 'Firme', plus: 'attack', minus: 'specialAttack' },
  { name: 'Naughty', nameEs: 'Pícara', plus: 'attack', minus: 'specialDefense' },
  { name: 'Bold', nameEs: 'Osada', plus: 'defense', minus: 'attack' },
  { name: 'Docile', nameEs: 'Dócil', plus: null, minus: null },
  { name: 'Relaxed', nameEs: 'Plácida', plus: 'defense', minus: 'speed' },
  { name: 'Impish', nameEs: 'Agitada', plus: 'defense', minus: 'specialAttack' },
  { name: 'Lax', nameEs: 'Floja', plus: 'defense', minus: 'specialDefense' },
  { name: 'Timid', nameEs: 'Miedosa', plus: 'speed', minus: 'attack' },
  { name: 'Hasty', nameEs: 'Activa', plus: 'speed', minus: 'defense' },
  { name: 'Serious', nameEs: 'Seria', plus: null, minus: null },
  { name: 'Jolly', nameEs: 'Alegre', plus: 'speed', minus: 'specialAttack' },
  { name: 'Naive', nameEs: 'Ingenua', plus: 'speed', minus: 'specialDefense' },
  { name: 'Modest', nameEs: 'Modesta', plus: 'specialAttack', minus: 'attack' },
  { name: 'Mild', nameEs: 'Afable', plus: 'specialAttack', minus: 'defense' },
  { name: 'Quiet', nameEs: 'Mansa', plus: 'specialAttack', minus: 'speed' },
  { name: 'Bashful', nameEs: 'Tímida', plus: null, minus: null },
  { name: 'Rash', nameEs: 'Alocada', plus: 'specialAttack', minus: 'specialDefense' },
  { name: 'Calm', nameEs: 'Serena', plus: 'specialDefense', minus: 'attack' },
  { name: 'Gentle', nameEs: 'Amable', plus: 'specialDefense', minus: 'defense' },
  { name: 'Sassy', nameEs: 'Grosera', plus: 'specialDefense', minus: 'speed' },
  { name: 'Careful', nameEs: 'Cauta', plus: 'specialDefense', minus: 'specialAttack' },
  { name: 'Quirky', nameEs: 'Rara', plus: null, minus: null },
];

export const NATURE_BY_NAME = new Map(NATURES.map((n) => [n.name, n]));

export function isValidNature(name: string): boolean {
  return NATURE_BY_NAME.has(name);
}
