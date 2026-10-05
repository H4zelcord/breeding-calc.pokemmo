import { useCallback, useEffect, useRef, useState } from 'react';
import { getDex } from '../../data/dex';
import { COST_PROFILES, profileById } from '../../engine/cost';
import { computePlan } from '../engineClient';
import { useApp } from '../store';
import { DesiredEditor } from './DesiredEditor';
import { ResultView } from './ResultView';

const dex = getDex();

export function CalculatorPage() {
  const app = useApp();
  const { desired, setDesired, settings, setSettings, collection, currentPlan, setCurrentPlan } = app;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const mode = settings.options.mode;

  const calculate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const plan = await computePlan({ desired, owned: collection, rules: settings.rules, options: settings.options });
      setCurrentPlan(plan);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [desired, collection, settings, setCurrentPlan]);

  useEffect(() => {
    if (app.pendingCalc && app.loaded) {
      app.clearCalc();
      void calculate();
    }
  }, [app.pendingCalc, app.loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = {
    available: collection.filter((c) => c.status === 'available').length,
    mandatory: collection.filter((c) => c.status === 'mandatory').length,
    forbidden: collection.filter((c) => c.status === 'forbidden').length,
  };

  const savePlan = () => {
    if (!currentPlan) return;
    const name = prompt('Nombre del plan', `${dex.speciesName(currentPlan.target.speciesId)} ${new Date().toLocaleDateString('es-ES')}`);
    if (!name) return;
    app.setPlans((p) => [{ id: `plan-${Date.now()}`, name, savedAt: new Date().toISOString(), plan: currentPlan }, ...p]);
  };

  return (
    <div>
      <div className="page-head">
        <h1>Calculadora de breeding</h1>
        <span className="spacer" />
        <span className="muted small">
          Datos: PokeMMO ({dex.meta.sourceDate}) · {dex.species.size} especies
        </span>
      </div>
      <div className="grid-2">
        <div className="card">
          <h2>Pokémon deseado</h2>
          <DesiredEditor desired={desired} onChange={setDesired} />
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card stack">
            <h2>Estrategia</h2>
            <div className="seg" role="radiogroup" aria-label="Modo">
              <button className={mode === 'scratch' ? 'on' : ''} onClick={() => setSettings((s) => ({ ...s, options: { ...s.options, mode: 'scratch' } }))}>
                🌱 Empezar desde cero
              </button>
              <button className={mode === 'collection' ? 'on' : ''} onClick={() => setSettings((s) => ({ ...s, options: { ...s.options, mode: 'collection' } }))}>
                📦 Usar mis Pokémon
              </button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {mode === 'scratch'
                ? 'El motor busca todos los progenitores necesarios ignorando tu colección.'
                : `Se usarán tus Pokémon cuando mejoren la solución: ${counts.available} disponibles, ${counts.mandatory} obligatorios, ${counts.forbidden} prohibidos.`}
            </p>
            <label className="field">
              <span>Prioridad de la optimización</span>
              <select
                className="input"
                value={settings.profileId}
                onChange={(e) => setSettings((s) => ({ ...s, profileId: e.target.value, options: { ...s.options, weights: { ...profileById(e.target.value).weights } } }))}
              >
                {COST_PROFILES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                {!COST_PROFILES.some((p) => p.id === settings.profileId) && <option value={settings.profileId}>Personalizado</option>}
              </select>
              <span className="small muted">{COST_PROFILES.find((p) => p.id === settings.profileId)?.description ?? 'Pesos personalizados (Configuración).'}</span>
            </label>
            <label className="row small" style={{ gap: 6 }}>
              <input
                type="checkbox"
                checked={settings.options.allowDitto}
                onChange={(e) => setSettings((s) => ({ ...s, options: { ...s.options, allowDitto: e.target.checked } }))}
              />
              Permitir conseguir Dittos
            </label>
            <button className="btn primary big" onClick={calculate} disabled={busy || !app.loaded}>
              {busy ? <span className="spinner" /> : '⚙'} {busy ? 'Calculando…' : 'CALCULAR BREEDING'}
            </button>
            {error && <div className="msg error">{error}</div>}
          </div>
          <div className="card small">
            <h3>Cómo funciona</h3>
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              <li>Elige el Pokémon y indica en cada característica si es obligatoria (sí/no).</li>
              <li>Añade tus Pokémon en <b>Mis Pokémon</b> y márcalos como disponibles, obligatorios o prohibidos.</li>
              <li>Pulsa <b>Calcular</b>: el motor busca el árbol de menor coste con las reglas verificadas de PokeMMO.</li>
              <li>Haz clic en cualquier Pokémon del árbol para ver qué aporta y por qué está ahí.</li>
            </ol>
          </div>
        </div>
      </div>
      <div ref={resultRef} style={{ marginTop: 20 }}>
        {currentPlan ? (
          <ResultView plan={currentPlan} collection={collection} onSave={savePlan} />
        ) : (
          <div className="card empty">Configura el Pokémon deseado y pulsa “Calcular breeding”.</div>
        )}
      </div>
    </div>
  );
}
