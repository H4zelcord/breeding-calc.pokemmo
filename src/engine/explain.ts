/**
 * Explicación paso a paso generada exclusivamente a partir del árbol calculado (requisito 16).
 */
import type { Dex } from '../data/dex';
import { itemName } from '../data/items';
import { GENDER_SYMBOL, STATS, STAT_LABELS } from '../data/models';
import type { DesiredPokemon, PlanNode, PlanStep } from './types';

export function nodeTitle(dex: Dex, n: PlanNode): string {
  return `${dex.speciesName(n.speciesId)} ${GENDER_SYMBOL[n.gender]}`.trim();
}

export function ivSummary(n: PlanNode, onlyGuaranteed = true): string {
  const parts = STATS.filter((s) => !onlyGuaranteed || n.ivs[s].min > 0 || n.ivs[s].max < 31).map((s) => {
    const iv = n.ivs[s];
    const v = iv.min === iv.max ? `${iv.min}` : iv.max === 31 ? `≥${iv.min}` : `${iv.min}-${iv.max}`;
    return `${v} ${STAT_LABELS[s].short}`;
  });
  return parts.join(' / ') || 'sin IVs garantizados';
}

export function perfectCount(n: PlanNode): number {
  return STATS.filter((s) => n.ivs[s].min === 31).length;
}

function sourceLabel(n: PlanNode): string {
  if (n.source === 'owned') return n.mandatory ? 'de tu colección (OBLIGATORIO)' : 'de tu colección';
  if (n.source === 'acquired') return 'a conseguir';
  if (n.source === 'chain') return 'cadena de movimientos';
  return 'criado';
}

function describeNode(dex: Dex, n: PlanNode): string[] {
  const lines = [`${nodeTitle(dex, n)} — ${sourceLabel(n)}`];
  lines.push(`  IVs: ${ivSummary(n)}`);
  if (n.nature) lines.push(`  Naturaleza: ${n.nature}`);
  if (n.hiddenAbility !== 'no') lines.push(`  Habilidad Oculta${n.hiddenAbility === 'chance' ? ' (probabilidad desconocida, R44)' : ''}`);
  const eggMoves = n.eggMoves.filter((m) => n.contributes.eggMoves.includes(m) || n.role === 'root' || n.source !== 'owned');
  if (eggMoves.length) lines.push(`  Movimientos: ${eggMoves.map((m) => dex.moveName(m)).join(', ')}`);
  if (n.heldItem) lines.push(`  Objeto: ${n.heldItem.name} — ${n.heldItem.reason}`);
  return lines;
}

function contributionLines(dex: Dex, n: PlanNode): string[] {
  const c = n.contributes;
  const out: string[] = [];
  for (const s of c.ivs) out.push(`IV ${STAT_LABELS[s].short}`);
  if (c.nature) out.push(`Naturaleza ${n.nature}`);
  if (c.hiddenAbility) out.push('Habilidad Oculta');
  for (const m of c.eggMoves) out.push(`Movimiento ${dex.moveName(m)}`);
  if (c.species) out.push('Especie del huevo');
  return out;
}

export function buildSteps(dex: Dex, nodes: Record<string, PlanNode>, rootId: string, desired: DesiredPokemon, extraPost: string[]): PlanStep[] {
  const steps: PlanStep[] = [];
  const leaves: PlanNode[] = [];
  const crosses: PlanNode[] = [];
  const visit = (id: string) => {
    const n = nodes[id];
    if (n.parentA && n.parentB) {
      visit(n.parentA);
      visit(n.parentB);
      crosses.push(n);
    } else leaves.push(n);
  };
  visit(rootId);

  steps.push({
    index: 0,
    kind: 'prepare',
    title: `Preparar ${leaves.length} Pokémon`,
    nodeIds: leaves.map((l) => l.id),
    resultNodeId: null,
    lines: leaves.flatMap((l) => [...describeNode(dex, l), ...l.notes.map((x) => `  • ${x}`)]),
  });

  crosses.forEach((c, i) => {
    const A = nodes[c.parentA!];
    const B = nodes[c.parentB!];
    const lines: string[] = [];
    for (const p of [A, B]) {
      lines.push(`${nodeTitle(dex, p)}${p.heldItem ? ` con ${p.heldItem.name}` : ' sin objeto'}`);
      const contrib = contributionLines(dex, p);
      lines.push(`  Aporta: ${contrib.length ? contrib.join(', ') : 'nada específico'}`);
    }
    lines.push(`Resultado: ${nodeTitle(dex, c)}`);
    const gl = genderLine(dex, c, c.id === rootId ? desired : null);
    if (gl) lines.push(`  ${gl}`);
    lines.push(`  IVs garantizados: ${ivSummary(c)}`);
    for (const s of STATS) {
      const src = c.ivSources[s];
      if (!src) continue;
      const who = src.nodeIds.map((x) => nodeTitle(dex, nodes[x])).join(' y ');
      lines.push(`    ${STAT_LABELS[s].short} ← ${who} (${src.via === 'brace' ? 'brace' : 'ambos padres lo tienen'})`);
    }
    lines.push(`  Naturaleza: ${c.nature ?? 'aleatoria'}${c.natureSource ? ` ← ${nodeTitle(dex, nodes[c.natureSource])} con ${itemName('everstone')}` : ''}`);
    if (c.hiddenAbility !== 'no') lines.push(`  Habilidad Oculta: posible ← ${nodeTitle(dex, nodes[c.hiddenAbilitySource!])} (probabilidad desconocida)`);
    if (c.eggMoves.length) {
      lines.push(
        `  Movimientos: ${c.eggMoves
          .map((m) => {
            const src = c.eggMoveSources[m];
            return `${dex.moveName(m)}${src === 'teach' ? ' (enseñar)' : src ? ` ← ${nodeTitle(dex, nodes[src])}` : ''}`;
          })
          .join(', ')}`,
      );
    }
    for (const note of c.notes) lines.push(`  • ${note}`);
    steps.push({
      index: i + 1,
      kind: 'cross',
      title: `Paso ${i + 1}: cruzar ${nodeTitle(dex, A)} × ${nodeTitle(dex, B)}`,
      nodeIds: [A.id, B.id],
      resultNodeId: c.id,
      lines,
    });
  });

  const root = nodes[rootId];
  const post: string[] = [...extraPost];
  if (root.speciesId !== desired.speciesId && dex.canBecome(root.speciesId, desired.speciesId)) {
    post.push(`Evolucionar ${dex.speciesName(root.speciesId)} a ${dex.speciesName(desired.speciesId)}.`);
  }
  if (post.length) {
    steps.push({ index: crosses.length + 1, kind: 'post', title: 'Después de criar', nodeIds: [rootId], resultNodeId: rootId, lines: post });
  }
  steps.push({ index: crosses.length + 2, kind: 'final', title: 'Resultado final', nodeIds: [rootId], resultNodeId: rootId, lines: finalLines(dex, root, desired) });
  return steps;
}

const GENDER_TEXT = { male: '♂ Macho', female: '♀ Hembra', genderless: 'Sin género', any: 'Cualquiera' } as const;

/** Línea de género de un nodo criado: qué género elegir al recoger el huevo y por qué. */
function genderLine(dex: Dex, n: PlanNode, desired: DesiredPokemon | null): string | null {
  const kind = dex.getFamily(n.familyId).genderKind;
  if (n.gender === 'genderless' || kind === 'genderless') return null;
  if (n.gender === 'any') {
    if (desired && desired.gender !== 'any') return `Género: cualquiera (se pidió ${GENDER_TEXT[desired.gender]} sin marcar como obligatorio y se ha descartado)`;
    return null;
  }
  if (kind !== 'mixed') return `Género: ${GENDER_TEXT[n.gender]} (la especie sólo tiene ${n.gender === 'male' ? 'machos' : 'hembras'})`;
  const why = desired ? 'el que has marcado para el Pokémon final' : n.role === 'mother' ? 'hará de madre en el siguiente cruce' : 'hará de padre en el siguiente cruce';
  return `Género: elegir ${GENDER_TEXT[n.gender]} al recoger el huevo (se paga al cuidador, R60) — ${why}`;
}

/** Resumen final, construido a partir del nodo raíz del árbol. */
function finalLines(dex: Dex, root: PlanNode, desired: DesiredPokemon): string[] {
  const species = dex.canBecome(root.speciesId, desired.speciesId) ? desired.speciesId : root.speciesId;
  const lines: string[] = [`${dex.speciesName(species)}`];
  const g = genderLine(dex, root, desired);
  if (root.gender === 'male' || root.gender === 'female') lines.push(`Género: ${GENDER_TEXT[root.gender]}`);
  else if (g) lines.push(g);
  const perfect = perfectCount(root);
  lines.push(`IVs: ${ivSummary(root)}${perfect ? ` (${perfect}x31)` : ''}`);
  lines.push(`Naturaleza: ${root.nature ?? 'aleatoria'}`);
  if (root.hiddenAbility === 'chance') lines.push(`Habilidad Oculta: ${root.ability ?? ''} (probabilidad desconocida, R44)`);
  else if (desired.ability) lines.push(`Habilidad: ${desired.ability}`);
  if (root.eggMoves.length) lines.push(`Movimientos: ${root.eggMoves.map((m) => dex.moveName(m)).join(', ')}`);
  return lines;
}
