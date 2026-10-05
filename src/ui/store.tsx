import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { emptyDesired } from '../engine/defaults';
import type { BreedingPlan, DesiredPokemon, OwnedPokemon } from '../engine/types';
import { AppRepository, defaultSettings, LocalStorageStore, type AppSettings, type SavedPlan } from '../persistence/storage';

export type Page = 'calculator' | 'collection' | 'database' | 'items' | 'moves' | 'plans' | 'settings';

interface AppState {
  loaded: boolean;
  page: Page;
  setPage: (p: Page) => void;
  collection: OwnedPokemon[];
  setCollection: (fn: (c: OwnedPokemon[]) => OwnedPokemon[]) => void;
  desired: DesiredPokemon;
  setDesired: (fn: (d: DesiredPokemon) => DesiredPokemon) => void;
  settings: AppSettings;
  setSettings: (fn: (s: AppSettings) => AppSettings) => void;
  plans: SavedPlan[];
  setPlans: (fn: (p: SavedPlan[]) => SavedPlan[]) => void;
  currentPlan: BreedingPlan | null;
  setCurrentPlan: (p: BreedingPlan | null) => void;
  /** Recalcular automáticamente al pulsar Calcular desde otras páginas. */
  pendingCalc: boolean;
  requestCalc: () => void;
  clearCalc: () => void;
}

const Ctx = createContext<AppState | null>(null);
const repo = new AppRepository(new LocalStorageStore());

function defaultDesired(): DesiredPokemon {
  const d = emptyDesired(445); // Garchomp como ejemplo inicial
  for (const s of ['hp', 'attack', 'defense', 'specialDefense', 'speed'] as const) d.ivs[s] = { min: 31, max: 31, priority: 'required' };
  d.nature = 'Jolly';
  return d;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState<Page>('calculator');
  const [collection, setCollectionRaw] = useState<OwnedPokemon[]>([]);
  const [desired, setDesiredRaw] = useState<DesiredPokemon>(defaultDesired);
  const [settings, setSettingsRaw] = useState<AppSettings>(defaultSettings);
  const [plans, setPlansRaw] = useState<SavedPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<BreedingPlan | null>(null);
  const [pendingCalc, setPendingCalc] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    (async () => {
      const [c, d, s, p] = await Promise.all([repo.loadCollection(), repo.loadDesired(), repo.loadSettings(), repo.loadPlans()]);
      setCollectionRaw(c);
      if (d) setDesiredRaw({ ...emptyDesired(d.speciesId), ...d });
      setSettingsRaw(s);
      setPlansRaw(p);
      loadedRef.current = true;
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loadedRef.current) void repo.saveCollection(collection);
  }, [collection]);
  useEffect(() => {
    if (loadedRef.current) void repo.saveDesired(desired);
  }, [desired]);
  useEffect(() => {
    if (loadedRef.current) void repo.saveSettings(settings);
  }, [settings]);
  useEffect(() => {
    if (loadedRef.current) void repo.savePlans(plans);
  }, [plans]);

  const setCollection = useCallback((fn: (c: OwnedPokemon[]) => OwnedPokemon[]) => setCollectionRaw(fn), []);
  const setDesired = useCallback((fn: (d: DesiredPokemon) => DesiredPokemon) => setDesiredRaw(fn), []);
  const setSettings = useCallback((fn: (s: AppSettings) => AppSettings) => setSettingsRaw(fn), []);
  const setPlans = useCallback((fn: (p: SavedPlan[]) => SavedPlan[]) => setPlansRaw(fn), []);

  const value = useMemo<AppState>(
    () => ({
      loaded,
      page,
      setPage,
      collection,
      setCollection,
      desired,
      setDesired,
      settings,
      setSettings,
      plans,
      setPlans,
      currentPlan,
      setCurrentPlan,
      pendingCalc,
      requestCalc: () => {
        setPendingCalc(true);
        setPage('calculator');
      },
      clearCalc: () => setPendingCalc(false),
    }),
    [loaded, page, collection, setCollection, desired, setDesired, settings, setSettings, plans, setPlans, currentPlan, pendingCalc],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp fuera de AppProvider');
  return v;
}
