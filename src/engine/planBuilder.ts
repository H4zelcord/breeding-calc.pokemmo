/**
 * Convierte las decisiones de la búsqueda en el árbol de nodos (requisito 11) y calcula,
 * a partir de los progenitores, lo que realmente garantiza cada cruce.
 * Las garantías se recalculan con las reglas (no se copian del requisito): así el árbol
 * y la explicación nunca pueden contradecirse.
 */
import type { StatKey } from '../data/models';
import { STATS, STAT_LABELS } from '../data/models';
import { ITEM_BY_ID, itemLabel, itemName } from '../data/items';
import type { EngineContext } from './context';
import { addMoney, emptyMoney } from './cost';
import type { ChainResult } from './eggMoveChain';
import type { ParentPlan } from './options';
import { describeReq, reqStats, type Req } from './requirement';
import { childIvs, FULL_INTERVAL } from './rules/inheritance';
import type { Decision } from './search';
import type { Contributions, HeldItemRef, IVInterval, MoneyBreakdown, NodeRole, PlanNode } from './types';

const VOLT_TACKLE = 344;

function fullIvs(): Record<StatKey, IVInterval> {
  const o = {} as Record<StatKey, IVInterval>;
  for (const s of STATS) o[s] = { ...FULL_INTERVAL };
  return o;
}

function noContrib(): Contributions {
  return { ivs: [], nature: false, ability: false, hiddenAbility: false, eggMoves: [], species: false };
}

export interface BuiltTree {
  rootId: string;
  nodes: Record<string, PlanNode>;
  money: MoneyBreakdown;
}

export function buildTree(ctx: EngineContext, decisions: Decision[]): BuiltTree {
  const { dex } = ctx;
  const byNode = new Map(decisions.map((d) => [d.nodeId, d]));
  const nodes: Record<string, PlanNode> = {};
  let money = emptyMoney();
  let chainSeq = 0;

  const heldItem = (pp: ParentPlan | null): HeldItemRef | null => {
    if (!pp?.item) return null;
    const def = ITEM_BY_ID.get(pp.item.itemId)!;
    return { itemId: def.id, name: itemLabel(def), reason: pp.item.reason };
  };

  const baseNode = (id: string, req: Req, pp: ParentPlan | null, role: NodeRole): PlanNode => ({
    id,
    speciesId: 0,
    hatchSpeciesId: null,
    familyId: 0,
    gender: 'any',
    nature: null,
    ability: null,
    hiddenAbility: 'no',
    ivs: fullIvs(),
    exactIvs: null,
    requiredIvs: { ...req.ivs },
    eggMoves: [],
    heldItem: heldItem(pp),
    eggGroups: [],
    parentA: null,
    parentB: null,
    childId: null,
    role,
    generation: 0,
    step: 0,
    source: 'acquired',
    ownedId: null,
    required: describeReq(dex, req) === 'sin requisitos' ? [] : [describeReq(dex, req)],
    optional: [],
    contributes: noContrib(),
    ivSources: {},
    natureSource: null,
    hiddenAbilitySource: null,
    eggMoveSources: {},
    reasons: [],
    notes: [],
    shiny: req.shiny,
    mandatory: false,
    requiredSpecies: req.species.kind === 'family' && req.species.speciesIds ? req.species.speciesIds[0] : null,
    money: emptyMoney(),
  });

  const finish = (n: PlanNode) => {
    const sp = dex.getSpecies(n.speciesId);
    n.familyId = dex.familyIdOf(n.speciesId);
    n.eggGroups = dex.getFamily(n.familyId).eggGroups;
    if (n.gender === 'any' && (dex.isGenderlessFamily(n.familyId) || dex.isDittoFamily(n.familyId))) n.gender = 'genderless';
    if (n.role !== 'root' && !dex.speciesCanBreed(n.speciesId) && n.source !== 'owned') {
      // Se muestra la especie que realmente actúa como progenitor; la de eclosión queda en hatchSpeciesId.
      const target = dex.getFamily(n.familyId).firstBreedable;
      if (target) {
        n.notes.push(`Eclosiona como ${sp.name}: evolucionar a ${dex.speciesName(target)} antes de criar (R08).`);
        n.hatchSpeciesId = n.hatchSpeciesId ?? n.speciesId;
        n.speciesId = target;
      }
    }
    if (n.role !== 'root' && n.source === 'bred' && n.requiredSpecies && n.requiredSpecies !== n.speciesId && dex.canBecome(n.speciesId, n.requiredSpecies)) {
      n.notes.push(`Evolucionar a ${dex.speciesName(n.requiredSpecies)} antes de criar (debe llevar ${n.heldItem?.name ?? 'el objeto'}).`);
      n.speciesId = n.requiredSpecies;
    }
    nodes[n.id] = n;
    money = addMoney(money, n.money);
  };

  const buildChain = (id: string, req: Req, pp: ParentPlan | null, role: NodeRole, chain: ChainResult): string => {
    const mk = (sid: string, speciesId: number, gender: PlanNode['gender'], r: NodeRole, source: PlanNode['source']): PlanNode => {
      const n = baseNode(sid, { ...req, ivs: {}, moves: [], nature: null, ha: false }, null, r);
      n.speciesId = speciesId;
      n.gender = gender;
      n.source = source;
      n.required = [];
      return n;
    };
    const lastIdx = chain.links.length - 1;
    const startId = lastIdx < 0 ? id : `c${chainSeq++}`;
    const start = mk(startId, chain.start.speciesId, 'male', lastIdx < 0 ? role : 'father', 'chain');
    start.eggMoves = [...chain.start.taught];
    start.notes.push(`Enseñar ${chain.start.taught.map((m) => dex.moveName(m)).join(', ')} (nivel/MT/tutor; R53).`);
    for (const mv of chain.start.taught) start.eggMoveSources[mv] = 'teach';
    start.reasons.push('Inicio de la cadena de movimientos huevo: aprende el movimiento sin necesidad de crianza.');
    if (lastIdx < 0) {
      start.heldItem = heldItem(pp);
      start.required = [describeReq(dex, req)];
      start.money = chain.money;
      finish(start);
      return id;
    }
    finish(start);
    let fatherId = startId;
    chain.links.forEach((link, i) => {
      const childId = i === lastIdx ? id : `c${chainSeq++}`;
      const motherId = `c${chainSeq++}`;
      const mother = mk(motherId, link.motherSpecies, 'female', 'mother', 'chain');
      mother.reasons.push(`Hembra de ${dex.speciesName(link.motherSpecies)}: determina la especie de la cría (R07).`);
      mother.contributes.species = true;
      mother.childId = childId;
      finish(mother);
      const father = nodes[fatherId];
      father.childId = childId;
      father.contributes.eggMoves = [...link.inherited];
      if (link.inherited.length) father.reasons.push(`Transmite ${link.inherited.map((m) => dex.moveName(m)).join(', ')} como padre (R50).`);
      const child = mk(childId, link.childSpecies, 'male', i === lastIdx ? role : 'father', 'chain');
      child.hatchSpeciesId = link.childSpecies;
      child.parentA = motherId;
      child.parentB = fatherId;
      child.eggMoves = [...link.childMoves];
      for (const mv of link.inherited) child.eggMoveSources[mv] = fatherId;
      for (const mv of link.taught) child.eggMoveSources[mv] = 'teach';
      if (link.taught.length) child.notes.push(`Enseñar ${link.taught.map((m) => dex.moveName(m)).join(', ')} (nivel/MT/tutor).`);
      child.reasons.push(`Eslabón de la cadena de movimientos huevo: macho de ${dex.speciesName(link.childSpecies)}.`);
      if (i === lastIdx) {
        child.heldItem = heldItem(pp);
        child.required = [describeReq(dex, req)];
        child.money = chain.money;
      }
      finish(child);
      fatherId = childId;
    });
    return id;
  };

  const build = (nodeId: number, pp: ParentPlan | null, role: NodeRole): string => {
    const d = byNode.get(nodeId);
    if (!d) throw new Error(`Nodo ${nodeId} sin decisión`);
    const id = `n${nodeId}`;
    const o = d.option;
    const req = d.req;
    if (o.kind === 'chain') return buildChain(id, req, pp, role, o.chain);
    const n = baseNode(id, req, pp, role);
    n.money = o.money;
    if (o.kind === 'owned') {
      const m = ctx.ownedById.get(o.ownedId)!;
      n.source = 'owned';
      n.ownedId = m.id;
      n.speciesId = m.speciesId;
      n.gender = m.gender;
      n.nature = m.nature;
      n.ability = m.ability;
      n.hiddenAbility = m.hiddenAbility ? 'yes' : 'no';
      n.exactIvs = { ...m.ivs };
      for (const s of STATS) n.ivs[s] = { min: m.ivs[s], max: m.ivs[s] };
      n.eggMoves = [...m.moves];
      n.mandatory = m.status === 'mandatory';
      n.shiny = m.shiny;
      n.notes.push(...o.notes);
      n.reasons.push(m.status === 'mandatory' ? 'Pokémon de tu colección marcado como OBLIGATORIO.' : 'Pokémon de tu colección que cumple el requisito.');
      finish(n);
      return id;
    }
    if (o.kind === 'acquire') {
      n.source = 'acquired';
      n.speciesId = o.speciesId;
      n.gender = req.gender;
      n.nature = req.nature;
      n.hiddenAbility = req.ha ? 'yes' : 'no';
      for (const s of reqStats(req)) n.ivs[s] = { ...req.ivs[s]! };
      n.notes.push(`${o.description}.`);
      finish(n);
      return id;
    }

    // ---- cruce
    const [p0, p1] = o.parents;
    const aId = build(d.childIds[0], p0, p0.role);
    const bId = build(d.childIds[1], p1, p1.role);
    const A = nodes[aId];
    const B = nodes[bId];
    A.childId = id;
    B.childId = id;
    n.source = 'bred';
    n.parentA = aId;
    n.parentB = bId;
    n.speciesId = o.hatchSpecies;
    n.hatchSpeciesId = o.hatchSpecies;
    n.gender = req.gender;
    n.ivs = childIvs(A.ivs, B.ivs, p0.braced, p1.braced);
    const pa = [A, B];
    const plans = [p0, p1];

    // Naturaleza (R30)
    const nIdx = plans.findIndex((p) => p.carries.nature);
    if (nIdx >= 0) {
      n.nature = pa[nIdx].nature;
      n.natureSource = pa[nIdx].id;
      pa[nIdx].contributes.nature = true;
      pa[nIdx].reasons.push(`Lleva ${itemName('everstone')} para transmitir la naturaleza ${pa[nIdx].nature} (R30).`);
    }
    // HA (R42, R44)
    const hIdx = plans.findIndex((p) => p.carries.ha);
    if (hIdx >= 0 && pa[hIdx].hiddenAbility !== 'no') {
      n.hiddenAbility = 'chance';
      n.hiddenAbilitySource = pa[hIdx].id;
      pa[hIdx].contributes.hiddenAbility = true;
      pa[hIdx].reasons.push('Tiene la Habilidad Oculta y es de la misma línea evolutiva que la cría (R42).');
    }
    const hatchSp = dex.getSpecies(o.hatchSpecies);
    n.ability = n.hiddenAbility === 'chance' ? hatchSp.abilities.hidden : null;
    // Movimientos huevo (R50-R53, R55)
    plans.forEach((p, mIdx) => {
      if (!p.carries.moves) return;
      const inherited = p.req.moves.filter((m) => pa[mIdx].eggMoves.includes(m) && dex.eggMovesOf(o.hatchSpecies).includes(m) && !n.eggMoves.includes(m));
      n.eggMoves.push(...inherited);
      for (const mv of inherited) n.eggMoveSources[mv] = pa[mIdx].id;
      pa[mIdx].contributes.eggMoves = inherited;
      const who = pa[mIdx].gender === 'female' ? 'como madre (R52, opción experimental)' : 'como padre (R50)';
      pa[mIdx].reasons.push(`Transmite ${inherited.map((m) => dex.moveName(m)).join(', ')} ${who}.`);
    });
    for (const mv of o.taughtMoves) {
      n.eggMoves.push(mv);
      n.eggMoveSources[mv] = 'teach';
      n.notes.push(`Enseñar ${dex.moveName(mv)} tras eclosionar (nivel/MT/tutor).`);
    }
    const lbIdx = plans.findIndex((p) => p.carries.lightBall);
    if (lbIdx >= 0) {
      n.eggMoves.push(VOLT_TACKLE);
      n.eggMoveSources[VOLT_TACKLE] = pa[lbIdx].id;
      pa[lbIdx].contributes.eggMoves = [...pa[lbIdx].contributes.eggMoves, VOLT_TACKLE];
      pa[lbIdx].reasons.push(`Pikachu con ${itemName('light-ball')}: el Pichu aprende Volt Tackle (R55).`);
    }
    const iIdx = plans.findIndex((p) => p.carries.incense);
    if (iIdx >= 0) pa[iIdx].reasons.push(`Lleva ${pa[iIdx].heldItem?.name} para obtener el huevo de ${hatchSp.name} (R09).`);

    // Especie (R07) y Ditto (R04)
    A.contributes.species = true;
    if (o.pairKind === 'standard') A.reasons.push(`Hembra de la línea de ${dex.speciesName(o.familyId)}: determina la especie del huevo (R07).`);
    else if (o.pairKind === 'ditto') {
      A.reasons.push('Progenitor que no es Ditto: determina la especie del huevo (R07).');
      B.reasons.push('Ditto: permite criar sin pareja del sexo opuesto (R04).');
    } else A.reasons.push('Misma línea evolutiva sin género (R05).');

    // IVs: origen de cada IV requerido (R21, R22)
    for (const s of reqStats(req)) {
      const want = req.ivs[s]!;
      const braced = p0.braced === s ? 0 : p1.braced === s ? 1 : -1;
      if (braced >= 0) {
        n.ivSources[s] = { nodeIds: [pa[braced].id], via: 'brace' };
        pa[braced].contributes.ivs.push(s);
      } else {
        n.ivSources[s] = { nodeIds: [A.id, B.id], via: 'both' };
        A.contributes.ivs.push(s);
        B.contributes.ivs.push(s);
      }
      if (n.ivs[s].min < want.min || n.ivs[s].max > want.max) {
        throw new Error(`Inconsistencia interna: el cruce no garantiza ${s}`);
      }
    }
    for (const [i, p] of plans.entries()) {
      const node = pa[i];
      const own = node.contributes.ivs.filter((s) => p.braced === s);
      const shared = node.contributes.ivs.filter((s) => p.braced !== s);
      if (own.length) node.reasons.push(`Lleva ${node.heldItem?.name} para forzar ${own.map((s) => `${STAT_LABELS[s].short}`).join(', ')} (R21).`);
      if (shared.length) node.reasons.push(`Comparte ${shared.map((s) => STAT_LABELS[s].short).join(', ')} con su pareja: se mantiene garantizado (R22).`);
    }
    finish(n);
    return id;
  };

  const rootId = build(0, null, 'root');
  assignGenerations(nodes, rootId);
  return { rootId, nodes, money };
}

function assignGenerations(nodes: Record<string, PlanNode>, rootId: string): void {
  let step = 0;
  const visit = (id: string): number => {
    const n = nodes[id];
    if (!n.parentA || !n.parentB) {
      n.generation = 0;
      return 0;
    }
    const g = 1 + Math.max(visit(n.parentA), visit(n.parentB));
    n.generation = g;
    n.step = ++step;
    return g;
  };
  visit(rootId);
}
