import { describe, expect, it } from 'vitest';
import { STATS, type StatKey } from '../src/data/models';
import type { IVInterval } from '../src/engine';
import { canBreedPair, childIvInterval, possibleChildValues } from '../src/engine';
import { childIvs, genderFeeKey } from '../src/engine/rules/inheritance';
import { dex, speciesId } from './helpers';

const full = (): Record<StatKey, IVInterval> => Object.fromEntries(STATS.map((s) => [s, { min: 0, max: 31 }])) as Record<StatKey, IVInterval>;

describe('R20-R23: herencia de IVs', () => {
  it('sin brace el hijo recibe A, B o la media redondeada hacia abajo', () => {
    expect(possibleChildValues(31, 0)).toEqual([0, 15, 31]);
    expect(possibleChildValues(31, 31)).toEqual([31]);
    expect(possibleChildValues(20, 25)).toEqual([20, 22, 25]);
  });

  it('el intervalo garantizado contiene todos los valores posibles (exhaustivo)', () => {
    for (let a = 0; a <= 31; a += 3) {
      for (let b = 0; b <= 31; b += 2) {
        const iv = childIvInterval({ min: a, max: a }, { min: b, max: b }, null);
        for (const v of possibleChildValues(a, b)) {
          expect(v).toBeGreaterThanOrEqual(iv.min);
          expect(v).toBeLessThanOrEqual(iv.max);
        }
      }
    }
  });

  it('ambos padres con 31 garantizan 31 (R22) y ambos con 0 garantizan 0 (R23)', () => {
    expect(childIvInterval({ min: 31, max: 31 }, { min: 31, max: 31 }, null)).toEqual({ min: 31, max: 31 });
    expect(childIvInterval({ min: 0, max: 0 }, { min: 0, max: 0 }, null)).toEqual({ min: 0, max: 0 });
  });

  for (const stat of STATS) {
    it(`brace de ${stat}: el hijo hereda el IV del portador (R21)`, () => {
      const a = full();
      const b = full();
      a[stat] = { min: 31, max: 31 };
      b[stat] = { min: 0, max: 0 };
      expect(childIvs(a, b, stat, null)[stat]).toEqual({ min: 31, max: 31 });
      expect(childIvs(a, b, null, stat)[stat]).toEqual({ min: 0, max: 0 });
      // Sin brace no está garantizado
      expect(childIvs(a, b, null, null)[stat]).toEqual({ min: 0, max: 31 });
    });
  }

  it('no se puede forzar el mismo stat con los dos padres', () => {
    expect(() => childIvs(full(), full(), 'hp', 'hp')).toThrow();
  });
});

describe('R60/R61: precio del género', () => {
  it('ratio 50/50', () => {
    expect(genderFeeKey(127, 'male')).toBe('genderEven');
    expect(genderFeeKey(127, 'female')).toBe('genderEven');
  });
  it('7:1 (Gible es 50/50, Eevee 7:1)', () => {
    expect(genderFeeKey(31, 'male')).toBe('genderMajority');
    expect(genderFeeKey(31, 'female')).toBe('genderMinority12');
  });
  it('3:1', () => {
    expect(genderFeeKey(63, 'female')).toBe('genderMinority25');
    expect(genderFeeKey(191, 'male')).toBe('genderMinority25');
  });
  it('especies de un solo género o sin género no pagan', () => {
    expect(genderFeeKey(0, 'male')).toBeNull();
    expect(genderFeeKey(254, 'female')).toBeNull();
    expect(genderFeeKey(255, 'any')).toBeNull();
  });
});

describe('R03-R08: compatibilidad de parejas', () => {
  const gible = speciesId('Gible');
  const charmander = speciesId('Charmander');
  const pikachu = speciesId('Pikachu');
  const ditto = speciesId('Ditto');
  const magnemite = speciesId('Magnemite');
  const magneton = speciesId('Magneton');
  const pichu = speciesId('Pichu');
  const mewtwo = speciesId('Mewtwo');

  it('grupo huevo compartido y género opuesto: la cría es de la madre', () => {
    const r = canBreedPair(dex, { speciesId: gible, gender: 'female' }, { speciesId: charmander, gender: 'male' });
    expect(r.ok).toBe(true);
    expect(r.childFamily).toBe(dex.familyIdOf(gible));
  });
  it('mismo género no cría', () => {
    expect(canBreedPair(dex, { speciesId: gible, gender: 'male' }, { speciesId: gible, gender: 'male' }).ok).toBe(false);
  });
  it('sin grupo huevo común no cría', () => {
    const r = canBreedPair(dex, { speciesId: gible, gender: 'female' }, { speciesId: pikachu, gender: 'male' });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/grupo huevo/);
  });
  it('Ditto cría con cualquiera y la cría es del otro progenitor (R04)', () => {
    const r = canBreedPair(dex, { speciesId: ditto, gender: 'genderless' }, { speciesId: gible, gender: 'male' });
    expect(r.ok).toBe(true);
    expect(r.childFamily).toBe(dex.familyIdOf(gible));
    expect(canBreedPair(dex, { speciesId: ditto, gender: 'genderless' }, { speciesId: ditto, gender: 'genderless' }).ok).toBe(false);
  });
  it('sin género: sólo su línea o Ditto (R05)', () => {
    expect(canBreedPair(dex, { speciesId: magnemite, gender: 'genderless' }, { speciesId: magneton, gender: 'genderless' }).ok).toBe(true);
    expect(canBreedPair(dex, { speciesId: magnemite, gender: 'genderless' }, { speciesId: gible, gender: 'male' }).ok).toBe(false);
  });
  it('bebés y legendarios no crían (R06, R08)', () => {
    expect(canBreedPair(dex, { speciesId: pichu, gender: 'female' }, { speciesId: pikachu, gender: 'male' }).reason).toMatch(/bebé/);
    expect(canBreedPair(dex, { speciesId: mewtwo, gender: 'genderless' }, { speciesId: ditto, gender: 'genderless' }).ok).toBe(false);
  });
  it('shiny no cría con no shiny (R65)', () => {
    expect(canBreedPair(dex, { speciesId: gible, gender: 'female', shiny: true }, { speciesId: gible, gender: 'male' }).ok).toBe(false);
  });
});
