import { describe, expect, it } from 'vitest';
import { dex, moveId, speciesId } from './helpers';

describe('Datos de PokeMMO (S1)', () => {
  it('contiene las 649 especies de las generaciones 1-5', () => {
    expect(dex.species.size).toBe(649);
    expect(dex.speciesName(29)).toBe('Nidoran♀');
  });

  it('familias y especie del huevo (R07)', () => {
    const garchomp = speciesId('Garchomp');
    expect(dex.eggSpeciesForTarget(garchomp)).toBe(speciesId('Gible'));
    expect(dex.familyOf(garchomp).members).toEqual([443, 444, 445]);
  });

  it('bebés de incienso: sin incienso nace la siguiente etapa (R09, R10)', () => {
    const fam = dex.familyOf(speciesId('Azumarill'));
    expect(fam.incense?.itemId).toBe('sea-incense');
    expect(dex.eggSpecies(fam.id)).toBe(speciesId('Marill'));
    expect(dex.eggSpecies(fam.id, true)).toBe(speciesId('Azurill'));
    expect(dex.eggSpeciesForTarget(speciesId('Azurill'))).toBe(speciesId('Azurill'));
  });

  it('bebés sin incienso (Pichu) nacen directamente', () => {
    expect(dex.eggSpeciesForTarget(speciesId('Raichu'))).toBe(speciesId('Pichu'));
    expect(dex.isBaby(speciesId('Pichu'))).toBe(true);
    expect(dex.speciesCanBreed(speciesId('Pichu'))).toBe(false);
  });

  it('diferencias con los juegos oficiales: Nidoqueen puede criar en PokeMMO', () => {
    expect(dex.speciesCanBreed(speciesId('Nidoqueen'))).toBe(true);
  });

  it('grupos huevo y géneros', () => {
    expect(dex.getFamily(dex.familyIdOf(speciesId('Tauros'))).genderKind).toBe('male-only');
    expect(dex.getFamily(dex.familyIdOf(speciesId('Chansey'))).genderKind).toBe('female-only');
    expect(dex.isGenderlessFamily(dex.familyIdOf(speciesId('Magnemite')))).toBe(true);
    expect(dex.shareEggGroup(dex.familyIdOf(speciesId('Gible')), dex.familyIdOf(speciesId('Charmander')))).toBe(true);
  });

  it('legendarios no pueden criar (R06)', () => {
    expect(dex.familyOf(speciesId('Mewtwo')).canBreed).toBe(false);
  });

  it('movimientos huevo y Volt Tackle (R51, R55)', () => {
    expect(dex.desiredEggMoveOptions(speciesId('Marill'))).toContain(moveId('Belly Drum'));
    expect(dex.desiredEggMoveOptions(speciesId('Pikachu'))).toContain(344);
    expect(dex.desiredEggMoveOptions(speciesId('Garchomp'))).toEqual(dex.eggMovesOf(speciesId('Gible')));
  });

  it('búsqueda con autocompletado', () => {
    expect(dex.search('garch')[0].name).toBe('Garchomp');
    expect(dex.search('gar').map((x) => x.name)).toEqual(expect.arrayContaining(['Gardevoir', 'Garchomp']));
    expect(dex.search('#445')[0].id).toBe(445);
  });
});
