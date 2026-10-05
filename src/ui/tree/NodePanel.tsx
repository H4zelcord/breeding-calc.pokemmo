import { getDex } from '../../data/dex';
import { itemName } from '../../data/items';
import { STATS, STAT_LABELS } from '../../data/models';
import type { BreedingSolution, DesiredPokemon, PlanNode } from '../../engine/types';
import { EggGroups, GenderLabel, Sprite, money } from '../components/common';
import { STATUS_META, ivStatus, ivText } from './status';
import { nodeName } from './TreeView';

const dex = getDex();

/** Panel de información de un nodo (requisito 23). */
export function NodePanel({ n, sol, desired, onSelect }: { n: PlanNode; sol: BreedingSolution; desired: DesiredPokemon; onSelect: (id: string) => void }) {
  const child = n.childId ? sol.nodes[n.childId] : null;
  const link = (id: string | null | undefined) =>
    id && sol.nodes[id] ? (
      <button className="btn sm" onClick={() => onSelect(id)}>
        {nodeName(sol.nodes[id])}
      </button>
    ) : null;
  const c = n.contributes;
  const contributions = [
    ...c.ivs.map((s) => `IV ${STAT_LABELS[s].short}`),
    ...(c.nature ? [`Naturaleza ${n.nature}`] : []),
    ...(c.hiddenAbility ? ['Habilidad Oculta'] : []),
    ...c.eggMoves.map((m) => `Movimiento ${dex.moveName(m)}`),
    ...(c.species ? ['Especie del huevo'] : []),
  ];
  const cost = n.money.pokemon + n.money.items + n.money.breeding;
  return (
    <div className="card panel">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Sprite id={n.speciesId} size="lg" shiny={n.shiny} />
        <div>
          <h2 style={{ marginBottom: 2 }}>
            {dex.speciesName(n.speciesId)} <GenderLabel gender={n.gender} withText />
          </h2>
          <div className="small muted">
            {n.role === 'root' ? 'Pokémon final' : n.source === 'owned' ? (n.mandatory ? 'De tu colección (OBLIGATORIO)' : 'De tu colección') : n.source === 'bred' ? `Criado en el paso ${n.step}` : n.source === 'chain' ? 'Cadena de movimientos huevo' : 'Hay que conseguirlo'}
            {n.hatchSpeciesId && n.hatchSpeciesId !== n.speciesId ? ` · eclosiona como ${dex.speciesName(n.hatchSpeciesId)}` : ''}
          </div>
          <div style={{ marginTop: 4 }}>
            <EggGroups groups={n.eggGroups} />
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: 12 }}>IVs</h3>
      <table className="panel-ivs small">
        <tbody>
          {STATS.map((s) => {
            const st = ivStatus(n, s, desired);
            const src = n.ivSources[s];
            return (
              <tr key={s}>
                <td>
                  <b>{STAT_LABELS[s].short}</b>
                </td>
                <td style={{ textAlign: 'right', minWidth: 40 }}>{ivText(n, s)}</td>
                <td>
                  {st !== 'none' && (
                    <span className={`st ${STATUS_META[st].cls}`} title={STATUS_META[st].label}>
                      {STATUS_META[st].icon} {st === 'ok' ? 'conseguido' : st === 'new' ? 'brace' : st === 'inh' ? 'heredado' : 'pendiente'}
                    </span>
                  )}
                </td>
                <td className="muted">{src ? `← ${src.nodeIds.map((id) => nodeName(sol.nodes[id])).join(' y ')}` : ''}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <dl className="kv" style={{ marginTop: 12 }}>
        <dt>Naturaleza</dt>
        <dd>
          {n.nature ?? 'aleatoria'}
          {n.natureSource && <div className="small muted">Aportada por {nodeName(sol.nodes[n.natureSource])} con {itemName('everstone')}</div>}
        </dd>
        <dt>Habilidad</dt>
        <dd>{n.ability ?? (n.source === 'owned' ? '—' : `cualquiera: se ajusta con ${itemName('ability-pill')}`)}</dd>
        <dt>Hab. Oculta</dt>
        <dd>
          {n.hiddenAbility === 'yes' ? 'Sí' : n.hiddenAbility === 'chance' ? 'Posible (probabilidad desconocida, R44)' : 'No'}
          {n.hiddenAbilitySource && <div className="small muted">Origen: {nodeName(sol.nodes[n.hiddenAbilitySource])}</div>}
        </dd>
        <dt>Movimientos</dt>
        <dd>
          {n.eggMoves.length ? (
            <ul className="clean">
              {n.eggMoves.map((m) => (
                <li key={m}>
                  {dex.moveName(m)}
                  {n.eggMoveSources[m] && (
                    <span className="small muted"> ← {n.eggMoveSources[m] === 'teach' ? 'enseñar (nivel/MT/tutor)' : nodeName(sol.nodes[n.eggMoveSources[m]])}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            '—'
          )}
        </dd>
        <dt>Objeto</dt>
        <dd>
          {n.heldItem ? (
            <>
              <b>{n.heldItem.name}</b>
              <div className="small muted">{n.heldItem.reason}</div>
            </>
          ) : (
            'Ninguno'
          )}
        </dd>
        <dt>Coste</dt>
        <dd>
          {money(cost)}
          {n.money.unknown.length > 0 && <span className="small muted"> + precios desconocidos</span>}
        </dd>
        {n.parentA && (
          <>
            <dt>Padres</dt>
            <dd className="row">
              {link(n.parentA)} {link(n.parentB)}
            </dd>
          </>
        )}
        {child && (
          <>
            <dt>Cría</dt>
            <dd>{link(child.id)}</dd>
          </>
        )}
      </dl>

      {child && (
        <>
          <h3 style={{ marginTop: 12 }}>Aporta al hijo</h3>
          {contributions.length ? (
            <ul className="clean">
              {contributions.map((x) => (
                <li key={x}>
                  <span className="st st-ok">✓</span> {x}
                </li>
              ))}
            </ul>
          ) : (
            <div className="muted small">Nada específico.</div>
          )}
        </>
      )}

      {n.reasons.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>¿Por qué está en el árbol?</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {n.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}
      {n.required.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          Requisito de esta posición: {n.required.join('; ')}
        </p>
      )}
      {n.notes.length > 0 && (
        <>
          <h3 style={{ marginTop: 12 }}>Notas</h3>
          <ul style={{ paddingLeft: 18, margin: 0 }}>
            {n.notes.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
