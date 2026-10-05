/**
 * Persistencia (requisito 29). La UI sólo conoce la interfaz `KeyValueStore`; hoy se implementa
 * con localStorage y mañana podría ser un backend (misma interfaz, métodos async).
 */
import type { BreedingPlan, DesiredPokemon, OwnedPokemon, PlannerOptions } from '../engine/types';
import type { BreedingRules } from '../engine/rules/config';
import { defaultRules } from '../engine/rules/config';
import { defaultOptions, emptyDesired, newOwned } from '../engine/defaults';
import { STATS, type Gender } from '../data/models';

export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

const PREFIX = 'pokemmo-breeding:';

export class LocalStorageStore implements KeyValueStore {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e);
    }
  }
  async remove(key: string): Promise<void> {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* sin almacenamiento disponible */
    }
  }
}

/** Almacén en memoria (tests / navegadores sin almacenamiento). */
export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  async get<T>(key: string): Promise<T | null> {
    const raw = this.data.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, JSON.stringify(value));
  }
  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }
}

export interface SavedPlan {
  id: string;
  name: string;
  savedAt: string;
  plan: BreedingPlan;
}

export interface AppSettings {
  rules: BreedingRules;
  options: PlannerOptions;
  profileId: string;
}

export const KEYS = {
  collection: 'collection',
  desired: 'desired',
  plans: 'plans',
  settings: 'settings',
} as const;

export function defaultSettings(): AppSettings {
  return { rules: defaultRules(), options: defaultOptions(), profileId: 'balanced' };
}

/** Repositorio de la aplicación: añade migraciones mínimas al leer. */
export class AppRepository {
  constructor(private readonly store: KeyValueStore) {}

  async loadCollection(): Promise<OwnedPokemon[]> {
    const raw = (await this.store.get<unknown[]>(KEYS.collection)) ?? [];
    return raw.map((x) => normalizeOwned(x)).filter((x): x is OwnedPokemon => x !== null);
  }
  saveCollection(c: OwnedPokemon[]): Promise<void> {
    return this.store.set(KEYS.collection, c);
  }
  async loadDesired(): Promise<DesiredPokemon | null> {
    return this.store.get<DesiredPokemon>(KEYS.desired);
  }
  saveDesired(d: DesiredPokemon): Promise<void> {
    return this.store.set(KEYS.desired, d);
  }
  async loadPlans(): Promise<SavedPlan[]> {
    return (await this.store.get<SavedPlan[]>(KEYS.plans)) ?? [];
  }
  savePlans(p: SavedPlan[]): Promise<void> {
    return this.store.set(KEYS.plans, p);
  }
  async loadSettings(): Promise<AppSettings> {
    const s = await this.store.get<Partial<AppSettings>>(KEYS.settings);
    const d = defaultSettings();
    if (!s) return d;
    return {
      profileId: s.profileId ?? d.profileId,
      options: { ...d.options, ...s.options, weights: { ...d.options.weights, ...s.options?.weights } },
      rules: {
        prices: { ...d.rules.prices, ...s.rules?.prices },
        // incenseChance es una regla verificada (R09b), no un ajuste del usuario: siempre del código.
        mechanics: { ...d.rules.mechanics, ...s.rules?.mechanics, incenseChance: d.rules.mechanics.incenseChance },
      },
    };
  }
  saveSettings(s: AppSettings): Promise<void> {
    return this.store.set(KEYS.settings, s);
  }
}

// ------------------------------------------------------------ importación / exportación (req. 28)

const GENDERS: Gender[] = ['male', 'female', 'genderless'];

/** Acepta el formato del enunciado (species por nombre o id) y lo normaliza. */
export function normalizeOwned(x: unknown, resolveSpecies?: (nameOrId: string | number) => number | null): OwnedPokemon | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  let speciesId: number | null = typeof o.speciesId === 'number' ? o.speciesId : null;
  if (speciesId === null && o.species !== undefined && resolveSpecies) speciesId = resolveSpecies(o.species as string | number);
  if (speciesId === null) return null;
  const ivsIn = (o.ivs ?? {}) as Record<string, unknown>;
  const ivs = Object.fromEntries(STATS.map((s) => [s, clampIv(ivsIn[s])])) as OwnedPokemon['ivs'];
  const gender = GENDERS.includes(o.gender as Gender) ? (o.gender as Gender) : 'male';
  const status = o.status === 'mandatory' || o.status === 'forbidden' ? o.status : 'available';
  return newOwned({
    id: typeof o.id === 'string' ? o.id : undefined,
    speciesId,
    gender,
    ivs,
    nature: typeof o.nature === 'string' ? o.nature : 'Hardy',
    ability: typeof o.ability === 'string' ? o.ability : null,
    hiddenAbility: o.hiddenAbility === true,
    moves: Array.isArray(o.eggMoves ?? o.moves) ? ((o.eggMoves ?? o.moves) as unknown[]).filter((m): m is number => typeof m === 'number') : [],
    heldItem: typeof o.heldItem === 'string' ? o.heldItem : null,
    quantity: typeof o.quantity === 'number' && o.quantity > 0 ? Math.floor(o.quantity) : 1,
    notes: typeof o.notes === 'string' ? o.notes : '',
    status,
    shiny: o.shiny === true,
    alpha: o.alpha === true,
    value: typeof o.value === 'number' ? o.value : null,
  });
}

function clampIv(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(31, Math.round(n)));
}

export interface CollectionExport {
  format: 'pokemmo-breeding-collection';
  version: 1;
  exportedAt: string;
  pokemon: OwnedPokemon[];
}

export interface PlanExport {
  format: 'pokemmo-breeding-plan';
  version: 1;
  exportedAt: string;
  plan: BreedingPlan;
}

export function exportCollection(c: OwnedPokemon[]): CollectionExport {
  return { format: 'pokemmo-breeding-collection', version: 1, exportedAt: new Date().toISOString(), pokemon: c };
}

export function importCollection(json: string, resolveSpecies: (nameOrId: string | number) => number | null): { pokemon: OwnedPokemon[]; skipped: number } {
  const data = JSON.parse(json) as unknown;
  const list: unknown[] = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { pokemon?: unknown[] }).pokemon)
      ? (data as { pokemon: unknown[] }).pokemon
      : [data];
  const pokemon: OwnedPokemon[] = [];
  let skipped = 0;
  for (const x of list) {
    const p = normalizeOwned(x, resolveSpecies);
    if (p) pokemon.push(p);
    else skipped++;
  }
  return { pokemon, skipped };
}

export function exportPlan(plan: BreedingPlan): PlanExport {
  return { format: 'pokemmo-breeding-plan', version: 1, exportedAt: new Date().toISOString(), plan };
}

export function importPlan(json: string): BreedingPlan {
  const data = JSON.parse(json) as Partial<PlanExport> & Partial<BreedingPlan>;
  const plan = (data.format === 'pokemmo-breeding-plan' ? data.plan : data) as BreedingPlan | undefined;
  if (!plan || typeof plan !== 'object' || !('target' in plan) || !('alternatives' in plan)) throw new Error('El archivo no contiene un plan válido.');
  return plan;
}

export { emptyDesired };
