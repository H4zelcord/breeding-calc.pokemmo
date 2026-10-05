import { useMemo, useState } from 'react';
import { getDex } from '../../data/dex';
import { BREEDING_ITEMS, itemName } from '../../data/items';
import { EGG_GROUP_LABELS, STATS, STAT_LABELS, type EggGroup } from '../../data/models';
import { emptyDesired } from '../../engine/defaults';
import { importPlan } from '../../persistence/storage';
import { EggGroups, Sprite, TypeBadges, downloadJson, genderRatioText, pickJsonFile } from '../components/common';
import { SpeciesPicker } from '../components/SpeciesPicker';
import { useApp } from '../store';
import { exportPlan } from '../../persistence/storage';
import { ResultView } from './ResultView';

const dex = getDex();

// ------------------------------------------------------------------ Base de datos

export function DatabasePage() {
  const { setDesired, setPage } = useApp();
  const [id, setId] = useState(445);
  const [group, setGroup] = useState<string>('');
  const sp = dex.getSpecies(id);
  const fam = dex.familyOf(id);
  const eggSp = dex.eggSpeciesForTarget(id);
  const compatible = useMemo(() => {
    if (!fam.canBreed || dex.isDittoFamily(fam.id)) return [];
    if (dex.isGenderlessFamily(fam.id)) return [];
    return dex.breedingFamilies().filter((f) => f.id !== fam.id && !dex.isGenderlessFamily(f.id) && dex.shareEggGroup(f.id, fam.id));
  }, [fam]);
  const byGroup = useMemo(() => (group ? dex.allSpecies().filter((s) => s.eggGroups.includes(group as EggGroup)) : []), [group]);

  return (
    <div>
      <div className="page-head">
        <h1>Base de datos</h1>
      </div>
      <div className="grid-2">
        <div className="card stack">
          <SpeciesPicker value={id} onChange={setId} />
          <dl className="kv">
            <dt>Tipos</dt>
            <dd>
              <TypeBadges types={sp.types} />
            </dd>
            <dt>Géneros</dt>
            <dd>{genderRatioText(sp.genderRatio)}</dd>
            <dt>Grupo huevo</dt>
            <dd>
              <EggGroups groups={sp.eggGroups} />
            </dd>
            <dt>Habilidades</dt>
            <dd>{[sp.abilities.primary, sp.abilities.secondary].filter(Boolean).join(' / ')}</dd>
            <dt>Hab. Oculta</dt>
            <dd>{sp.abilities.hidden ?? '—'}</dd>
            <dt>Evolución</dt>
            <dd>{fam.members.map((m) => dex.speciesName(m)).join(' → ')}</dd>
            <dt>Huevo</dt>
            <dd>
              {fam.canBreed ? dex.speciesName(eggSp) : 'No se puede criar'}
              {dex.isBaby(id) && <div className="small muted">Bebé: no puede criar; se obtiene criando a su evolución{fam.incense ? ` con ${itemName(fam.incense.itemId)}` : ''}.</div>}
            </dd>
            <dt>Obtenible</dt>
            <dd>{sp.obtainable ? 'Sí' : 'No (según S1)'}</dd>
            <dt>Stats base</dt>
            <dd className="small">{STATS.map((s) => `${STAT_LABELS[s].short} ${sp.baseStats[s]}`).join(' · ')}</dd>
          </dl>
          <button
            className="btn primary"
            disabled={!fam.canBreed}
            onClick={() => {
              setDesired((d) => ({ ...emptyDesired(id), ivs: d.ivs, nature: d.nature }));
              setPage('calculator');
            }}
          >
            Usar como Pokémon deseado
          </button>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <h2>Movimientos huevo de {dex.speciesName(eggSp)}</h2>
            {dex.desiredEggMoveOptions(id).length === 0 ? (
              <div className="muted">Ninguno.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Movimiento</th>
                    <th>Tipo</th>
                    <th>Lo aprenden sin crianza (grupo compatible)</th>
                  </tr>
                </thead>
                <tbody>
                  {dex.desiredEggMoveOptions(id).map((m) => {
                    const mv = dex.moves.get(m);
                    const learners = compatible.filter((f) => dex.naturalMoves(f.id).has(m) && dex.canBeMale(f.id));
                    return (
                      <tr key={m}>
                        <td>{dex.moveName(m)}</td>
                        <td>{mv && <TypeBadges types={[mv.type]} />}</td>
                        <td className="small">
                          {m === 344 ? `${itemName('light-ball')} en Pikachu (R55)` : learners.length ? learners.slice(0, 8).map((f) => dex.speciesName(f.firstBreedable ?? f.id)).join(', ') + (learners.length > 8 ? '…' : '') : <span className="muted">Sólo por cadena</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div className="card">
            <h2>Especies compatibles ({compatible.length})</h2>
            <div className="small muted" style={{ marginBottom: 6 }}>
              {dex.isGenderlessFamily(fam.id) ? 'Sin género: sólo cría con su propia línea o con Ditto (R05).' : 'Comparten algún grupo huevo (además, Ditto).'}
            </div>
            <div className="row" style={{ gap: 4 }}>
              {compatible.slice(0, 120).map((f) => (
                <button key={f.id} className="btn sm" onClick={() => setId(f.firstBreedable ?? f.id)} title={dex.speciesName(f.firstBreedable ?? f.id)}>
                  {dex.speciesName(f.firstBreedable ?? f.id)}
                </button>
              ))}
            </div>
          </div>
          <div className="card">
            <h2>Explorar grupo huevo</h2>
            <select className="input" value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">Elige un grupo…</option>
              {Object.entries(EGG_GROUP_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <div className="row" style={{ gap: 4, marginTop: 8 }}>
              {byGroup.map((s) => (
                <button key={s.id} className="btn sm" onClick={() => setId(s.id)}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Objetos

export function ItemsPage() {
  return (
    <div>
      <div className="page-head">
        <h1>Objetos de breeding</h1>
      </div>
      <div className="card">
        <p className="small muted" style={{ marginTop: 0 }}>
          Efectos tomados del texto in-game del cliente de PokeMMO (S1). Un Pokémon sólo puede llevar un objeto (R68).
        </p>
        <table className="data">
          <thead>
            <tr>
              <th>Objeto</th>
              <th>Efecto</th>
              <th>Característica</th>
              <th>Restricciones</th>
              <th>Compatibilidad</th>
              <th>Reglas</th>
            </tr>
          </thead>
          <tbody>
            {BREEDING_ITEMS.map((i) => (
              <tr key={i.id}>
                <td>
                  <b>{i.nameEs ?? i.name}</b>
                  {i.nameEs && <div className="small">{i.name}</div>}
                  {i.aliases.length > 0 && <div className="small muted">También: {i.aliases.join(', ')}</div>}
                  <div className="small muted">{i.consumed ? 'Se consume' : 'No se consume'}</div>
                </td>
                <td>
                  {i.effect}
                  <div className="small muted" style={{ fontStyle: 'italic' }}>
                    “{i.gameText}”
                  </div>
                </td>
                <td>{i.affects}</td>
                <td className="small">
                  <ul style={{ paddingLeft: 16, margin: 0 }}>
                    {i.restrictions.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </td>
                <td className="small">{i.compatibility}</td>
                <td className="small">{i.ruleIds.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Movimientos

export function MovesPage() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<number | null>(null);
  const moves = useMemo(() => {
    const ql = q.toLowerCase();
    return [...dex.moves.values()].filter((m) => m.name.toLowerCase().includes(ql)).sort((a, b) => a.name.localeCompare(b.name));
  }, [q]);
  const eggUsers = useMemo(() => (sel === null ? [] : dex.allSpecies().filter((s) => s.eggMoves.includes(sel) || s.specialEggMoves.includes(sel))), [sel]);
  const natural = useMemo(() => (sel === null ? [] : dex.breedingFamilies().filter((f) => dex.naturalMoves(f.id).has(sel))), [sel]);
  return (
    <div>
      <div className="page-head">
        <h1>Movimientos</h1>
        <span className="spacer" />
        <input className="input" placeholder="Buscar movimiento…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="card" style={{ maxHeight: 640, overflow: 'auto' }}>
          <table className="data">
            <thead>
              <tr>
                <th>Movimiento</th>
                <th>Tipo</th>
                <th>Cat.</th>
                <th>Pot.</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id} className="click" onClick={() => setSel(m.id)} style={sel === m.id ? { background: 'var(--accent-2)' } : undefined}>
                  <td>{m.name}</td>
                  <td>
                    <TypeBadges types={[m.type]} />
                  </td>
                  <td className="small">{m.category}</td>
                  <td>{m.power || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card">
          {sel === null ? (
            <div className="muted">Selecciona un movimiento para ver quién lo tiene como movimiento huevo y quién lo aprende sin crianza.</div>
          ) : (
            <>
              <h2>{dex.moveName(sel)}</h2>
              <h3>Movimiento huevo de ({eggUsers.length})</h3>
              <div className="row" style={{ gap: 6 }}>
                {eggUsers.map((s) => (
                  <span key={s.id} className="badge">
                    <Sprite id={s.id} /> {s.name}
                  </span>
                ))}
                {eggUsers.length === 0 && <span className="muted">Ninguna especie.</span>}
              </div>
              <h3 style={{ marginTop: 12 }}>Lo aprenden sin crianza (posibles inicios de cadena, R50/R53)</h3>
              <div className="small">{natural.map((f) => `${dex.speciesName(f.firstBreedable ?? f.id)} (${f.eggGroups.filter((g) => g !== 'cannot breed').map((g) => EGG_GROUP_LABELS[g]).join('/')})`).join(', ') || '—'}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Planes guardados

export function SavedPlansPage() {
  const { plans, setPlans, collection } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const cur = plans.find((p) => p.id === open);
  const doImport = async () => {
    const text = await pickJsonFile();
    if (!text) return;
    try {
      const plan = importPlan(text);
      const id = `plan-${Date.now()}`;
      setPlans((p) => [{ id, name: `Importado: ${dex.speciesName(plan.target.speciesId)}`, savedAt: new Date().toISOString(), plan }, ...p]);
      setOpen(id);
      setMsg('Plan importado.');
    } catch (e) {
      setMsg(`Error al importar: ${e instanceof Error ? e.message : e}`);
    }
  };
  return (
    <div>
      <div className="page-head">
        <h1>Planes guardados</h1>
        <span className="spacer" />
        <button className="btn" onClick={doImport}>
          ⬆ Importar plan
        </button>
      </div>
      {msg && <div className="msg info" style={{ marginBottom: 12 }}>{msg}</div>}
      {plans.length === 0 ? (
        <div className="card empty">No hay planes guardados. Calcula uno y pulsa “Guardar plan”.</div>
      ) : (
        <div className="card">
          <table className="data">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Objetivo</th>
                <th>Cruces</th>
                <th>Guardado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <b>{p.name}</b>
                  </td>
                  <td>{dex.speciesName(p.plan.target.speciesId)}</td>
                  <td>{p.plan.best?.stats.crosses ?? '—'}</td>
                  <td className="small">{new Date(p.savedAt).toLocaleString('es-ES')}</td>
                  <td>
                    <div className="row">
                      <button className="btn sm" onClick={() => setOpen(open === p.id ? null : p.id)}>
                        {open === p.id ? 'Cerrar' : 'Ver'}
                      </button>
                      <button className="btn sm" onClick={() => downloadJson(`${p.name}.json`, exportPlan(p.plan))}>
                        Exportar
                      </button>
                      <button className="btn sm danger" onClick={() => confirm(`¿Eliminar “${p.name}”?`) && setPlans((x) => x.filter((y) => y.id !== p.id))}>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cur && (
        <div style={{ marginTop: 16 }}>
          <ResultView plan={cur.plan} collection={collection} />
        </div>
      )}
    </div>
  );
}
