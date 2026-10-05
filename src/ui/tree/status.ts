import { STAT_LABELS, type StatKey } from '../../data/models';
import type { BreedingSolution, DesiredPokemon, PlanNode } from '../../engine/types';

/** Estados visuales (requisito 24): color + icono + texto. */
export type FeatureStatus = 'ok' | 'new' | 'inh' | 'pend' | 'special' | 'none';

export const STATUS_META: Record<FeatureStatus, { icon: string; label: string; cls: string }> = {
  ok: { icon: '✓', label: 'Conseguida (aporta este Pokémon)', cls: 'st-ok' },
  new: { icon: '★', label: 'Obtenida en este paso (forzada con brace)', cls: 'st-new' },
  inh: { icon: '↓', label: 'Heredada (ambos padres la tenían)', cls: 'st-inh' },
  pend: { icon: '✗', label: 'Pendiente: este Pokémon no la garantiza', cls: 'st-pend' },
  special: { icon: '◆', label: 'Habilidad / movimiento especial', cls: 'st-special' },
  none: { icon: '', label: 'No es un objetivo', cls: 'st-none' },
};

export function ivStatus(n: PlanNode, s: StatKey, desired: DesiredPokemon): FeatureStatus {
  const t = desired.ivs[s];
  if (!t) return 'none';
  const iv = n.ivs[s];
  const ok = iv.min >= t.min && iv.max <= t.max;
  if (!ok) return 'pend';
  if (!n.parentA) return 'ok';
  return n.ivSources[s]?.via === 'brace' ? 'new' : 'inh';
}

export function ivText(n: PlanNode, s: StatKey): string {
  const iv = n.ivs[s];
  if (iv.min === iv.max) return String(iv.min);
  if (iv.min === 0 && iv.max === 31) return '–';
  if (iv.max === 31) return `≥${iv.min}`;
  return `${iv.min}-${iv.max}`;
}

export function ivTooltip(n: PlanNode, s: StatKey, desired: DesiredPokemon, sol: BreedingSolution, nameOf: (n: PlanNode) => string): string {
  const st = ivStatus(n, s, desired);
  const base = `${STAT_LABELS[s].name}: ${ivText(n, s)} — ${STATUS_META[st].label}`;
  const src = n.ivSources[s];
  if (!src) return base;
  return `${base}\nOrigen: ${src.nodeIds.map((id) => nameOf(sol.nodes[id])).join(' y ')} (${src.via === 'brace' ? 'brace' : 'ambos padres'})`;
}

export type Trait = { kind: 'iv'; stat: StatKey } | { kind: 'nature' } | { kind: 'ha' } | { kind: 'move'; moveId: number };

/** Conjunto de nodos por los que pasa una característica hasta la raíz (resaltar origen). */
export function traitPath(sol: BreedingSolution, trait: Trait): Set<string> {
  const out = new Set<string>();
  const visit = (id: string) => {
    if (out.has(id)) return;
    const n = sol.nodes[id];
    out.add(id);
    let next: string[] = [];
    if (trait.kind === 'iv') next = n.ivSources[trait.stat]?.nodeIds ?? [];
    else if (trait.kind === 'nature') next = n.natureSource ? [n.natureSource] : [];
    else if (trait.kind === 'ha') next = n.hiddenAbilitySource ? [n.hiddenAbilitySource] : [];
    else {
      const src = n.eggMoveSources[trait.moveId];
      next = src && src !== 'teach' ? [src] : [];
    }
    next.forEach(visit);
  };
  visit(sol.rootId);
  return out;
}
