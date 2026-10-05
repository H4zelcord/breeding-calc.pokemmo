import { describe, expect, it } from 'vitest';
import { BREEDING_ITEMS, gameItem, itemLabel, itemName } from '../src/data/items';
import { STAT_LABELS } from '../src/data/models';

describe('Nombres de objetos (datos oficiales del cliente)', () => {
  it('cada objeto existe en el volcado y su nombre coincide con el oficial', () => {
    for (const item of BREEDING_ITEMS) {
      const main = gameItem(item.gameIds[0]);
      expect(item.name).toBe(main.name);
      expect(item.nameEs).toBe(main.nameEs);
      expect(item.gameText).toBe(main.description);
      expect(item.nameEs).toBeTruthy();
    }
  });

  it('los braces corresponden al stat que dice su texto in-game', () => {
    const textStat: Record<string, string> = { hp: 'HP', attack: 'Attack', defense: 'Defense', specialAttack: 'Sp.Atk', specialDefense: 'Sp.Def', speed: 'Speed' };
    for (const item of BREEDING_ITEMS) {
      if (item.data.kind !== 'iv') continue;
      expect(item.gameText).toContain(`inherits this Pokémon's ${textStat[item.data.stat]} IV`);
      expect(item.effect).toContain(STAT_LABELS[item.data.stat].name);
    }
  });

  it('nombres oficiales en español', () => {
    expect(itemName('power-weight')).toBe('Pesa Recia (Power Weight)');
    expect(itemName('power-anklet')).toBe('Franja Recia (Power Anklet)');
    expect(itemName('everstone')).toBe('Piedraeterna (Everstone)');
    expect(itemName('light-ball')).toBe('Bolaluminosa (Light Ball)');
    expect(itemName('luck-incense')).toBe('Incie. Duplo (Luck Incense)');
    expect(itemLabel({ name: 'X', nameEs: null })).toBe('X');
  });

  it('los alias incluyen el nombre de los braces de otras regiones del cliente', () => {
    const w = BREEDING_ITEMS.find((i) => i.id === 'power-weight')!;
    expect(w.aliases).toEqual(expect.arrayContaining(['Brace - HP', 'BRAZAL - PS']));
  });

  it('Ability Patch y Prismatic Pearl son objetos distintos', () => {
    expect(itemName('ability-patch')).toBe('Parche de Habilidad (Ability Patch)');
    expect(itemName('prismatic-pearl')).toBe('Perla Prismática (Prismatic Pearl)');
  });
});
