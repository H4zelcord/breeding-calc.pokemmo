import type { BreedingSolution } from '../../engine/types';

export const NODE_W = 210;
export const NODE_H = 150;
export const GAP_X = 26;
export const LEVEL_H = 200;

export interface LaidNode {
  id: string;
  x: number;
  y: number;
  depth: number;
  collapsed: boolean;
  hasParents: boolean;
}

export interface Layout {
  nodes: LaidNode[];
  edges: { from: string; to: string }[];
  width: number;
  height: number;
}

/**
 * Árbol "de arriba abajo": el Pokémon final arriba y sus progenitores debajo.
 * Las hojas se colocan en orden y cada nodo se centra sobre sus progenitores.
 */
export function layoutTree(sol: BreedingSolution, collapsed: Set<string>): Layout {
  const nodes: LaidNode[] = [];
  const edges: { from: string; to: string }[] = [];
  let nextLeaf = 0;
  let maxDepth = 0;
  const place = (id: string, depth: number): number => {
    const n = sol.nodes[id];
    maxDepth = Math.max(maxDepth, depth);
    const hasParents = !!(n.parentA && n.parentB);
    const isCollapsed = hasParents && collapsed.has(id);
    let x: number;
    if (!hasParents || isCollapsed) {
      x = nextLeaf++ * (NODE_W + GAP_X);
    } else {
      const xa = place(n.parentA!, depth + 1);
      const xb = place(n.parentB!, depth + 1);
      edges.push({ from: id, to: n.parentA! }, { from: id, to: n.parentB! });
      x = (xa + xb) / 2;
    }
    nodes.push({ id, x, y: depth * LEVEL_H, depth, collapsed: isCollapsed, hasParents });
    return x;
  };
  place(sol.rootId, 0);
  return {
    nodes,
    edges,
    width: Math.max(1, nextLeaf) * (NODE_W + GAP_X),
    height: (maxDepth + 1) * LEVEL_H,
  };
}
