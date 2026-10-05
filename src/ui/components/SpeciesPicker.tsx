import { useEffect, useMemo, useRef, useState } from 'react';
import { itemName } from '../../data/items';
import { getDex } from '../../data/dex';
import type { SpeciesData } from '../../data/models';
import { EggGroups, Sprite, TypeBadges, genderRatioText } from './common';

const dex = getDex();

interface Props {
  value: number | null;
  onChange: (speciesId: number) => void;
  placeholder?: string;
  /** Sólo especies que pueden actuar como progenitor (o evolucionar a una). */
  breedableOnly?: boolean;
  compact?: boolean;
}

/** Buscador con autocompletado (requisito 6). */
export function SpeciesPicker({ value, onChange, placeholder = 'Buscar Pokémon…', breedableOnly, compact }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    let r = dex.search(query, 60);
    if (breedableOnly) r = r.filter((s) => dex.familyOf(s.id).canBreed);
    return r.slice(0, 40);
  }, [query, breedableOnly]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (s: SpeciesData) => {
    onChange(s.id);
    setQuery('');
    setOpen(false);
  };

  const selected = value ? dex.species.get(value) : null;

  return (
    <div className="picker" ref={ref}>
      <input
        className="input"
        style={{ width: '100%' }}
        value={query}
        placeholder={selected && compact ? selected.name : placeholder}
        aria-label="Buscar especie"
        aria-expanded={open}
        role="combobox"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHl(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            setHl((h) => Math.min(h + 1, results.length - 1));
            e.preventDefault();
          } else if (e.key === 'ArrowUp') {
            setHl((h) => Math.max(h - 1, 0));
            e.preventDefault();
          } else if (e.key === 'Enter' && results[hl]) {
            pick(results[hl]);
            e.preventDefault();
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <div className="picker-list" role="listbox">
          {results.length === 0 && <div className="picker-item muted">Sin resultados</div>}
          {results.map((s, i) => {
            const fam = dex.familyOf(s.id);
            return (
              <div
                key={s.id}
                role="option"
                aria-selected={i === hl}
                className={`picker-item ${i === hl ? 'hl' : ''}`}
                onMouseEnter={() => setHl(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
              >
                <Sprite id={s.id} />
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 6 }}>
                    <b>{s.name}</b>
                    <span className="muted small">#{s.id}</span>
                    <TypeBadges types={s.types} />
                  </div>
                  <div className="meta">
                    {fam.canBreed ? fam.eggGroups.filter((g) => g !== 'cannot breed').join(', ') : 'No puede criar'} · {genderRatioText(s.genderRatio)}
                    {dex.isBaby(s.id) ? ' · bebé' : ''}
                    {!s.obtainable ? ' · no obtenible' : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {selected && !compact && <SpeciesSummary species={selected} />}
    </div>
  );
}

export function SpeciesSummary({ species }: { species: SpeciesData }) {
  const fam = dex.familyOf(species.id);
  const a = species.abilities;
  return (
    <div className="selected-species">
      <Sprite id={species.id} size="lg" />
      <div className="stack" style={{ gap: 4, minWidth: 0 }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{species.name}</h3>
          <span className="muted small">#{species.id}</span>
          <TypeBadges types={species.types} />
        </div>
        <div className="small">
          <EggGroups groups={fam.canBreed ? fam.eggGroups : ['cannot breed']} /> <span className="muted">· {genderRatioText(species.genderRatio)}</span>
        </div>
        <div className="small muted">
          Habilidades: {[a.primary, a.secondary].filter(Boolean).join(' / ')}
          {a.hidden ? ` · HA: ${a.hidden}` : ' · sin HA'}
        </div>
        <div className="small muted">
          Del huevo sale: {dex.speciesName(dex.eggSpeciesForTarget(species.id))}
          {fam.incense ? ` (bebé: requiere ${itemName(fam.incense.itemId)})` : ''}
        </div>
      </div>
    </div>
  );
}
