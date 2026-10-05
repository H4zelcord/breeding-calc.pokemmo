import { getDex } from '../../data/dex';
import { COST_PROFILES } from '../../engine/cost';
import { PRICE_LABELS, defaultRules, type PriceKey } from '../../engine/rules/config';
import { RULES, SOURCES, type RuleStatus } from '../../engine/rules/rulesCatalog';
import type { CostWeights } from '../../engine/types';
import { defaultSettings } from '../../persistence/storage';
import { SpeciesPicker } from '../components/SpeciesPicker';
import { useApp } from '../store';

const dex = getDex();

const STATUS_CLASS: Record<RuleStatus, string> = {
  VERIFIED: 'st-ok',
  DERIVED: 'st-inh',
  REPORTED: 'st-new',
  ESTIMATE: 'st-new',
  UNKNOWN: 'st-pend',
};

const WEIGHT_LABELS: Record<keyof CostWeights, string> = {
  cross: 'Por cruce',
  pokemon: 'Por Pokémon consumido',
  acquire: 'Por Pokémon a conseguir',
  money: 'Por cada 1.000 de dinero',
  ownedUse: 'Por usar uno de la colección',
  generations: 'Por generación',
};

export function SettingsPage() {
  const { settings, setSettings } = useApp();
  const { rules, options } = settings;

  const setPrice = (k: PriceKey, v: string) =>
    setSettings((s) => ({
      ...s,
      rules: {
        ...s.rules,
        prices: {
          ...s.rules.prices,
          [k]: v === '' ? { ...defaultRules().prices[k] } : { value: Math.max(0, Number(v)), status: 'USER' as const, note: 'Introducido por el usuario' },
        },
      },
    }));

  const setWeight = (k: keyof CostWeights, v: string) =>
    setSettings((s) => ({ ...s, profileId: 'custom', options: { ...s.options, weights: { ...s.options.weights, [k]: Math.max(0, Number(v) || 0) } } }));

  return (
    <div>
      <div className="page-head">
        <h1>Configuración</h1>
        <span className="spacer" />
        <button className="btn danger" onClick={() => confirm('¿Restablecer toda la configuración?') && setSettings(() => defaultSettings())}>
          Restablecer
        </button>
      </div>
      <div className="grid-2">
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <h2>Precios</h2>
            <p className="small muted" style={{ marginTop: 0 }}>
              No se inventan precios: los desconocidos no se suman y el coste se marca como incompleto. Deja un campo vacío para volver al valor por defecto.
            </p>
            <table className="data">
              <tbody>
                {(Object.keys(PRICE_LABELS) as PriceKey[]).map((k) => {
                  const p = rules.prices[k];
                  return (
                    <tr key={k}>
                      <td>
                        {PRICE_LABELS[k]}
                        <div className="small muted">{p.note}</div>
                      </td>
                      <td>
                        <span className={`st ${p.status === 'USER' ? 'st-ok' : p.status === 'UNKNOWN' ? 'st-pend' : 'st-new'}`}>{p.status === 'USER' ? 'USUARIO' : p.status}</span>
                      </td>
                      <td>
                        <input className="input" type="number" min={0} style={{ width: 110 }} value={p.value ?? ''} placeholder="?" onChange={(e) => setPrice(k, e.target.value)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card stack">
            <h2>Función de coste</h2>
            <div className="row">
              {COST_PROFILES.map((p) => (
                <button
                  key={p.id}
                  className={`btn sm ${settings.profileId === p.id ? 'primary' : ''}`}
                  onClick={() => setSettings((s) => ({ ...s, profileId: p.id, options: { ...s.options, weights: { ...p.weights } } }))}
                  title={p.description}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <table className="data">
              <tbody>
                {(Object.keys(WEIGHT_LABELS) as (keyof CostWeights)[]).map((k) => (
                  <tr key={k}>
                    <td>{WEIGHT_LABELS[k]}</td>
                    <td>
                      <input className="input" type="number" step={0.1} min={0} style={{ width: 90 }} value={options.weights[k]} onChange={(e) => setWeight(k, e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="small muted" style={{ margin: 0 }}>
              coste = Σ pesos × (cruces, Pokémon, dinero…). Los Pokémon OBLIGATORIOS tienen prioridad absoluta sobre cualquier peso.
            </p>
          </div>
          <div className="card stack">
            <h2>Búsqueda</h2>
            <label className="field">
              <span>Presupuesto de búsqueda (nodos A*)</span>
              <input className="input" type="number" min={1000} step={1000} value={options.maxExpansions} onChange={(e) => setSettings((s) => ({ ...s, options: { ...s.options, maxExpansions: Math.max(1000, Number(e.target.value) || 1000) } }))} />
            </label>
            <label className="field">
              <span>Alternativas a mostrar</span>
              <input className="input" type="number" min={0} max={6} value={options.maxAlternatives} onChange={(e) => setSettings((s) => ({ ...s, options: { ...s.options, maxAlternatives: Math.max(0, Math.min(6, Number(e.target.value) || 0)) } }))} />
            </label>
            <div className="field">
              <span>Especie preferida para machos cuando el objetivo no tiene machos (p. ej. Chansey)</span>
              <SpeciesPicker
                compact
                value={options.fillerFamilyId}
                onChange={(id) => setSettings((s) => ({ ...s, options: { ...s.options, fillerFamilyId: dex.familyIdOf(id) } }))}
                placeholder={options.fillerFamilyId ? dex.speciesName(options.fillerFamilyId) : 'Automático'}
              />
              {options.fillerFamilyId && (
                <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setSettings((s) => ({ ...s, options: { ...s.options, fillerFamilyId: null } }))}>
                  Volver a automático
                </button>
              )}
            </div>
          </div>
          <div className="card stack">
            <h2>Mecánicas no verificadas</h2>
            <label className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
              <input
                type="checkbox"
                checked={rules.mechanics.eggMovesFromMother}
                onChange={(e) => setSettings((s) => ({ ...s, rules: { ...s.rules, mechanics: { ...s.rules.mechanics, eggMovesFromMother: e.target.checked } } }))}
              />
              <span>
                La madre también transmite movimientos huevo <span className="st st-pend">UNKNOWN · R52</span>
                <div className="small muted">Desactivado por defecto: sólo el padre está verificado. Actívalo sólo si lo has comprobado en el juego.</div>
              </span>
            </label>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Reglas de breeding utilizadas</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Documentadas en <code>docs/POKEMMO_BREEDING_RULES.md</code>. El motor nunca construye una solución basada en una regla UNKNOWN.
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Id</th>
              <th>Regla</th>
              <th>Estado</th>
              <th>Fuentes</th>
              <th>Uso en el motor</th>
            </tr>
          </thead>
          <tbody>
            {RULES.map((r) => (
              <tr key={r.id}>
                <td>
                  <b>{r.id}</b>
                  <div className="small muted">{r.category}</div>
                </td>
                <td>{r.text}</td>
                <td>
                  <span className={`st ${STATUS_CLASS[r.status]}`}>{r.status}</span>
                </td>
                <td className="small">
                  {r.sources.map((s) => (
                    <div key={s}>
                      {SOURCES[s].url ? (
                        <a href={SOURCES[s].url} target="_blank" rel="noreferrer" title={SOURCES[s].title}>
                          {s}
                        </a>
                      ) : (
                        <span title={SOURCES[s].title}>{s}</span>
                      )}
                    </div>
                  ))}
                </td>
                <td className="small">{r.engineUse}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ marginTop: 12 }}>Fuentes</h3>
        <ul className="small">
          {Object.entries(SOURCES).map(([k, s]) => (
            <li key={k}>
              <b>{k}</b>:{' '}
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              ) : (
                s.title
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
