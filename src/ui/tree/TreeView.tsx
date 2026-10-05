import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { getDex } from '../../data/dex';
import { STATS, STAT_LABELS } from '../../data/models';
import type { BreedingSolution, DesiredPokemon, PlanNode } from '../../engine/types';
import { GenderLabel, Sprite } from '../components/common';
import { LEVEL_H, NODE_H, NODE_W, layoutTree } from './layout';
import { STATUS_META, ivStatus, ivText, ivTooltip, traitPath, type Trait } from './status';

const dex = getDex();

interface Props {
  sol: BreedingSolution;
  desired: DesiredPokemon;
  selected: string | null;
  onSelect: (id: string) => void;
}

const SOURCE_LABEL: Record<PlanNode['source'], string> = {
  owned: 'Colección',
  acquired: 'Conseguir',
  bred: 'Criado',
  chain: 'Cadena',
};

export function nodeName(n: PlanNode): string {
  return `${dex.speciesName(n.speciesId)} ${n.gender === 'male' ? '♂' : n.gender === 'female' ? '♀' : ''}`.trim();
}

/** Vista interactiva del árbol (requisito 10): zoom, pan, contraer ramas y resaltar orígenes. */
export function TreeView({ sol, desired, selected, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [view, setView] = useState({ x: 20, y: 60, k: 1 });
  const [trait, setTrait] = useState<string>('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const layout = useMemo(() => layoutTree(sol, collapsed), [sol, collapsed]);
  const pos = useMemo(() => new Map(layout.nodes.map((n) => [n.id, n])), [layout]);

  const traitObj: Trait | null = useMemo(() => {
    if (!trait) return null;
    const [kind, v] = trait.split(':');
    if (kind === 'iv') return { kind: 'iv', stat: v as never };
    if (kind === 'move') return { kind: 'move', moveId: Number(v) };
    return { kind: kind as 'nature' | 'ha' };
  }, [trait]);
  const hl = useMemo(() => (traitObj ? traitPath(sol, traitObj) : null), [sol, traitObj]);

  const fit = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const w = el.clientWidth;
    const h = el.clientHeight - 50;
    const k = Math.min(1.1, Math.max(0.12, Math.min(w / (layout.width + 40), h / (layout.height + 20))));
    setView({ k, x: (w - layout.width * k) / 2, y: 56 });
  }, [layout.width, layout.height]);

  useEffect(() => {
    setCollapsed(new Set());
    setTrait('');
  }, [sol.id]);
  useEffect(() => {
    fit();
  }, [fit, sol.id]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setView((v) => {
        const k = Math.min(2.5, Math.max(0.08, v.k * (e.deltaY < 0 ? 1.12 : 1 / 1.12)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest('button, select, .node')) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const zoom = (f: number) =>
    setView((v) => {
      const el = wrapRef.current!;
      const cx = el.clientWidth / 2;
      const cy = el.clientHeight / 2;
      const k = Math.min(2.5, Math.max(0.08, v.k * f));
      return { k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k };
    });

  const collapseAll = (depth: number) => {
    const s = new Set<string>();
    for (const n of layoutTree(sol, new Set()).nodes) if (n.depth >= depth && n.hasParents) s.add(n.id);
    setCollapsed(s);
  };

  const root = sol.nodes[sol.rootId];
  const targetStats = STATS.filter((s) => desired.ivs[s]);

  return (
    <div>
      <div
        ref={wrapRef}
        className={`tree-wrap ${dragging ? 'dragging' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="tree-toolbar">
          <button className="btn sm" onClick={() => zoom(1.25)} title="Acercar" aria-label="Acercar">
            ＋
          </button>
          <button className="btn sm" onClick={() => zoom(0.8)} title="Alejar" aria-label="Alejar">
            －
          </button>
          <button className="btn sm" onClick={fit}>
            Ajustar
          </button>
          <button className="btn sm" onClick={() => setCollapsed(new Set())}>
            Expandir todo
          </button>
          <button className="btn sm" onClick={() => collapseAll(2)}>
            Contraer a 2 niveles
          </button>
          <select className="input" style={{ padding: '3px 6px', fontSize: 12 }} value={trait} onChange={(e) => setTrait(e.target.value)} aria-label="Resaltar origen">
            <option value="">Resaltar origen de…</option>
            {targetStats.map((s) => (
              <option key={s} value={`iv:${s}`}>
                IV {STAT_LABELS[s].short}
              </option>
            ))}
            {root.nature && <option value="nature">Naturaleza ({root.nature})</option>}
            {root.hiddenAbility !== 'no' && <option value="ha">Habilidad Oculta</option>}
            {root.eggMoves.map((m) => (
              <option key={m} value={`move:${m}`}>
                Movimiento {dex.moveName(m)}
              </option>
            ))}
          </select>
          <span className="badge" style={{ marginLeft: 'auto' }}>
            {Math.round(view.k * 100)} %
          </span>
        </div>
        <div className="tree-canvas" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`, width: layout.width, height: layout.height }}>
          <svg className="tree-edges" width={layout.width} height={layout.height}>
            {layout.edges.map((e) => {
              const a = pos.get(e.from)!;
              const b = pos.get(e.to)!;
              const x1 = a.x + NODE_W / 2;
              const y1 = a.y + NODE_H;
              const x2 = b.x + NODE_W / 2;
              const y2 = b.y;
              const my = (y1 + y2) / 2;
              const on = hl?.has(e.from) && hl.has(e.to);
              return <path key={`${e.from}-${e.to}`} className={on ? 'hl' : ''} d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`} />;
            })}
          </svg>
          {layout.nodes
            .filter((ln) => ln.hasParents && !ln.collapsed)
            .map((ln) => {
              const n = sol.nodes[ln.id];
              return (
                <span key={`x${ln.id}`} className="cross-label" style={{ left: ln.x + NODE_W / 2, top: ln.y + NODE_H + (LEVEL_H - NODE_H) / 2 }}>
                  Paso {n.step}
                </span>
              );
            })}
          {layout.nodes.map((ln) => {
            const n = sol.nodes[ln.id];
            return (
              <NodeCard
                key={ln.id}
                n={n}
                sol={sol}
                desired={desired}
                x={ln.x}
                y={ln.y}
                selected={selected === n.id}
                highlighted={!!hl?.has(n.id)}
                dimmed={!!hl && !hl.has(n.id)}
                collapsed={ln.collapsed}
                onSelect={() => onSelect(n.id)}
                onToggle={
                  ln.hasParents
                    ? () =>
                        setCollapsed((c) => {
                          const s = new Set(c);
                          if (s.has(n.id)) s.delete(n.id);
                          else s.add(n.id);
                          return s;
                        })
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
      <Legend />
    </div>
  );
}

function NodeCard(props: {
  n: PlanNode;
  sol: BreedingSolution;
  desired: DesiredPokemon;
  x: number;
  y: number;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  collapsed: boolean;
  onSelect: () => void;
  onToggle?: () => void;
}) {
  const { n, sol, desired } = props;
  const cls = ['node', props.selected && 'sel', props.highlighted && 'hl', props.dimmed && 'dim', n.source === 'owned' && 'owned', n.mandatory && 'mandatory', n.role === 'root' && 'root']
    .filter(Boolean)
    .join(' ');
  return (
    <div
      className={cls}
      style={{ left: props.x, top: props.y, height: NODE_H }}
      onClick={props.onSelect}
      role="button"
      tabIndex={0}
      aria-label={`${nodeName(n)}, ${SOURCE_LABEL[n.source]}`}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && props.onSelect()}
    >
      <div className="node-head">
        <Sprite id={n.speciesId} shiny={n.shiny} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="name">
            {dex.speciesName(n.speciesId)} <GenderLabel gender={n.gender} />
          </div>
          <div className="row" style={{ gap: 3 }}>
            <span className="badge" title="Origen del Pokémon">
              {n.role === 'root' ? 'FINAL' : n.mandatory ? 'OBLIGATORIO' : SOURCE_LABEL[n.source]}
            </span>
            {n.notes.some((x) => /[Ee]volucionar/.test(x)) && (
              <span className="badge" title={n.notes.join('\n')}>
                evolucionar
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="node-ivs">
        {STATS.map((s) => {
          const st = ivStatus(n, s, desired);
          const meta = STATUS_META[st];
          return (
            <div key={s} className={`iv-cell ${meta.cls}`} title={ivTooltip(n, s, desired, sol, nodeName)}>
              {STAT_LABELS[s].short}
              <b>
                {ivText(n, s)}
                {meta.icon && <span aria-hidden> {meta.icon}</span>}
              </b>
            </div>
          );
        })}
      </div>
      <div className="node-line">
        {n.nature && (
          <span className={`st ${n.natureSource || n.contributes.nature ? 'st-special' : 'st-none'}`} title="Naturaleza">
            {n.nature}
          </span>
        )}
        {n.hiddenAbility !== 'no' && (
          <span className="st st-special" title={n.hiddenAbility === 'chance' ? 'HA posible (probabilidad desconocida, R44)' : 'Tiene Habilidad Oculta'}>
            ◆ HA{n.hiddenAbility === 'chance' ? '?' : ''}
          </span>
        )}
        {n.eggMoves
          .filter((m) => n.source !== 'owned' || n.contributes.eggMoves.includes(m))
          .slice(0, 3)
          .map((m) => (
            <span key={m} className="st st-special" title="Movimiento huevo">
              ◆ {dex.moveName(m)}
            </span>
          ))}
      </div>
      {n.heldItem && (
        <div className="node-item" title={n.heldItem.reason}>
          🎒 {n.heldItem.name}
        </div>
      )}
      {props.onToggle && (
        <button
          className="collapse-btn"
          title={props.collapsed ? 'Expandir rama' : 'Contraer rama'}
          aria-label={props.collapsed ? 'Expandir rama' : 'Contraer rama'}
          onClick={(e) => {
            e.stopPropagation();
            props.onToggle!();
          }}
        >
          {props.collapsed ? '+' : '−'}
        </button>
      )}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend small">
      {(['ok', 'new', 'inh', 'pend', 'special'] as const).map((k) => (
        <span key={k} className={`st ${STATUS_META[k].cls}`}>
          {STATUS_META[k].icon} {STATUS_META[k].label}
        </span>
      ))}
      <span className="badge">Borde verde: de tu colección · Borde morado: OBLIGATORIO</span>
    </div>
  );
}
