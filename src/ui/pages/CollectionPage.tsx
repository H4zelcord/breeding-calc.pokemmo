import { useMemo, useState } from 'react';
import { getDex } from '../../data/dex';
import { BREEDING_ITEMS, itemLabel, itemName } from '../../data/items';
import { STATS, STAT_LABELS, type Gender } from '../../data/models';
import { NATURES } from '../../data/natures';
import { newOwned } from '../../engine/defaults';
import type { CollectionStatus, OwnedPokemon } from '../../engine/types';
import { validateOwned } from '../../engine/validation';
import { exportCollection, importCollection } from '../../persistence/storage';
import { EggGroups, GenderLabel, Modal, Sprite, downloadJson, pickJsonFile, resolveSpecies } from '../components/common';
import { SpeciesPicker } from '../components/SpeciesPicker';
import { useApp } from '../store';
import { natureLabel } from './DesiredEditor';

const dex = getDex();

function blankOwned(): OwnedPokemon {
  return newOwned({ speciesId: 443, gender: 'male', ability: dex.getSpecies(443).abilities.primary });
}

const STATUS_LABEL: Record<CollectionStatus, string> = { available: 'Disponible', mandatory: 'OBLIGATORIO', forbidden: 'PROHIBIDO' };

export function StatusSelector({ value, onChange }: { value: CollectionStatus; onChange: (s: CollectionStatus) => void }) {
  return (
    <span className="seg status-seg" role="radiogroup" aria-label="Estado">
      {(['available', 'mandatory', 'forbidden'] as const).map((s) => (
        <button key={s} type="button" className={`${value === s ? 'on' : ''} ${s}`} onClick={() => onChange(s)} aria-checked={value === s} role="radio">
          {STATUS_LABEL[s]}
        </button>
      ))}
    </span>
  );
}

export function CollectionPage() {
  const { collection, setCollection, requestCalc } = useApp();
  const [editing, setEditing] = useState<OwnedPokemon | null>(null);
  const [filter, setFilter] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return collection.filter((m) => !q || dex.speciesName(m.speciesId).toLowerCase().includes(q) || m.notes.toLowerCase().includes(q) || m.nature.toLowerCase().includes(q));
  }, [collection, filter]);

  const save = (m: OwnedPokemon) => {
    setCollection((c) => (c.some((x) => x.id === m.id) ? c.map((x) => (x.id === m.id ? m : x)) : [...c, m]));
    setEditing(null);
  };

  const doImport = async () => {
    const text = await pickJsonFile();
    if (!text) return;
    try {
      const { pokemon, skipped } = importCollection(text, resolveSpecies);
      const existing = new Set(collection.map((c) => c.id));
      const fresh = pokemon.map((p) => (existing.has(p.id) ? { ...p, id: `${p.id}-${Math.random().toString(36).slice(2, 6)}` } : p));
      setCollection((c) => [...c, ...fresh]);
      setMsg(`Importados ${fresh.length} Pokémon${skipped ? `, ${skipped} ignorados (especie no reconocida)` : ''}.`);
    } catch (e) {
      setMsg(`Error al importar: ${e instanceof Error ? e.message : e}`);
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Mis Pokémon</h1>
        <span className="badge">{collection.length}</span>
        <span className="spacer" />
        <input className="input" placeholder="Filtrar…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrar colección" />
        <button className="btn" onClick={doImport}>
          ⬆ Importar colección
        </button>
        <button className="btn" onClick={() => downloadJson('coleccion-pokemmo.json', exportCollection(collection))} disabled={!collection.length}>
          ⬇ Exportar colección
        </button>
        <button className="btn primary" onClick={() => setEditing(blankOwned())}>
          ＋ Añadir Pokémon
        </button>
      </div>
      {msg && (
        <div className="msg info" style={{ marginBottom: 12 }}>
          {msg}
        </div>
      )}
      <p className="muted small" style={{ marginTop: -6 }}>
        <b>Disponible</b>: el motor puede usarlo si mejora la solución. <b>OBLIGATORIO</b>: debe formar parte de la solución (si es imposible se explica el motivo). <b>PROHIBIDO</b>: nunca se usa. Cada Pokémon usado se pierde al criar (R01).
      </p>
      {collection.length === 0 ? (
        <div className="card empty">
          Aún no has añadido Pokémon. Añádelos para que el motor los aproveche.
          <div style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={() => setEditing(blankOwned())}>
              ＋ Añadir el primero
            </button>
          </div>
        </div>
      ) : (
        <div className="owned-grid">
          {shown.map((m) => (
            <OwnedCard
              key={m.id}
              m={m}
              onStatus={(s) => setCollection((c) => c.map((x) => (x.id === m.id ? { ...x, status: s } : x)))}
              onEdit={() => setEditing(m)}
              onDuplicate={() => setCollection((c) => [...c, { ...m, id: newOwned({ speciesId: m.speciesId }).id }])}
              onDelete={() => confirm(`¿Eliminar ${dex.speciesName(m.speciesId)} de la colección?`) && setCollection((c) => c.filter((x) => x.id !== m.id))}
            />
          ))}
        </div>
      )}
      {collection.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" onClick={requestCalc}>
            ⚙ Recalcular breeding con estos Pokémon
          </button>
        </div>
      )}
      {editing && <OwnedEditor initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
    </div>
  );
}

function OwnedCard({ m, onStatus, onEdit, onDuplicate, onDelete }: { m: OwnedPokemon; onStatus: (s: CollectionStatus) => void; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const problems = validateOwned(dex, m);
  return (
    <div className={`owned-card ${m.status}`}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Sprite id={m.speciesId} shiny={m.shiny} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row" style={{ gap: 6 }}>
            <b>{dex.speciesName(m.speciesId)}</b>
            <GenderLabel gender={m.gender} />
            {m.quantity > 1 && <span className="badge">×{m.quantity}</span>}
            {m.shiny && <span className="badge">✨ shiny</span>}
            {m.alpha && <span className="badge">alfa</span>}
          </div>
          <div className="small muted">
            {m.nature} · {m.ability ?? '—'}
            {m.hiddenAbility ? ' (HA)' : ''}
          </div>
        </div>
      </div>
      <div className="mini-ivs">
        {STATS.map((s) => (
          <div key={s} className={`iv-cell ${m.ivs[s] === 31 ? 'st-ok' : ''}`} title={`${STAT_LABELS[s].name}: ${m.ivs[s]}`}>
            {STAT_LABELS[s].short}
            <b>{m.ivs[s]}</b>
          </div>
        ))}
      </div>
      {m.moves.length > 0 && <div className="small">Movimientos: {m.moves.map((x) => dex.moveName(x)).join(', ')}</div>}
      {m.heldItem && <div className="small">Objeto: {itemName(m.heldItem)}</div>}
      {m.notes && <div className="small muted">📝 {m.notes}</div>}
      {problems.length > 0 && <div className="small" style={{ color: 'var(--danger)' }}>⚠ {problems.join(' ')}</div>}
      <div className="row" style={{ marginTop: 8, justifyContent: 'space-between' }}>
        <StatusSelector value={m.status} onChange={onStatus} />
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <button className="btn sm" onClick={onEdit}>
          Editar
        </button>
        <button className="btn sm" onClick={onDuplicate}>
          Duplicar
        </button>
        <button className="btn sm danger" onClick={onDelete}>
          Eliminar
        </button>
      </div>
    </div>
  );
}

function OwnedEditor({ initial, onSave, onCancel }: { initial: OwnedPokemon; onSave: (m: OwnedPokemon) => void; onCancel: () => void }) {
  const [m, setM] = useState<OwnedPokemon>(initial);
  const isNew = !useApp().collection.some((x) => x.id === initial.id);
  const sp = dex.getSpecies(m.speciesId);
  const fam = dex.familyOf(m.speciesId);
  const [moveQuery, setMoveQuery] = useState('');
  const set = (patch: Partial<OwnedPokemon>) => setM((x) => ({ ...x, ...patch }));
  const genders: Gender[] = fam.genderKind === 'genderless' || dex.isDittoFamily(fam.id) ? ['genderless'] : sp.genderRatio === 0 ? ['male'] : sp.genderRatio === 254 ? ['female'] : ['male', 'female'];
  const learnable = useMemo(() => {
    const ids = new Set<number>([...dex.naturalMoves(fam.id), ...dex.eggMovesOf(dex.eggSpecies(fam.id)), ...fam.members.flatMap((x) => dex.getSpecies(x).eggMoves)]);
    return [...ids].sort((a, b) => dex.moveName(a).localeCompare(dex.moveName(b)));
  }, [fam]);
  const moveResults = learnable.filter((x) => !m.moves.includes(x) && dex.moveName(x).toLowerCase().includes(moveQuery.toLowerCase())).slice(0, 8);
  const problems = validateOwned(dex, m);

  return (
    <Modal onClose={onCancel}>
      <h2>{isNew ? 'Añadir Pokémon' : 'Editar Pokémon'}</h2>
      <div className="stack">
        <SpeciesPicker
          value={m.speciesId}
          onChange={(id) => {
            const s = dex.getSpecies(id);
            const f = dex.familyOf(id);
            const g: Gender = f.genderKind === 'genderless' || dex.isDittoFamily(f.id) ? 'genderless' : s.genderRatio === 254 ? 'female' : s.genderRatio === 0 ? 'male' : m.gender === 'genderless' ? 'male' : m.gender;
            set({ speciesId: id, gender: g, ability: s.abilities.primary, hiddenAbility: false, moves: [] });
          }}
        />
        <div className="row">
          <label className="field">
            <span>Género</span>
            <select className="input" value={m.gender} onChange={(e) => set({ gender: e.target.value as Gender })}>
              {genders.map((g) => (
                <option key={g} value={g}>
                  {g === 'male' ? '♂ Macho' : g === 'female' ? '♀ Hembra' : 'Sin género'}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Naturaleza</span>
            <select className="input" value={m.nature} onChange={(e) => set({ nature: e.target.value })}>
              {NATURES.map((n) => (
                <option key={n.name} value={n.name}>
                  {natureLabel(n.name)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Habilidad</span>
            <select
              className="input"
              value={m.ability ?? ''}
              onChange={(e) => set({ ability: e.target.value || null, hiddenAbility: !!e.target.value && e.target.value === sp.abilities.hidden && ![sp.abilities.primary, sp.abilities.secondary].includes(e.target.value) })}
            >
              <option value="">—</option>
              {[sp.abilities.primary, sp.abilities.secondary].filter(Boolean).map((a) => (
                <option key={a} value={a!}>
                  {a}
                </option>
              ))}
              {sp.abilities.hidden && <option value={sp.abilities.hidden}>{sp.abilities.hidden} (oculta)</option>}
            </select>
          </label>
          <label className="field">
            <span>Cantidad</span>
            <input className="input num" type="number" min={1} value={m.quantity} onChange={(e) => set({ quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
          </label>
        </div>
        <div>
          <div className="small muted" style={{ marginBottom: 4 }}>
            IVs
          </div>
          <div className="row">
            {STATS.map((s) => (
              <label key={s} className="field" style={{ alignItems: 'center' }}>
                <span>{STAT_LABELS[s].short}</span>
                <input
                  className="input num"
                  type="number"
                  min={0}
                  max={31}
                  value={m.ivs[s]}
                  onChange={(e) => set({ ivs: { ...m.ivs, [s]: Math.max(0, Math.min(31, Math.round(Number(e.target.value) || 0))) } })}
                />
              </label>
            ))}
            <button type="button" className="btn sm" onClick={() => set({ ivs: Object.fromEntries(STATS.map((s) => [s, 31])) as OwnedPokemon['ivs'] })}>
              6x31
            </button>
          </div>
        </div>
        <div className="row">
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={m.hiddenAbility} disabled={!sp.abilities.hidden} onChange={(e) => set({ hiddenAbility: e.target.checked, ability: e.target.checked ? sp.abilities.hidden : sp.abilities.primary })} />
            Habilidad Oculta
          </label>
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={m.shiny} onChange={(e) => set({ shiny: e.target.checked })} />
            Shiny
          </label>
          <label className="row small" style={{ gap: 6 }}>
            <input type="checkbox" checked={m.alpha} onChange={(e) => set({ alpha: e.target.checked })} />
            Alfa
          </label>
        </div>
        <div>
          <div className="small muted">Movimientos (máx. 4)</div>
          <div className="row" style={{ margin: '4px 0' }}>
            {m.moves.map((x) => (
              <span key={x} className="badge">
                {dex.moveName(x)}{' '}
                <button className="btn sm" style={{ padding: '0 4px', border: 'none' }} onClick={() => set({ moves: m.moves.filter((y) => y !== x) })} aria-label={`Quitar ${dex.moveName(x)}`}>
                  ✕
                </button>
              </span>
            ))}
          </div>
          {m.moves.length < 4 && (
            <div className="picker">
              <input className="input" style={{ width: '100%' }} placeholder="Añadir movimiento que conoce…" value={moveQuery} onChange={(e) => setMoveQuery(e.target.value)} />
              {moveQuery && (
                <div className="picker-list">
                  {moveResults.map((x) => (
                    <div
                      key={x}
                      className="picker-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        set({ moves: [...m.moves, x] });
                        setMoveQuery('');
                      }}
                    >
                      {dex.moveName(x)}
                      {dex.eggMovesOf(dex.eggSpecies(fam.id)).includes(x) && <span className="badge">huevo</span>}
                    </div>
                  ))}
                  {moveResults.length === 0 && <div className="picker-item muted">Sin resultados</div>}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="row">
          <label className="field">
            <span>Objeto que lleva</span>
            <select className="input" value={m.heldItem ?? ''} onChange={(e) => set({ heldItem: e.target.value || null })}>
              <option value="">Ninguno</option>
              {BREEDING_ITEMS.filter((i) => i.heldWhileBreeding).map((i) => (
                <option key={i.id} value={i.id}>
                  {itemLabel(i)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Valor (opcional)</span>
            <input className="input" type="number" min={0} style={{ width: 120 }} value={m.value ?? ''} onChange={(e) => set({ value: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} />
          </label>
        </div>
        <label className="field">
          <span>Notas</span>
          <textarea className="input" rows={2} value={m.notes} onChange={(e) => set({ notes: e.target.value })} />
        </label>
        <div className="row">
          <span className="small muted">Estado:</span>
          <StatusSelector value={m.status} onChange={(s) => set({ status: s })} />
        </div>
        <div className="small muted">
          Grupos huevo: <EggGroups groups={fam.canBreed ? fam.eggGroups : ['cannot breed']} />
        </div>
        {problems.length > 0 && <div className="msg error">{problems.join(' ')}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn primary" onClick={() => onSave(m)} disabled={problems.length > 0}>
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
