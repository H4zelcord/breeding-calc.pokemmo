import { getDex } from '../../data/dex';
import { itemName } from '../../data/items';
import { STATS, STAT_LABELS, type StatKey } from '../../data/models';
import { NATURES } from '../../data/natures';
import { emptyDesired } from '../../engine/defaults';
import type { DesiredPokemon, Priority } from '../../engine/types';
import { PriorityToggle, TypeBadges } from '../components/common';
import { SpeciesPicker } from '../components/SpeciesPicker';

const dex = getDex();

const PRESETS: { label: string; stats: StatKey[] }[] = [
  { label: '6x31', stats: [...STATS] },
  { label: '5x31 sin SPA', stats: ['hp', 'attack', 'defense', 'specialDefense', 'speed'] },
  { label: '5x31 sin ATK', stats: ['hp', 'defense', 'specialAttack', 'specialDefense', 'speed'] },
  { label: '4x31', stats: ['hp', 'attack', 'defense', 'speed'] },
];

export function natureLabel(name: string): string {
  const n = NATURES.find((x) => x.name === name);
  if (!n) return name;
  if (!n.plus) return `${n.name} (neutra)`;
  return `${n.name} (+${STAT_LABELS[n.plus].short} −${STAT_LABELS[n.minus!].short})`;
}

export function DesiredEditor({ desired, onChange }: { desired: DesiredPokemon; onChange: (fn: (d: DesiredPokemon) => DesiredPokemon) => void }) {
  const sp = dex.species.get(desired.speciesId);
  const fam = sp ? dex.familyOf(sp.id) : null;
  const moveOptions = sp ? dex.desiredEggMoveOptions(sp.id) : [];
  const set = (patch: Partial<DesiredPokemon>) => onChange((d) => ({ ...d, ...patch }));

  const setIv = (s: StatKey, patch: Partial<{ min: number; max: number; priority: Priority }> | null) =>
    onChange((d) => {
      const ivs = { ...d.ivs };
      if (patch === null) delete ivs[s];
      else ivs[s] = { min: 31, max: 31, priority: 'required', ...ivs[s], ...patch };
      return { ...d, ivs };
    });

  const toggleMove = (m: number) =>
    onChange((d) => {
      const has = d.eggMoves.some((x) => x.moveId === m);
      if (has) return { ...d, eggMoves: d.eggMoves.filter((x) => x.moveId !== m) };
      if (d.eggMoves.length >= 4) return d;
      return { ...d, eggMoves: [...d.eggMoves, { moveId: m, priority: 'required' }] };
    });

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <label className="field">
          <span>Pokémon</span>
        </label>
        <SpeciesPicker
          value={desired.speciesId}
          onChange={(id) =>
            onChange((d) => ({
              ...emptyDesired(id),
              ivs: d.ivs,
              nature: d.nature,
              naturePriority: d.naturePriority,
            }))
          }
        />
      </div>

      <section>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>IVs</h3>
          <div className="iv-presets" style={{ margin: 0 }}>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn sm"
                onClick={() => set({ ivs: Object.fromEntries(p.stats.map((s) => [s, { min: 31, max: 31, priority: 'required' as Priority }])) })}
              >
                {p.label}
              </button>
            ))}
            <button type="button" className="btn sm" onClick={() => set({ ivs: {} })}>
              Ninguno
            </button>
          </div>
        </div>
        <table className="iv-table" style={{ marginTop: 6 }}>
          <tbody>
            {STATS.map((s) => {
              const t = desired.ivs[s];
              return (
                <tr key={s}>
                  <td>
                    <input type="checkbox" checked={!!t} aria-label={`Exigir ${STAT_LABELS[s].name}`} onChange={(e) => setIv(s, e.target.checked ? {} : null)} />
                  </td>
                  <td className="stat" title={STAT_LABELS[s].name}>
                    {STAT_LABELS[s].short}
                  </td>
                  <td>
                    {t ? (
                      <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <input
                          className="input num"
                          type="number"
                          min={0}
                          max={31}
                          value={t.min}
                          aria-label={`${STAT_LABELS[s].short} mínimo`}
                          onChange={(e) => setIv(s, { min: clamp(e.target.value), max: Math.max(t.max, clamp(e.target.value)) })}
                        />
                        <span className="muted">–</span>
                        <input
                          className="input num"
                          type="number"
                          min={0}
                          max={31}
                          value={t.max}
                          aria-label={`${STAT_LABELS[s].short} máximo`}
                          onChange={(e) => setIv(s, { max: clamp(e.target.value), min: Math.min(t.min, clamp(e.target.value)) })}
                        />
                      </span>
                    ) : (
                      <span className="muted small">no importa</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>{t && <PriorityToggle value={t.priority} onChange={(p) => setIv(s, { priority: p })} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="stack" style={{ gap: 8 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Naturaleza</span>
            <select className="input" value={desired.nature ?? ''} onChange={(e) => set({ nature: e.target.value || null })}>
              <option value="">Cualquiera</option>
              {NATURES.map((n) => (
                <option key={n.name} value={n.name}>
                  {natureLabel(n.name)}
                </option>
              ))}
            </select>
          </label>
          {desired.nature && <PriorityToggle value={desired.naturePriority} onChange={(p) => set({ naturePriority: p })} />}
        </div>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="field" style={{ flex: 1 }}>
            <span>Género</span>
            <select className="input" value={desired.gender} onChange={(e) => set({ gender: e.target.value as DesiredPokemon['gender'] })} disabled={fam?.genderKind === 'genderless'}>
              <option value="any">Cualquiera</option>
              {fam?.genderKind !== 'female-only' && <option value="male">♂ Macho</option>}
              {fam?.genderKind !== 'male-only' && <option value="female">♀ Hembra</option>}
            </select>
          </label>
          {desired.gender !== 'any' && <PriorityToggle value={desired.genderPriority} onChange={(p) => set({ genderPriority: p })} />}
        </div>

        <label className="field">
          <span>Habilidad</span>
          <select className="input" value={desired.ability ?? ''} onChange={(e) => set({ ability: e.target.value || null })}>
            <option value="">Cualquiera</option>
            {sp &&
              [sp.abilities.primary, sp.abilities.secondary].filter(Boolean).map((a) => (
                <option key={a} value={a!}>
                  {a}
                </option>
              ))}
            {sp?.abilities.hidden && desired.hiddenAbility && <option value={sp.abilities.hidden}>{sp.abilities.hidden} (oculta)</option>}
          </select>
        </label>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <label className="row" style={{ gap: 6 }}>
            <input
              type="checkbox"
              checked={desired.hiddenAbility}
              disabled={!sp?.abilities.hidden}
              onChange={(e) => set({ hiddenAbility: e.target.checked, ability: e.target.checked && sp?.abilities.hidden ? sp.abilities.hidden : null })}
            />
            Habilidad Oculta {sp?.abilities.hidden ? <b>({sp.abilities.hidden})</b> : <span className="muted">(esta especie no tiene)</span>}
          </label>
          {desired.hiddenAbility && <PriorityToggle value={desired.hiddenAbilityPriority} onChange={(p) => set({ hiddenAbilityPriority: p })} />}
        </div>
        <label className="row" style={{ gap: 6 }}>
          <input type="checkbox" checked={desired.shiny} onChange={(e) => set({ shiny: e.target.checked })} />
          Shiny <span className="muted small">(sólo se pueden usar shinies de tu colección, R65)</span>
        </label>
      </section>

      <section>
        <h3>
          Movimientos huevo <span className="muted small">({desired.eggMoves.length}/4)</span>
        </h3>
        {moveOptions.length === 0 && <div className="muted small">Esta especie no tiene movimientos huevo en PokeMMO.</div>}
        <div className="stack" style={{ gap: 4, maxHeight: 260, overflow: 'auto' }}>
          {moveOptions.map((m) => {
            const mv = dex.moves.get(m);
            const sel = desired.eggMoves.find((x) => x.moveId === m);
            return (
              <div key={m} className="row" style={{ justifyContent: 'space-between' }}>
                <label className="row" style={{ gap: 6 }}>
                  <input type="checkbox" checked={!!sel} disabled={!sel && desired.eggMoves.length >= 4} onChange={() => toggleMove(m)} />
                  {dex.moveName(m)}
                  {mv && <TypeBadges types={[mv.type]} />}
                  {m === 344 && <span className="badge">{itemName('light-ball')}</span>}
                </label>
                {sel && (
                  <PriorityToggle
                    value={sel.priority}
                    onChange={(p) => onChange((d) => ({ ...d, eggMoves: d.eggMoves.map((x) => (x.moveId === m ? { ...x, priority: p } : x)) }))}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function clamp(v: string): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(0, Math.min(31, n)) : 0;
}
