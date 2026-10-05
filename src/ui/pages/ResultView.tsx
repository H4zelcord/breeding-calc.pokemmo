import { useEffect, useState } from 'react';
import { getDex } from '../../data/dex';
import type { BreedingPlan, BreedingSolution, OwnedPokemon } from '../../engine/types';
import { exportPlan } from '../../persistence/storage';
import { Messages, downloadJson, money } from '../components/common';
import { NodePanel } from '../tree/NodePanel';
import { TreeView } from '../tree/TreeView';

const dex = getDex();

export function ResultView({ plan, collection, onSave }: { plan: BreedingPlan; collection: OwnedPokemon[]; onSave?: () => void }) {
  const all: BreedingSolution[] = plan.best ? [plan.best, ...plan.alternatives] : [];
  const [solId, setSolId] = useState(all[0]?.id ?? '');
  const [tab, setTab] = useState<'tree' | 'explain' | 'list'>('tree');
  const sol = all.find((s) => s.id === solId) ?? all[0];
  const [selected, setSelected] = useState<string | null>(sol?.rootId ?? null);

  useEffect(() => {
    setSolId(all[0]?.id ?? '');
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSelected(sol?.rootId ?? null);
  }, [sol?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ownedName = (id: string) => {
    const m = collection.find((x) => x.id === id);
    return m ? `${dex.speciesName(m.speciesId)}${m.notes ? ` (${m.notes})` : ''}` : id;
  };

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Messages errors={plan.errors} warnings={[...plan.warnings, ...(sol?.warnings ?? [])]} info={plan.info} />
      {sol && (
        <>
          <div className="card">
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Soluciones</h2>
              <div className="row">
                {onSave && (
                  <button className="btn" onClick={onSave}>
                    💾 Guardar plan
                  </button>
                )}
                <button className="btn" onClick={() => downloadJson(`plan-${dex.speciesName(plan.target.speciesId)}.json`, exportPlan(plan))}>
                  ⬇ Exportar plan
                </button>
              </div>
            </div>
            <div className="sol-tabs" role="tablist">
              {all.map((s, i) => (
                <button key={s.id} role="tab" aria-selected={s.id === sol.id} className={`sol-card ${s.id === sol.id ? 'on' : ''}`} onClick={() => setSolId(s.id)}>
                  <div className="title">{i === 0 ? '⭐ ' : ''}{s.label}</div>
                  <div className="small">
                    {s.stats.crosses} cruces · {s.stats.pokemonUsed} Pokémon
                  </div>
                  <div className="small muted">
                    {s.cost.exact ? 'Coste' : 'Coste estimado'}: {money(s.cost.total)}
                    {s.cost.unknownPrices.length ? '+?' : ''}
                  </div>
                  {s.droppedFeatures.length > 0 && <div className="small" style={{ color: 'var(--warn)' }}>Sin: {s.droppedFeatures.join(', ')}</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="stats-row">
              <Stat v={sol.stats.crosses} l="Cruces" />
              <Stat v={sol.stats.pokemonUsed} l="Pokémon necesarios" />
              <Stat v={sol.stats.ownedUsed} l="De tu colección" />
              <Stat v={sol.stats.acquired} l="A conseguir" />
              <Stat v={sol.stats.generations} l="Generaciones" />
              <Stat v={duration(sol.stats.hatchMinutes)} l="Tiempo de eclosión (R67)" />
              <Stat v={money(sol.cost.total) + (sol.cost.unknownPrices.length ? ' + ?' : '')} l={sol.cost.exact ? 'Coste exacto' : 'Estimación'} />
            </div>
            <details style={{ marginTop: 10 }}>
              <summary className="small">Desglose de costes, objetos y Pokémon de la colección</summary>
              <div className="grid-2" style={{ marginTop: 8, gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <table className="data">
                    <tbody>
                      <tr><td>Coste de Pokémon</td><td>{money(sol.cost.pokemon)}</td></tr>
                      <tr><td>Coste de objetos</td><td>{money(sol.cost.items)}</td></tr>
                      <tr><td>Coste de crianza (género)</td><td>{money(sol.cost.breeding)}</td></tr>
                      <tr><td><b>Total</b></td><td><b>{money(sol.cost.total)}</b> {sol.cost.exact ? '(exacto)' : '(estimación)'}</td></tr>
                    </tbody>
                  </table>
                  {sol.cost.estimatedPrices.length > 0 && <p className="small muted">Precios estimados: {sol.cost.estimatedPrices.join(', ')}.</p>}
                  {sol.cost.unknownPrices.length > 0 && <p className="small muted">Precios desconocidos (no sumados): {sol.cost.unknownPrices.join(', ')}. Introdúcelos en Configuración.</p>}
                  {!sol.optimal && <p className="small muted">La búsqueda alcanzó su presupuesto: la solución es válida pero puede no ser la óptima.</p>}
                </div>
                <div>
                  <b className="small">Objetos</b>
                  <ul className="clean small">
                    {sol.items.map((i) => (
                      <li key={i.itemId}>
                        {i.count} × {i.name}
                      </li>
                    ))}
                  </ul>
                  {sol.requiredPokemon.length > 0 && (
                    <>
                      <b className="small">Obligatorios usados</b>
                      <ul className="clean small">{sol.requiredPokemon.map((id) => <li key={id}>{ownedName(id)}</li>)}</ul>
                    </>
                  )}
                  {sol.optionalPokemon.length > 0 && (
                    <>
                      <b className="small">Disponibles usados</b>
                      <ul className="clean small">{sol.optionalPokemon.map((id, i) => <li key={id + i}>{ownedName(id)}</li>)}</ul>
                    </>
                  )}
                </div>
              </div>
            </details>
          </div>

          <div className="tabs" role="tablist">
            <button className={tab === 'tree' ? 'on' : ''} onClick={() => setTab('tree')}>
              Árbol de breeding
            </button>
            <button className={tab === 'explain' ? 'on' : ''} onClick={() => setTab('explain')}>
              Explicar solución
            </button>
            <button className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>
              Lista de Pokémon
            </button>
          </div>

          {tab === 'tree' && (
            <div className="result-layout">
              <TreeView sol={sol} desired={plan.target} selected={selected} onSelect={setSelected} />
              {selected && sol.nodes[selected] && <NodePanel n={sol.nodes[selected]} sol={sol} desired={plan.target} onSelect={setSelected} />}
            </div>
          )}
          {tab === 'explain' && (
            <div className="card">
              {sol.steps.map((st) => (
                <div key={st.index + st.title} className={`step ${st.kind === 'final' ? 'post' : st.kind}`}>
                  <h4>{st.kind === 'prepare' ? '📋 ' : st.kind === 'post' ? '✨ ' : st.kind === 'final' ? '🏁 ' : '🥚 '}{st.title}</h4>
                  <pre>{st.lines.join('\n')}</pre>
                </div>
              ))}
            </div>
          )}
          {tab === 'list' && <LeafList sol={sol} />}
        </>
      )}
    </div>
  );
}

function duration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function Stat({ v, l }: { v: string | number; l: string }) {
  return (
    <div className="stat-box">
      <div className="v">{v}</div>
      <div className="l">{l}</div>
    </div>
  );
}

function LeafList({ sol }: { sol: BreedingSolution }) {
  const leaves = Object.values(sol.nodes).filter((n) => !n.parentA);
  return (
    <div className="card">
      <table className="data">
        <thead>
          <tr>
            <th>Pokémon</th>
            <th>Origen</th>
            <th>Requisito</th>
            <th>Objeto</th>
            <th>Para qué</th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((n) => (
            <tr key={n.id}>
              <td>
                {dex.speciesName(n.speciesId)} {n.gender === 'male' ? '♂' : n.gender === 'female' ? '♀' : ''}
              </td>
              <td>{n.source === 'owned' ? (n.mandatory ? 'Colección (OBLIGATORIO)' : 'Colección') : n.source === 'chain' ? 'Cadena de movimientos' : 'Conseguir'}</td>
              <td>{n.required.join('; ') || '—'}</td>
              <td>{n.heldItem?.name ?? '—'}</td>
              <td className="small">{n.reasons.join(' ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
