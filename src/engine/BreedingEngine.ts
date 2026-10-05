/**
 * BreedingEngine: DesiredPokemon + AvailablePokemon + BreedingRules + Options → BreedingPlan.
 * Independiente de la UI: se puede usar y probar sin interfaz.
 */
import { getDex, type Dex } from '../data/dex';
import { ITEM_BY_ID, itemLabel, itemName } from '../data/items';
import { createContext, type EngineContext } from './context';
import { charge, COST_PROFILES, moneyTotal } from './cost';
import { buildSteps } from './explain';
import { buildTree } from './planBuilder';
import type { Req } from './requirement';
import { PRICE_LABELS, type PriceKey } from './rules/config';
import { Searcher, solutionSignature, type SearchSolution } from './search';
import type { BreedingInput, BreedingPlan, BreedingSolution, CostWeights, PlanMessage } from './types';
import { buildRootReq, hasDesiredFeatures, mandatoryProblem, validateDesired, validateOwned } from './validation';

export class BreedingEngine {
  constructor(private readonly dex: Dex = getDex()) {}

  plan(input: BreedingInput): BreedingPlan {
    const t0 = Date.now();
    const { dex } = this;
    const { desired, rules, options } = input;
    const plan: BreedingPlan = {
      target: desired,
      ok: false,
      best: null,
      alternatives: [],
      warnings: [],
      errors: [],
      info: [],
      searchStats: { expansions: 0, ms: 0 },
    };
    const v = validateDesired(dex, desired, rules);
    plan.errors.push(...v.errors);
    plan.warnings.push(...v.warnings);
    plan.info.push(...v.info);
    if (plan.errors.length) return done(plan, t0);

    // Colección
    const owned = options.mode === 'collection' ? input.owned : [];
    const valid = owned.filter((m) => {
      const problems = validateOwned(dex, m);
      if (problems.length) {
        plan.warnings.push({ code: 'OWNED_INVALID', message: `Pokémon de la colección ignorado: ${problems.join(' ')}`, ownedId: m.id });
        return false;
      }
      return true;
    });
    for (const m of owned) {
      if (m.status === 'mandatory' && !valid.includes(m)) {
        plan.errors.push({ code: 'MANDATORY_INVALID', message: 'No es posible utilizar este Pokémon.', detail: `Motivo: ${validateOwned(dex, m).join(' ')}`, ownedId: m.id });
      }
    }
    if (options.mode === 'scratch' && input.owned.some((m) => m.status === 'mandatory')) {
      plan.info.push({ code: 'SCRATCH', message: 'Modo "Empezar desde cero": se ignora la colección, incluidos los obligatorios.' });
    }

    const full = buildRootReq(dex, desired, true);
    const reqOnly = buildRootReq(dex, desired, false);

    // Obligatorios imposibles: error exacto; el plan se calcula sin ellos y se indica claramente.
    const mandatory: string[] = [];
    for (const m of valid.filter((x) => x.status === 'mandatory')) {
      const problem = mandatoryProblem(dex, m, full.req);
      if (problem) {
        plan.errors.push({
          code: 'MANDATORY_IMPOSSIBLE',
          message: `No es posible utilizar ${dex.speciesName(m.speciesId)} (obligatorio).`,
          detail: `Motivo: ${problem} Se muestra la mejor solución sin él.`,
          ownedId: m.id,
        });
      } else mandatory.push(m.id);
    }

    const run = (weights: CostWeights, root: Req, maxSolutions: number, budget: number) => {
      const ctx = createContext(dex, rules, weights, options, valid);
      const searcher = new Searcher(ctx, mandatory);
      // Búsqueda "anytime":
      // 1) A* ponderado (w = 3, rápido) → primera solución y cota superior.
      // 2) A* ponderado (w = 1,5) acotado → mejora la solución.
      // 3) A* exacto (w = 1) acotado → si agota el espacio, la mejor solución es óptima.
      const holder: { best: SearchSolution | null } = { best: null };
      const consider = (res: { solutions: SearchSolution[] }) => {
        for (const x of res.solutions) if (!holder.best || x.g < holder.best.g - 1e-9) holder.best = x;
      };
      for (const w of [3, 10]) {
        const res = searcher.search(root, { maxExpansions: Math.ceil(budget / 4), maxSolutions: 1, weight: w });
        plan.searchStats.expansions += res.expansions;
        consider(res);
        if (holder.best) break;
        if (res.exhausted) return { ctx, searcher, solutions: [] as SearchSolution[] }; // imposible
      }
      if (!holder.best) return { ctx, searcher, solutions: [] as SearchSolution[] };
      const improve = searcher.search(root, { maxExpansions: Math.ceil(budget / 4), maxSolutions: 1, weight: 1.5, upperBound: holder.best.g });
      plan.searchStats.expansions += improve.expansions;
      consider(improve);
      const exact = searcher.search(root, { maxExpansions: Math.ceil(budget / 2), maxSolutions, weight: 1, upperBound: holder.best.g });
      plan.searchStats.expansions += exact.expansions;
      const sols: SearchSolution[] = exact.solutions.length ? [...exact.solutions] : [];
      const proven = exact.exhausted || (exact.solutions.length > 0 && exact.solutions[0].optimal);
      const top: SearchSolution = holder.best;
      if (!sols.length || top.g < sols[0].g - 1e-9) sols.unshift({ ...top, optimal: proven && !exact.solutions.length });
      else if (!sols.some((x) => solutionSignature(x.decisions) === solutionSignature(top.decisions))) sols.push(top);
      return { ctx, searcher, solutions: sols };
    };

    let main = run(options.weights, full.req, options.maxAlternatives + 1, options.maxExpansions);
    let dropped: string[] = [];
    if (!main.solutions.length && hasDesiredFeatures(desired)) {
      const alt = run(options.weights, reqOnly.req, options.maxAlternatives + 1, options.maxExpansions);
      if (alt.solutions.length) {
        plan.warnings.push({
          code: 'DESIRED_DROPPED',
          message: `No hay solución con todas las características. Se han descartado las no obligatorias: ${reqOnly.dropped.join(', ')}.`,
        });
        main = alt;
        dropped = reqOnly.dropped;
      }
    }
    if (!main.solutions.length) {
      plan.errors.push(diagnose(main.searcher, full.req, dex));
      return done(plan, t0);
    }

    const solutions: BreedingSolution[] = main.solutions.map((s, i) =>
      this.buildSolution(main.ctx, s, input, i === 0 ? 'Mejor solución' : `Alternativa ${i}`, dropped, options.weights),
    );
    const seen = new Set(main.solutions.map((s) => solutionSignature(s.decisions)));

    // Alternativas con otras funciones de coste (requisito 21).
    for (const profile of COST_PROFILES) {
      if (sameWeights(profile.weights, options.weights)) continue;
      const r = run(profile.weights, dropped.length ? reqOnly.req : full.req, 1, Math.min(options.maxExpansions, 6000));
      const s = r.solutions[0];
      if (!s) continue;
      const sig = solutionSignature(s.decisions);
      if (seen.has(sig)) continue;
      seen.add(sig);
      solutions.push(this.buildSolution(r.ctx, s, input, `Alternativa (${profile.label})`, dropped, options.weights));
    }
    // Variante sólo con lo obligatorio.
    if (!dropped.length && reqOnly.dropped.length) {
      const r = run(options.weights, reqOnly.req, 1, Math.min(options.maxExpansions, 6000));
      const s = r.solutions[0];
      if (s) solutions.push(this.buildSolution(r.ctx, s, input, 'Sólo características obligatorias', reqOnly.dropped, options.weights));
    }

    const [best, ...rest] = solutions;
    plan.best = best;
    plan.alternatives = rest.slice(0, Math.max(options.maxAlternatives, 0) + 3);
    plan.ok = !plan.errors.some((e) => !e.code.startsWith('MANDATORY'));

    // Obligatorios que la búsqueda no ha podido colocar (requisito 13).
    const missing = main.solutions[0].mandatoryMissing;
    for (const id of missing) {
      const m = valid.find((x) => x.id === id)!;
      plan.errors.push({
        code: 'MANDATORY_UNUSED',
        message: `No es posible utilizar ${dex.speciesName(m.speciesId)} (obligatorio).`,
        detail:
          'Motivo: aunque comparte grupo huevo y tiene alguna característica útil, ninguna posición válida del árbol lo admite ' +
          '(por género, especie, IVs fuera de rango o porque sus características ya las aporta otro progenitor obligatorio). ' +
          'Se muestra la mejor solución sin él.',
        ownedId: id,
      });
    }
    return done(plan, t0);
  }

  private buildSolution(
    ctx: EngineContext,
    s: SearchSolution,
    input: BreedingInput,
    label: string,
    dropped: string[],
    weights: CostWeights,
  ): BreedingSolution {
    const { dex } = this;
    const { desired, rules } = input;
    const tree = buildTree(ctx, s.decisions);
    const nodes = tree.nodes;
    const root = nodes[tree.rootId];
    let money = tree.money;
    const warnings: PlanMessage[] = [];
    const post: string[] = [];

    if (desired.ability && root.ability !== desired.ability && !(desired.hiddenAbility && dex.getSpecies(desired.speciesId).abilities.hidden === desired.ability)) {
      post.push(`Usar una ${itemName('ability-pill')} para cambiar la habilidad a ${desired.ability} (R40).`);
      money = charge(rules, money, 'items', 'abilityPill');
    }
    const all = Object.values(nodes);
    if (root.hiddenAbility === 'chance') {
      warnings.push({
        code: 'R44',
        message: 'La transmisión de la Habilidad Oculta no está garantizada: su probabilidad en PokeMMO es desconocida (R44).',
        detail: `Alternativa: ${itemName('ability-patch')} o ${itemName('prismatic-pearl')} (R45).`,
      });
    }
    if (rules.mechanics.incenseChance !== 1 && all.some((n) => n.heldItem && ITEM_BY_ID.get(n.heldItem.itemId)?.data.kind === 'incense')) {
      warnings.push({ code: 'R09b', message: 'El incienso "puede ayudar" a obtener el bebé; la probabilidad no está verificada (R09b).' });
    }
    if (money.unknown.length) {
      warnings.push({
        code: 'UNKNOWN_PRICES',
        message: `Coste incompleto: faltan precios de ${money.unknown.map((k) => PRICE_LABELS[k as PriceKey]).join(', ')} (Configuración → Precios).`,
      });
    }

    const steps = buildSteps(dex, nodes, tree.rootId, desired, post);
    const crosses = all.filter((n) => n.parentA && n.parentB).length;
    const leaves = all.filter((n) => !n.parentA);
    const ownedNodes = leaves.filter((n) => n.source === 'owned');
    const itemCounts = new Map<string, number>();
    for (const n of all) if (n.heldItem) itemCounts.set(n.heldItem.itemId, (itemCounts.get(n.heldItem.itemId) ?? 0) + 1);
    const estimated = money.keys.filter((k) => rules.prices[k as PriceKey].status === 'ESTIMATE' || rules.prices[k as PriceKey].status === 'REPORTED');
    const optional = desiredOptionalLabels(desired, dex);
    root.optional = optional;

    return {
      id: `sol-${Math.random().toString(36).slice(2, 9)}`,
      label,
      rootId: tree.rootId,
      nodes,
      steps,
      stats: {
        crosses,
        pokemonUsed: leaves.length,
        ownedUsed: ownedNodes.length,
        acquired: leaves.length - ownedNodes.length,
        generations: root.generation,
        score: round(s.g + weights.generations * root.generation),
        hatchMinutes: round((crosses * rules.mechanics.hatchSeconds) / 60),
      },
      cost: {
        pokemon: money.pokemon,
        items: money.items,
        breeding: money.breeding,
        total: moneyTotal(money),
        exact: money.unknown.length === 0 && estimated.length === 0,
        unknownPrices: money.unknown.map((k) => PRICE_LABELS[k as PriceKey]),
        estimatedPrices: estimated.map((k) => PRICE_LABELS[k as PriceKey]),
      },
      items: [...itemCounts.entries()].map(([itemId, count]) => ({ itemId, name: itemLabel(ITEM_BY_ID.get(itemId)!), count })),
      requiredPokemon: ownedNodes.filter((n) => n.mandatory).map((n) => n.ownedId!),
      optionalPokemon: ownedNodes.filter((n) => !n.mandatory).map((n) => n.ownedId!),
      warnings,
      droppedFeatures: dropped,
      optimal: s.optimal,
    };
  }
}

function desiredOptionalLabels(d: BreedingInput['desired'], dex: Dex): string[] {
  const out: string[] = [];
  for (const [s, t] of Object.entries(d.ivs)) if (t?.priority === 'desired') out.push(`IV ${s}`);
  if (d.nature && d.naturePriority === 'desired') out.push(`Naturaleza ${d.nature}`);
  if (d.hiddenAbility && d.hiddenAbilityPriority === 'desired') out.push('Habilidad Oculta');
  for (const m of d.eggMoves) if (m.priority === 'desired') out.push(dex.moveName(m.moveId));
  return out;
}

/** Busca qué característica concreta hace imposible el objetivo. */
function diagnose(searcher: Searcher, root: Req, dex: Dex): PlanMessage {
  const r = searcher.relaxed.bind(searcher);
  const base: Req = { ...root, ivs: {}, nature: null, moves: [], ha: false, incense: false, lightBall: false };
  if (!isFinite(r({ ...base, gender: 'any' }))) {
    return { code: 'IMPOSSIBLE', message: 'No se puede criar esta especie con las restricciones actuales.', detail: 'Revisa los Pokémon prohibidos, el modo shiny o la opción de usar Ditto.' };
  }
  if (root.gender !== 'any' && !isFinite(r({ ...base, gender: root.gender }))) {
    return { code: 'IMPOSSIBLE_GENDER', message: 'No se puede conseguir el género pedido.' };
  }
  if (root.incense && !isFinite(r({ ...base, gender: root.gender, incense: true }))) {
    return { code: 'IMPOSSIBLE_INCENSE', message: 'No se puede preparar el cruce con incienso (el portador debe ser la especie exacta, R09).' };
  }
  if (root.lightBall && !isFinite(r({ ...base, lightBall: true }))) {
    return { code: 'IMPOSSIBLE_VOLT_TACKLE', message: `No se puede preparar el cruce con ${itemName('light-ball')} (R55).` };
  }
  for (const mv of root.moves) {
    if (!isFinite(r({ ...base, moves: [mv] }))) {
      return {
        code: 'IMPOSSIBLE_MOVE',
        message: `No se ha encontrado ninguna forma de transmitir ${dex.moveName(mv)}.`,
        detail: 'Ninguna especie compatible lo aprende sin crianza ni existe una cadena de padres que lo transmita (R50-R53).',
      };
    }
  }
  if (root.moves.length > 1 && !isFinite(r({ ...base, moves: root.moves }))) {
    return {
      code: 'IMPOSSIBLE_MOVE_COMBO',
      message: `Los movimientos ${root.moves.map((m) => dex.moveName(m)).join(' + ')} no se pueden combinar.`,
      detail: 'Sólo el padre transmite movimientos huevo (R50; R52 no verificada) y ningún macho compatible puede conocerlos todos a la vez.',
    };
  }
  if (root.ha && !isFinite(r({ ...base, ha: true }))) {
    return { code: 'IMPOSSIBLE_HA', message: 'No se puede obtener la Habilidad Oculta (debe venir de un progenitor de la misma línea, R42).' };
  }
  const fam = dex.getFamily(root.species.kind === 'family' ? root.species.familyId : 0);
  const nStats = Object.keys(root.ivs).length;
  if (fam.genderKind === 'male-only' && nStats > 2) {
    return {
      code: 'IMPOSSIBLE_MALE_ONLY',
      message: `${dex.speciesName(fam.id)} sólo tiene machos: cada cruce necesita un Ditto (R04), y los Ditto no se pueden criar.`,
      detail: `Para garantizar ${nStats} IVs hace falta un Ditto con al menos ${nStats - 1} de esos IVs en tu colección (o un ${dex.speciesName(fam.id)} que ya tenga varios).`,
    };
  }
  if (root.ha && root.moves.length && !isFinite(r({ ...base, ha: true, moves: root.moves }))) {
    return { code: 'IMPOSSIBLE_HA_MOVES', message: 'No se pueden combinar la Habilidad Oculta y los movimientos huevo pedidos.' };
  }
  return {
    code: 'IMPOSSIBLE_COMBINATION',
    message: 'No existe una combinación de cruces que garantice todas las características a la vez.',
    detail: 'Prueba a desmarcar "Obligatorio" en algunas o a reducir los IVs objetivo.',
  };
}

function sameWeights(a: CostWeights, b: CostWeights): boolean {
  return (Object.keys(a) as (keyof CostWeights)[]).every((k) => a[k] === b[k]);
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

function done(plan: BreedingPlan, t0: number): BreedingPlan {
  plan.searchStats.ms = Date.now() - t0;
  return plan;
}

