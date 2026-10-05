import { useState, type ReactNode } from 'react';
import { getDex } from '../../data/dex';
import { EGG_GROUP_LABELS, GENDER_SYMBOL, type EggGroup, type Gender } from '../../data/models';
import type { PlanMessage, Priority } from '../../engine/types';

const dex = getDex();

/** Sprites oficiales servidos por el proyecto PokeAPI/sprites (id nacional = id de PokeMMO para 1-649). */
export function spriteUrl(id: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

export function Sprite({ id, size, shiny }: { id: number; size?: 'lg'; shiny?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed || !id) return <div className="sprite-fallback">#{id}</div>;
  const url = shiny ? spriteUrl(id).replace('/pokemon/', '/pokemon/shiny/') : spriteUrl(id);
  return <img className={`sprite ${size ?? ''}`} src={url} alt={dex.speciesName(id)} loading="lazy" onError={() => setFailed(true)} />;
}

const TYPE_COLORS: Record<string, string> = {
  Normal: '#9a9a7a',
  Fire: '#e2672d',
  Water: '#4f84e0',
  Electric: '#d6aa12',
  Grass: '#5ba53a',
  Ice: '#5cb9c1',
  Fighting: '#b8382f',
  Poison: '#94409a',
  Ground: '#c39d4b',
  Flying: '#8f7fd8',
  Psychic: '#e84f7d',
  Bug: '#93a51d',
  Rock: '#a8913a',
  Ghost: '#6a5395',
  Dragon: '#6a3ff0',
  Dark: '#6b5547',
  Steel: '#9d9db8',
};

export function TypeBadges({ types }: { types: string[] }) {
  return (
    <span className="row" style={{ gap: 4 }}>
      {types.map((t) => (
        <span key={t} className="type-badge" style={{ background: TYPE_COLORS[t] ?? '#888' }}>
          {t}
        </span>
      ))}
    </span>
  );
}

export function GenderLabel({ gender, withText }: { gender: Gender | 'any'; withText?: boolean }) {
  const text = { male: 'Macho', female: 'Hembra', genderless: 'Sin género', any: 'Cualquiera' }[gender];
  return (
    <span className={`g-${gender}`} title={text} aria-label={text}>
      {GENDER_SYMBOL[gender]}
      {withText ? ` ${text}` : ''}
    </span>
  );
}

export function EggGroups({ groups }: { groups: string[] }) {
  return (
    <span className="row" style={{ gap: 4 }}>
      {groups.map((g) => (
        <span key={g} className="badge">
          {EGG_GROUP_LABELS[g as EggGroup] ?? g}
        </span>
      ))}
    </span>
  );
}

export function genderRatioText(ratio: number): string {
  if (ratio === 255) return 'Sin género';
  if (ratio === 0) return '100 % ♂';
  if (ratio === 254) return '100 % ♀';
  const f = ((ratio + 1) / 256) * 100;
  return `${(100 - f).toFixed(1).replace('.0', '')} % ♂ · ${f.toFixed(1).replace('.0', '')} % ♀`;
}

/** Marca "Obligatorio": sí (casilla marcada) o no. */
export function PriorityToggle({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <label className="prio row" style={{ gap: 4 }} title="Marcado: la solución debe cumplirlo. Sin marcar: se intenta, pero se descarta si lo hace imposible.">
      <input type="checkbox" checked={value === 'required'} onChange={(e) => onChange(e.target.checked ? 'required' : 'desired')} />
      Obligatorio
    </label>
  );
}

export function Messages({ errors = [], warnings = [], info = [] }: { errors?: PlanMessage[]; warnings?: PlanMessage[]; info?: PlanMessage[] }) {
  const one = (m: PlanMessage, kind: string, icon: string, i: number) => (
    <div key={`${kind}${i}`} className={`msg ${kind}`} role={kind === 'error' ? 'alert' : undefined}>
      <b>
        {icon} {m.message}
      </b>
      {m.detail && <div className="detail">{m.detail}</div>}
    </div>
  );
  if (!errors.length && !warnings.length && !info.length) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      {errors.map((m, i) => one(m, 'error', '❌', i))}
      {warnings.map((m, i) => one(m, 'warning', '⚠️', i))}
      {info.map((m, i) => one(m, 'info', 'ℹ️', i))}
    </div>
  );
}

export function money(n: number): string {
  return n.toLocaleString('es-ES');
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

/** Descarga un objeto como JSON. */
export function downloadJson(name: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Abre un selector de archivo y devuelve su texto. */
export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const f = input.files?.[0];
      resolve(f ? await f.text() : null);
    };
    input.click();
  });
}

export function resolveSpecies(nameOrId: string | number): number | null {
  if (typeof nameOrId === 'number') return dex.species.has(nameOrId) ? nameOrId : null;
  const q = nameOrId.trim().toLowerCase();
  return dex.allSpecies().find((s) => s.name.toLowerCase() === q)?.id ?? null;
}
