/**
 * Búsqueda del árbol de crianza.
 *
 * El problema es una planificación AND-OR: cada requisito abierto se puede satisfacer con
 * un Pokémon de la colección, consiguiéndolo, con una cadena de movimientos o criándolo
 * (lo que abre dos requisitos más pequeños).
 *
 * - `relaxed(req)`: programación dinámica con memo sobre el problema relajado (la colección
 *   tiene cantidad infinita y se ignoran los obligatorios). Es una cota inferior admisible.
 * - `search()`: A* sobre árboles parciales. El estado incluye los requisitos abiertos y el uso
 *   de la colección (cada Pokémon se consume, R01). f = g + w·h, con h = Σ relaxed(abiertos)
 *   + penalización por obligatorios que ya no pueden colocarse. Con w = 1 la primera solución
 *   es óptima para la función de coste; si se agota el presupuesto se reintenta con w > 1.
 */
import type { EngineContext } from './context';
import { MinHeap } from './eggMoveChain';
import { ownedOptions, staticOptions, type Option, type StaticOption } from './options';
import { couldContribute, reqKey, type Req } from './requirement';

export interface Decision {
  nodeId: number;
  req: Req;
  option: Option;
  childIds: number[];
}

interface DecisionList {
  d: Decision;
  prev: DecisionList | null;
}

interface OpenReq {
  id: number;
  req: Req;
}

interface State {
  cost: number; // f (para el heap)
  g: number;
  open: OpenReq[];
  usage: Record<string, number>;
  decisions: DecisionList | null;
  nextId: number;
  seq: number;
}

export interface SearchSolution {
  decisions: Decision[];
  g: number;
  mandatoryMissing: string[];
  optimal: boolean;
}

export interface SearchResult {
  solutions: SearchSolution[];
  expansions: number;
  exhausted: boolean;
}

export const MANDATORY_PENALTY = 10000;

export class Searcher {
  private optCache = new Map<string, StaticOption[]>();
  private ownedCache = new Map<string, ReturnType<typeof ownedOptions>>();
  /** Memo de `relaxed` por conjunto de Pokémon de la colección ya agotados. */
  private memos = new Map<string, Map<string, number>>();
  private inProgress = new Set<string>();
  private exhausted: Set<string> = new Set();
  private memo: Map<string, number> = new Map();

  constructor(
    readonly ctx: EngineContext,
    readonly mandatoryIds: string[],
  ) {}

  staticOptionsFor(req: Req): StaticOption[] {
    const k = reqKey(req);
    let o = this.optCache.get(k);
    if (!o) {
      o = staticOptions(this.ctx, req);
      this.optCache.set(k, o);
    }
    return o;
  }

  ownedFor(req: Req): ReturnType<typeof ownedOptions> {
    const k = reqKey(req);
    let o = this.ownedCache.get(k);
    if (!o) {
      o = ownedOptions(this.ctx, req);
      this.ownedCache.set(k, o);
    }
    return o;
  }

  /** Fija qué Pokémon de la colección están agotados (la heurística deja de contar con ellos). */
  private setExhausted(usage: Record<string, number>): void {
    const ids = Object.keys(usage).filter((id) => usage[id] >= this.ctx.ownedById.get(id)!.quantity).sort();
    const key = ids.join(',');
    let memo = this.memos.get(key);
    if (!memo) this.memos.set(key, (memo = new Map()));
    this.memo = memo;
    this.exhausted = new Set(ids);
  }

  /** Coste mínimo relajado de satisfacer `req` (Infinity si es imposible). */
  relaxed(req: Req): number {
    const k = reqKey(req);
    const m = this.memo.get(k);
    if (m !== undefined) return m;
    if (this.inProgress.has(k)) return Infinity;
    this.inProgress.add(k);
    let best = Infinity;
    for (const o of this.ownedFor(req)) if (!this.exhausted.has(o.ownedId)) best = Math.min(best, o.cost);
    for (const o of this.staticOptionsFor(req)) {
      if (o.cost >= best) continue;
      if (o.kind !== 'breed') {
        best = Math.min(best, o.cost);
        continue;
      }
      const a = this.relaxed(o.parents[0].req);
      if (o.cost + a >= best) continue;
      const b = this.relaxed(o.parents[1].req);
      best = Math.min(best, o.cost + a + b);
    }
    this.inProgress.delete(k);
    this.memo.set(k, best);
    return best;
  }

  private mandatoryPenalty(open: OpenReq[], usage: Record<string, number>): number {
    let n = 0;
    for (const id of this.mandatoryIds) {
      if (usage[id]) continue;
      const m = this.ctx.ownedById.get(id)!;
      if (!open.some((o) => couldContribute(this.ctx.dex, m, o.req))) n++;
    }
    return n * MANDATORY_PENALTY;
  }

  private missingMandatory(usage: Record<string, number>): string[] {
    return this.mandatoryIds.filter((id) => !usage[id]);
  }

  search(root: Req, opts: { maxExpansions: number; maxSolutions: number; weight: number; upperBound?: number }): SearchResult {
    const ub = opts.upperBound ?? Infinity;
    // Poda por dominancia: mismo conjunto de requisitos abiertos y mismo uso de la colección.
    const closed = new Map<string, number>();
    const frontierKey = (open: OpenReq[], usage: Record<string, number>) =>
      open.map((o) => reqKey(o.req)).sort().join(';') + '#' + Object.entries(usage).sort().map(([k, v]) => `${k}${v}`).join(',');
    this.setExhausted({});
    const hRoot = this.relaxed(root);
    if (!isFinite(hRoot)) return { solutions: [], expansions: 0, exhausted: true };
    // Empates: primero el estado más profundo (mayor g) para llegar antes a una solución.
    const heap = new MinHeap<State>((a, b) => a.cost < b.cost - 1e-9 || (Math.abs(a.cost - b.cost) <= 1e-9 && (a.g > b.g || (a.g === b.g && a.seq < b.seq))));
    let seq = 0;
    const w = opts.weight;
    const initialOpen = [{ id: 0, req: root }];
    const h0 = hRoot + this.mandatoryPenalty(initialOpen, {});
    heap.push({ cost: w * h0, g: 0, open: initialOpen, usage: {}, decisions: null, nextId: 1, seq: seq++ });
    const solutions: SearchSolution[] = [];
    const signatures = new Set<string>();
    let expansions = 0;
    let extraBudget = Infinity;

    while (heap.size) {
      const s = heap.pop()!;
      if (s.open.length === 0) {
        const decisions = listToArray(s.decisions);
        const sig = solutionSignature(decisions);
        if (!signatures.has(sig)) {
          signatures.add(sig);
          solutions.push({ decisions, g: s.g, mandatoryMissing: this.missingMandatory(s.usage), optimal: w === 1 && solutions.length === 0 });
          if (solutions.length >= opts.maxSolutions) break;
          if (extraBudget === Infinity) extraBudget = expansions + Math.max(2000, opts.maxExpansions * 0.25);
        }
        continue;
      }
      if (++expansions > opts.maxExpansions || expansions > extraBudget) break;
      const fk = frontierKey(s.open, s.usage);
      const prevG = closed.get(fk);
      if (prevG !== undefined && prevG <= s.g + 1e-9) continue;
      closed.set(fk, s.g);

      const cur = s.open[s.open.length - 1];
      const rest = s.open.slice(0, -1);

      const push = (option: Option, children: Req[], usage: Record<string, number>) => {
        this.setExhausted(usage);
        const restH = rest.reduce((acc, o) => acc + this.relaxed(o.req), 0);
        const childOpen = children.map((req, i) => ({ id: s.nextId + i, req }));
        let h = restH;
        for (const c of childOpen) {
          h += this.relaxed(c.req);
          if (!isFinite(h)) return;
        }
        const open = [...rest, ...childOpen];
        const g = s.g + option.cost;
        const pen = this.mandatoryPenalty(open, usage);
        // En un estado final la penalización se convierte en coste real.
        const gFinal = open.length === 0 ? g + pen : g;
        if (gFinal + (open.length === 0 ? 0 : h + pen) > ub + 1e-6) return;
        heap.push({
          cost: gFinal + w * (open.length === 0 ? 0 : h + pen),
          g: gFinal,
          open,
          usage,
          decisions: { d: { nodeId: cur.id, req: cur.req, option, childIds: childOpen.map((c) => c.id) }, prev: s.decisions },
          nextId: s.nextId + childOpen.length,
          seq: seq++,
        });
      };

      for (const o of this.ownedFor(cur.req)) {
        const m = this.ctx.ownedById.get(o.ownedId)!;
        const used = s.usage[o.ownedId] ?? 0;
        if (used >= m.quantity) continue;
        push(o, [], { ...s.usage, [o.ownedId]: used + 1 });
      }
      for (const o of this.staticOptionsFor(cur.req)) {
        if (o.kind === 'breed') push(o, [o.parents[0].req, o.parents[1].req], s.usage);
        else push(o, [], s.usage);
      }
    }
    return { solutions, expansions, exhausted: heap.size === 0 };
  }
}

function listToArray(l: DecisionList | null): Decision[] {
  const out: Decision[] = [];
  while (l) {
    out.push(l.d);
    l = l.prev;
  }
  return out.reverse();
}

/** Firma para descartar soluciones equivalentes (mismos recursos y misma forma). */
export function solutionSignature(ds: Decision[]): string {
  const parts = ds.map((d) => {
    const o = d.option;
    if (o.kind === 'owned') return `O${o.ownedId}`;
    if (o.kind === 'acquire') return `A${o.familyId}`;
    if (o.kind === 'chain') return `C${o.chain.crosses}`;
    return `B${o.familyId}${o.pairKind[0]}`;
  });
  return parts.sort().join(',');
}
