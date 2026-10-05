/**
 * Requisito = lo que debe cumplir un Pokémon en una posición del árbol.
 * Es el "estado" de la búsqueda: cada nodo del árbol satisface un requisito.
 */
import type { Dex } from '../data/dex';
import type { StatKey } from '../data/models';
import { STATS, STAT_LABELS } from '../data/models';
import type { IVInterval, OwnedPokemon } from './types';

export type SpeciesConstraint =
  /** Cualquier miembro de la familia (opcionalmente sólo ciertas especies exactas, p. ej. portadores de incienso). */
  | { kind: 'family'; familyId: number; speciesIds: number[] | null }
  /** Un macho de cualquier familia compatible (comparte grupo huevo) con `familyId`. */
  | { kind: 'compatible'; familyId: number }
  | { kind: 'ditto' };

export interface Req {
  ivs: Partial<Record<StatKey, IVInterval>>;
  nature: string | null;
  moves: number[];
  ha: boolean;
  gender: 'male' | 'female' | 'any';
  species: SpeciesConstraint;
  shiny: boolean;
  /** Sólo en la raíz: el cruce debe usar incienso para obtener el bebé (R09). */
  incense: boolean;
  /** Sólo en la raíz: el cruce debe usar Light Ball para Volt Tackle (R55). */
  lightBall: boolean;
}

export function reqStats(req: Req): StatKey[] {
  return STATS.filter((s) => req.ivs[s] !== undefined);
}

/** Tamaño del requisito: estrictamente decreciente en cada división (garantiza terminación). */
export function reqMeasure(req: Req): number {
  return (
    reqStats(req).length + (req.nature ? 1 : 0) + req.moves.length + (req.ha ? 1 : 0) + (req.incense ? 1 : 0) + (req.lightBall ? 1 : 0)
  );
}

export function speciesKey(c: SpeciesConstraint): string {
  if (c.kind === 'ditto') return 'D';
  if (c.kind === 'compatible') return `C${c.familyId}`;
  return `F${c.familyId}${c.speciesIds ? ':' + c.speciesIds.join('.') : ''}`;
}

export function reqKey(req: Req): string {
  const ivs = reqStats(req)
    .map((s) => `${s}${req.ivs[s]!.min}-${req.ivs[s]!.max}`)
    .join(',');
  return `${speciesKey(req.species)}|${req.gender}|${ivs}|${req.nature ?? ''}|${req.moves.join('.')}|${req.ha ? 1 : 0}|${req.shiny ? 1 : 0}|${req.incense ? 1 : 0}${req.lightBall ? 1 : 0}`;
}

export function withoutStat(ivs: Req['ivs'], stat: StatKey | null): Req['ivs'] {
  const out = { ...ivs };
  if (stat) delete out[stat];
  return out;
}

export function describeReq(dex: Dex, req: Req): string {
  const parts: string[] = [];
  const st = reqStats(req);
  if (st.length) {
    parts.push(
      st
        .map((s) => {
          const r = req.ivs[s]!;
          const v = r.min === r.max ? `${r.min}` : r.max === 31 ? `≥${r.min}` : `${r.min}-${r.max}`;
          return `${v} ${STAT_LABELS[s].short}`;
        })
        .join(' / '),
    );
  }
  if (req.nature) parts.push(req.nature);
  if (req.ha) parts.push('Habilidad Oculta');
  if (req.moves.length) parts.push(req.moves.map((m) => dex.moveName(m)).join(', '));
  return parts.join(' · ') || 'sin requisitos';
}

export interface MatchResult {
  ok: boolean;
  reason: string | null;
  notes: string[];
}

/** ¿Un Pokémon de la colección satisface el requisito? */
export function matchOwned(dex: Dex, m: OwnedPokemon, req: Req): MatchResult {
  const no = (reason: string): MatchResult => ({ ok: false, reason, notes: [] });
  const notes: string[] = [];
  if (m.status === 'forbidden') return no('Marcado como PROHIBIDO.');
  if (m.shiny !== req.shiny) return no(req.shiny ? 'El objetivo es shiny y este Pokémon no.' : 'Un shiny no puede criar con no shinies (R65).');
  const fam = dex.familyOf(m.speciesId);
  if (!fam.canBreed) return no(`${dex.speciesName(m.speciesId)} no puede criar (R06).`);
  const c = req.species;
  if (c.kind === 'ditto') {
    if (!dex.isDittoFamily(fam.id)) return no('Se necesita un Ditto.');
  } else if (dex.isDittoFamily(fam.id)) {
    return no('Aquí no sirve un Ditto.');
  } else if (c.kind === 'family') {
    if (fam.id !== c.familyId) return no(`Debe ser de la línea de ${dex.speciesName(c.familyId)}.`);
    if (c.speciesIds && !c.speciesIds.some((sp) => dex.canBecome(m.speciesId, sp))) {
      return no(`Debe ser ${c.speciesIds.map((s) => dex.speciesName(s)).join(' o ')}.`);
    }
    if (c.speciesIds && !c.speciesIds.includes(m.speciesId)) {
      notes.push(`Evolucionar a ${dex.speciesName(c.speciesIds.find((sp) => dex.canBecome(m.speciesId, sp))!)} antes de criar.`);
    }
  } else {
    if (!dex.canBeMale(fam.id) || dex.isGenderlessFamily(fam.id)) return no('Debe ser un macho de una especie compatible.');
    if (!dex.shareEggGroup(fam.id, c.familyId)) return no(`No comparte grupo huevo con ${dex.speciesName(c.familyId)}.`);
  }
  if (req.gender !== 'any' && m.gender !== req.gender) return no(`Debe ser ${req.gender === 'male' ? 'macho' : 'hembra'}.`);
  for (const s of reqStats(req)) {
    const r = req.ivs[s]!;
    const v = m.ivs[s];
    if (v < r.min || v > r.max) return no(`IV de ${STAT_LABELS[s].short} = ${v}, se necesita ${r.min === r.max ? r.min : `${r.min}-${r.max}`}.`);
  }
  if (req.nature && m.nature !== req.nature) return no(`Naturaleza ${m.nature}, se necesita ${req.nature}.`);
  for (const mv of req.moves) if (!m.moves.includes(mv)) return no(`No conoce ${dex.moveName(mv)}.`);
  if (req.ha && !m.hiddenAbility) return no('No tiene Habilidad Oculta.');
  if (!dex.speciesCanBreed(m.speciesId)) {
    const next = dex.getSpecies(m.speciesId).evolvesTo[0];
    notes.push(`Evolucionar${next ? ` a ${dex.speciesName(next.id)}` : ''} antes de criar (R08).`);
  }
  return { ok: true, reason: null, notes };
}

/**
 * Cota optimista: ¿podría un Pokémon de la colección usarse en algún punto del subárbol
 * que satisface `req`? (Se usa para la penalización de obligatorios en la heurística.)
 */
export function couldContribute(dex: Dex, m: OwnedPokemon, req: Req): boolean {
  if (m.shiny !== req.shiny) return false;
  const fam = dex.familyOf(m.speciesId);
  if (!fam.canBreed) return false;
  if (req.species.kind === 'ditto') return matchOwned(dex, m, req).ok;
  const target = req.species.familyId;
  if (!dex.isDittoFamily(fam.id) && fam.id !== target) {
    if (dex.isGenderlessFamily(fam.id) || dex.isGenderlessFamily(target)) return false;
    if (!dex.shareEggGroup(fam.id, target)) return false;
  }
  if (reqMeasure(req) === 0) return matchOwned(dex, m, req).ok;
  for (const s of reqStats(req)) {
    const r = req.ivs[s]!;
    if (m.ivs[s] >= r.min && m.ivs[s] <= r.max) return true;
  }
  if (req.nature && m.nature === req.nature) return true;
  if (req.moves.some((mv) => m.moves.includes(mv))) return true;
  if (req.ha && m.hiddenAbility && fam.id === target) return true;
  return false;
}
