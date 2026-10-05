/**
 * Búsqueda de cadenas de movimientos huevo (R50-R53).
 *
 * Estado = (familia, subconjunto de movimientos deseados que conoce un macho de esa familia).
 * - Inicio: un macho de una familia que aprende algunos movimientos sin crianza (nivel/MT/tutor).
 * - Transición: ese macho cría con una hembra de una familia compatible Z; la cría (macho) hereda
 *   los movimientos que están en la lista de movimientos huevo de la especie que eclosiona de Z y
 *   puede aprender los que Z aprende de forma natural.
 * - Objetivo: un macho que conoce todos los movimientos y cumple la restricción de especie.
 * Se resuelve con Dijkstra (coste no negativo por transición).
 */
import type { EngineContext } from './context';
import { addMoney, charge, emptyMoney, moneyCost } from './cost';
import type { SpeciesConstraint } from './requirement';
import { genderFeeKey } from './rules/inheritance';
import type { MoneyBreakdown } from './types';

export interface ChainLink {
  /** Macho que transmite los movimientos. */
  fatherFamily: number;
  fatherSpecies: number;
  fatherMoves: number[];
  /** Hembra de la especie que recibe. */
  motherFamily: number;
  motherSpecies: number;
  /** Especie que eclosiona (macho). */
  childSpecies: number;
  childFamily: number;
  inherited: number[];
  taught: number[];
  childMoves: number[];
}

export interface ChainResult {
  start: { familyId: number; speciesId: number; taught: number[] };
  links: ChainLink[];
  familyId: number;
  speciesId: number;
  moves: number[];
  cost: number;
  money: MoneyBreakdown;
  crosses: number;
  pokemon: number;
}

interface Entry {
  fam: number;
  mask: number;
  cost: number;
}

class MinHeap<T extends { cost: number }> {
  private a: T[] = [];
  constructor(private readonly less: (x: T, y: T) => boolean = (x, y) => x.cost < y.cost) {}
  get size(): number {
    return this.a.length;
  }
  push(x: T): void {
    const a = this.a;
    a.push(x);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(a[i], a[p])) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop(): T | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && this.less(a[l], a[m])) m = l;
        if (r < a.length && this.less(a[r], a[m])) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const cache = new WeakMap<EngineContext, Map<string, ChainResult | null>>();

export function findEggMoveChain(ctx: EngineContext, moves: number[], constraint: SpeciesConstraint): ChainResult | null {
  if (constraint.kind === 'ditto' || moves.length === 0) return null;
  const key = `${moves.join('.')}|${constraint.kind}${constraint.familyId}`;
  let c = cache.get(ctx);
  if (!c) cache.set(ctx, (c = new Map()));
  if (c.has(key)) return c.get(key)!;
  const res = search(ctx, moves, constraint);
  c.set(key, res);
  return res;
}

function search(ctx: EngineContext, moves: number[], constraint: Exclude<SpeciesConstraint, { kind: 'ditto' }>): ChainResult | null {
  const { dex, rules, weights } = ctx;
  const full = (1 << moves.length) - 1;
  const families = dex.breedingFamilies().filter((f) => !dex.isGenderlessFamily(f.id));
  const nat = new Map<number, number>();
  const egg = new Map<number, number>();
  for (const f of families) {
    const natural = dex.naturalMoves(f.id);
    const eggList = dex.eggMovesOf(dex.eggSpecies(f.id));
    let n = 0;
    let e = 0;
    moves.forEach((mv, i) => {
      if (natural.has(mv)) n |= 1 << i;
      if (eggList.includes(mv)) e |= 1 << i;
    });
    nat.set(f.id, n);
    egg.set(f.id, e);
  }
  const isGoal = (fam: number, mask: number): boolean => {
    if (mask !== full || !dex.canBeMale(fam)) return false;
    if (constraint.kind === 'family') return fam === constraint.familyId;
    return fam === constraint.familyId || dex.shareEggGroup(fam, constraint.familyId);
  };
  const bits = (mask: number) => moves.filter((_, i) => mask & (1 << i));
  const popcount = (mask: number) => bits(mask).length;

  const acquireMoney = (taught: number) => {
    let m = charge(rules, emptyMoney(), 'pokemon', 'acquireBase');
    m = charge(rules, m, 'items', 'teachMove', taught);
    return m;
  };

  const best = new Map<string, number>();
  const prev = new Map<string, { from: string | null; link: Omit<ChainLink, 'fatherMoves' | 'childMoves'> | null; money: MoneyBreakdown }>();
  const heap = new MinHeap<Entry>();
  const sk = (fam: number, mask: number) => `${fam}:${mask}`;

  for (const f of families) {
    const n = nat.get(f.id)!;
    if (!n || !dex.canBeMale(f.id)) continue;
    const money = acquireMoney(popcount(n));
    const cost = weights.pokemon + weights.acquire + moneyCost(weights, money);
    const k = sk(f.id, n);
    if (cost < (best.get(k) ?? Infinity)) {
      best.set(k, cost);
      prev.set(k, { from: null, link: null, money });
      heap.push({ fam: f.id, mask: n, cost });
    }
  }

  let goal: Entry | null = null;
  while (heap.size) {
    const cur = heap.pop()!;
    const ck = sk(cur.fam, cur.mask);
    if (cur.cost > (best.get(ck) ?? Infinity)) continue;
    if (isGoal(cur.fam, cur.mask)) {
      goal = cur;
      break;
    }
    for (const z of families) {
      if (!dex.canBeFemale(z.id) || !dex.canBeMale(z.id)) continue;
      if (z.id !== cur.fam && !dex.shareEggGroup(cur.fam, z.id)) continue;
      const inheritedMask = cur.mask & egg.get(z.id)!;
      const taughtMask = nat.get(z.id)! & ~inheritedMask;
      const mask = inheritedMask | taughtMask;
      if (mask === 0) continue;
      const hatch = dex.eggSpecies(z.id);
      let money = charge(rules, emptyMoney(), 'pokemon', 'acquireBase'); // la hembra
      const fee = genderFeeKey(dex.getSpecies(hatch).genderRatio, 'male');
      if (fee) money = charge(rules, money, 'breeding', fee);
      money = charge(rules, money, 'breeding', 'breedingFee');
      money = charge(rules, money, 'items', 'teachMove', popcount(taughtMask));
      const cost = cur.cost + weights.cross + weights.pokemon + weights.acquire + moneyCost(weights, money);
      const k = sk(z.id, mask);
      if (cost < (best.get(k) ?? Infinity) - 1e-9) {
        best.set(k, cost);
        prev.set(k, {
          from: ck,
          link: {
            fatherFamily: cur.fam,
            fatherSpecies: dex.getFamily(cur.fam).firstBreedable ?? cur.fam,
            motherFamily: z.id,
            motherSpecies: dex.getFamily(z.id).firstBreedable ?? z.id,
            childSpecies: hatch,
            childFamily: z.id,
            inherited: bits(inheritedMask),
            taught: bits(taughtMask),
          },
          money,
        });
        heap.push({ fam: z.id, mask, cost });
      }
    }
  }
  if (!goal) return null;

  // Reconstrucción
  const chainKeys: string[] = [];
  let k: string | null = sk(goal.fam, goal.mask);
  while (k) {
    chainKeys.unshift(k);
    k = prev.get(k)!.from;
  }
  const first = chainKeys[0];
  const [startFam, startMask] = first.split(':').map(Number);
  let money = prev.get(first)!.money;
  const links: ChainLink[] = [];
  let fatherMoves = bits(startMask);
  for (const key of chainKeys.slice(1)) {
    const p = prev.get(key)!;
    money = addMoney(money, p.money);
    const childMoves = [...p.link!.inherited, ...p.link!.taught].sort((a, b) => moves.indexOf(a) - moves.indexOf(b));
    links.push({ ...p.link!, fatherMoves, childMoves });
    fatherMoves = childMoves;
  }
  const finalFam = goal.fam;
  return {
    start: { familyId: startFam, speciesId: dex.getFamily(startFam).firstBreedable ?? startFam, taught: bits(startMask) },
    links,
    familyId: finalFam,
    speciesId: links.length ? links[links.length - 1].childSpecies : dex.getFamily(finalFam).firstBreedable ?? finalFam,
    moves: [...moves],
    cost: goal.cost,
    money,
    crosses: links.length,
    pokemon: links.length + 1,
  };
}

export { MinHeap };
