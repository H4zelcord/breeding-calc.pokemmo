import { useApp, type Page, AppProvider } from './store';
import { CalculatorPage } from './pages/CalculatorPage';
import { CollectionPage } from './pages/CollectionPage';
import { DatabasePage, ItemsPage, MovesPage, SavedPlansPage } from './pages/InfoPages';
import { SettingsPage } from './pages/SettingsPage';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'calculator', label: 'Calculadora', icon: '🧮' },
  { id: 'collection', label: 'Mis Pokémon', icon: '📦' },
  { id: 'database', label: 'Base de datos', icon: '📚' },
  { id: 'items', label: 'Objetos', icon: '🎒' },
  { id: 'moves', label: 'Movimientos', icon: '💥' },
  { id: 'plans', label: 'Planes guardados', icon: '💾' },
  { id: 'settings', label: 'Configuración', icon: '⚙️' },
];

function Shell() {
  const { page, setPage, collection, plans } = useApp();
  const count: Partial<Record<Page, number>> = { collection: collection.length, plans: plans.length };
  return (
    <div className="app">
      <nav className="sidebar" aria-label="Secciones">
        <div className="brand">
          PokeMMO Breeding
          <small>Planificador de crianza</small>
        </div>
        {NAV.map((n) => (
          <button key={n.id} className={`nav-item ${page === n.id ? 'active' : ''}`} onClick={() => setPage(n.id)} aria-current={page === n.id ? 'page' : undefined}>
            <span aria-hidden>{n.icon}</span>
            {n.label}
            {count[n.id] ? <span className="count">{count[n.id]}</span> : null}
          </button>
        ))}
        <div className="sidebar-foot">
          Datos del cliente de PokeMMO (PokeMMO-Tools/pokemmo-data). Reglas verificadas: ver Configuración.
        </div>
      </nav>
      <main className="main">
        {page === 'calculator' && <CalculatorPage />}
        {page === 'collection' && <CollectionPage />}
        {page === 'database' && <DatabasePage />}
        {page === 'items' && <ItemsPage />}
        {page === 'moves' && <MovesPage />}
        {page === 'plans' && <SavedPlansPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
