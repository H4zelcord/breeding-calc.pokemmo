/**
 * Reglas de herencia de PokeMMO como funciones puras.
 * Cada función indica las reglas de docs/POKEMMO_BREEDING_RULES.md en las que se basa.
 */
import type { Dex } from '../../data/dex';
import { femaleFraction, genderKind } from '../../data/dex';
import type { Gender, StatKey } from '../../data/models';
import { IV_MAX, IV_MIN, STATS } from '../../data/models';
import type { IVInterval } from '../types';
import type { BreedingRules, PriceKey } from './config';

export const FULL_INTERVAL: IVInterval = { min: IV_MIN, max: IV_MAX };

/**
 * R20-R23. Intervalo garantizado del IV del hijo.
 * El hijo recibe el IV de A, el de B o ⌊(A+B)/2⌋; con brace recibe el del portador.
 */
export function childIvInterval(a: IVInterval, b: IVInterval, bracedBy: 'a' | 'b' | null): IVInterval {
  if (bracedBy === 'a') return { ...a };
  if (bracedBy === 'b') return { ...b };
  return { min: Math.min(a.min, b.min), max: Math.max(a.max, b.max) };
}

/** Todos los valores posibles del hijo sin brace (para tests exhaustivos de R20). */
export function possibleChildValues(a: number, b: number): number[] {
  return [...new Set([a, b, Math.floor((a + b) / 2)])].sort((x, y) => x - y);
}

export function intervalWithin(inner: IVInterval, outer: IVInterval): boolean {
  return inner.min >= outer.min && inner.max <= outer.max;
}

export function childIvs(
  a: Record<StatKey, IVInterval>,
  b: Record<StatKey, IVInterval>,
  braceA: StatKey | null,
  braceB: StatKey | null,
): Record<StatKey, IVInterval> {
  if (braceA && braceA === braceB) throw new Error('Ambos progenitores no pueden forzar el mismo stat');
  const out = {} as Record<StatKey, IVInterval>;
  for (const s of STATS) out[s] = childIvInterval(a[s], b[s], braceA === s ? 'a' : braceB === s ? 'b' : null);
  return out;
}

/** R60/R61. Precio de fijar el género de un huevo. */
export function genderFeeKey(ratio: number, gender: Gender | 'any'): PriceKey | null {
  if (gender === 'any' || gender === 'genderless') return null;
  const kind = genderKind(ratio);
  if (kind !== 'mixed') return null; // sólo hay un género posible: no hay que pagar
  const f = femaleFraction(ratio);
  const share = gender === 'female' ? f : 1 - f;
  if (Math.abs(share - 0.5) < 0.01) return 'genderEven';
  if (share > 0.5) return 'genderMajority';
  if (share >= 0.2) return 'genderMinority25';
  return 'genderMinority12';
}

export function genderFee(rules: BreedingRules, ratio: number, gender: Gender | 'any'): { value: number; unknown: string | null; key: PriceKey | null } {
  const key = genderFeeKey(ratio, gender);
  if (!key) return { value: 0, unknown: null, key: null };
  const p = rules.prices[key];
  return { value: p.value ?? 0, unknown: p.value === null ? key : null, key };
}

export interface PairCheck {
  ok: boolean;
  reason: string | null;
  /** Familia de la cría. */
  childFamily: number | null;
}

/** R03-R07. Comprueba si dos Pokémon concretos pueden criar juntos. */
export function canBreedPair(
  dex: Dex,
  a: { speciesId: number; gender: Gender; shiny?: boolean },
  b: { speciesId: number; gender: Gender; shiny?: boolean },
): PairCheck {
  const fail = (reason: string): PairCheck => ({ ok: false, reason, childFamily: null });
  if (!!a.shiny !== !!b.shiny) return fail('Un shiny no puede criar con un Pokémon no shiny (R65).');
  for (const p of [a, b]) {
    if (!dex.speciesCanBreed(p.speciesId)) {
      const fam = dex.familyOf(p.speciesId);
      return fail(
        fam.canBreed
          ? `${dex.speciesName(p.speciesId)} es un bebé y no puede criar: hay que evolucionarlo (R08).`
          : `${dex.speciesName(p.speciesId)} pertenece al grupo "No puede criar" (R06).`,
      );
    }
  }
  const fa = dex.familyIdOf(a.speciesId);
  const fb = dex.familyIdOf(b.speciesId);
  const aDitto = dex.isDittoFamily(fa);
  const bDitto = dex.isDittoFamily(fb);
  if (aDitto && bDitto) return fail('Dos Ditto no pueden criar entre sí (R04).');
  if (aDitto || bDitto) return { ok: true, reason: null, childFamily: aDitto ? fb : fa };
  const aGl = a.gender === 'genderless';
  const bGl = b.gender === 'genderless';
  if (aGl || bGl) {
    if (aGl && bGl && fa === fb) return { ok: true, reason: null, childFamily: fa };
    return fail('Los Pokémon sin género sólo crían con su propia línea evolutiva o con Ditto (R05).');
  }
  if (a.gender === b.gender) return fail('Los progenitores deben ser de género opuesto (R03).');
  if (!dex.shareEggGroup(fa, fb)) return fail('No comparten ningún grupo huevo (R03).');
  const mother = a.gender === 'female' ? fa : fb;
  return { ok: true, reason: null, childFamily: mother };
}
