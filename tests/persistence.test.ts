import { describe, expect, it } from 'vitest';
import { AppRepository, exportCollection, exportPlan, importCollection, importPlan, MemoryStore } from '../src/persistence/storage';
import { newOwned } from '../src/engine';
import { desired, dex, plan } from './helpers';

const resolve = (x: string | number) => (typeof x === 'number' ? x : dex.allSpecies().find((s) => s.name.toLowerCase() === String(x).toLowerCase())?.id ?? null);

describe('Persistencia e importación/exportación (requisitos 28, 29)', () => {
  it('guarda y recupera la colección y la configuración', async () => {
    const repo = new AppRepository(new MemoryStore());
    const c = [newOwned({ speciesId: 443, gender: 'female', status: 'mandatory' })];
    await repo.saveCollection(c);
    expect(await repo.loadCollection()).toEqual(c);
    const s = await repo.loadSettings();
    s.rules.prices.everstone = { value: 2000, status: 'USER', note: '' };
    await repo.saveSettings(s);
    expect((await repo.loadSettings()).rules.prices.everstone.value).toBe(2000);
  });

  it('la probabilidad del incienso (R09b) no la sobrescriben ajustes antiguos guardados', async () => {
    const store = new MemoryStore();
    await store.set('settings', { rules: { mechanics: { incenseChance: null } } });
    const s = await new AppRepository(store).loadSettings();
    expect(s.rules.mechanics.incenseChance).toBe(1);
  });

  it('importa el formato JSON del enunciado (species por nombre)', () => {
    const json = JSON.stringify({
      species: 'Gible',
      gender: 'male',
      ivs: { hp: 31, attack: 31, defense: 0, specialAttack: 0, specialDefense: 31, speed: 31 },
      nature: 'Jolly',
      ability: 'Sand Veil',
      eggMoves: [],
    });
    const { pokemon, skipped } = importCollection(json, resolve);
    expect(skipped).toBe(0);
    expect(pokemon[0].speciesId).toBe(443);
    expect(pokemon[0].ivs.specialDefense).toBe(31);
    expect(pokemon[0].status).toBe('available');
  });

  it('exportar → importar colección es estable', () => {
    const c = [newOwned({ speciesId: 25, gender: 'female', quantity: 3, notes: 'x' })];
    const back = importCollection(JSON.stringify(exportCollection(c)), resolve);
    expect(back.pokemon).toEqual(c);
  });

  it('exportar → importar plan es estable', () => {
    const p = plan(desired('Gible', ['hp', 'attack']));
    const back = importPlan(JSON.stringify(exportPlan(p)));
    expect(back.best!.stats).toEqual(p.best!.stats);
    expect(() => importPlan('{"foo":1}')).toThrow();
  });
});
