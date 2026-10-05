/**
 * Generación de opciones para satisfacer un requisito:
 *  - usar un Pokémon de la colección,
 *  - conseguir (capturar/comprar) un Pokémon sencillo,
 *  - una cadena de movimientos huevo,
 *  - criarlo a partir de dos progenitores (con objetos y reparto de características).
 * Todas las reglas usadas están en docs/POKEMMO_BREEDING_RULES.md.
 */
import type { StatKey } from '../data/models';
import { braceFor, ITEM_BY_ID } from '../data/items';
import { STAT_LABELS } from '../data/models';
import type { EngineContext } from './context';
import { charge, emptyMoney, moneyCost } from './cost';
import { findEggMoveChain, type ChainResult } from './eggMoveChain';
import { matchOwned, reqKey, reqMeasure, reqStats, withoutStat, type Req, type SpeciesConstraint } from './requirement';
import { genderFeeKey } from './rules/inheritance';
import type { MoneyBreakdown, NodeRole } from './types';

export interface ItemUse {
  itemId: string;
  reason: string;
}

export interface ParentPlan {
  req: Req;
  role: NodeRole;
  item: ItemUse | null;
  braced: StatKey | null;
  carries: { nature: boolean; ha: boolean; moves: boolean; incense: boolean; lightBall: boolean };
}

export type Option =
  | { kind: 'owned'; ownedId: string; cost: number; money: MoneyBreakdown; notes: string[] }
  | { kind: 'acquire'; cost: number; money: MoneyBreakdown; speciesId: number; familyId: number; description: string }
  | { kind: 'chain'; cost: number; money: MoneyBreakdown; chain: ChainResult }
  | {
      kind: 'breed';
      cost: number;
      money: MoneyBreakdown;
      familyId: number;
      hatchSpecies: number;
      pairKind: 'standard' | 'ditto' | 'genderless';
      parents: [ParentPlan, ParentPlan];
      taughtMoves: number[];
    };

export type StaticOption = Exclude<Option, { kind: 'owned' }>;

// ------------------------------------------------------------------ owned

export function ownedOptions(ctx: EngineContext, req: Req): Extract<Option, { kind: 'owned' }>[] {
  const out: Extract<Option, { kind: 'owned' }>[] = [];
  for (const m of ctx.owned) {
    const r = matchOwned(ctx.dex, m, req);
    if (!r.ok) continue;
    const money = emptyMoney();
    money.pokemon = m.value ?? 0;
    out.push({
      kind: 'owned',
      ownedId: m.id,
      cost: ctx.weights.pokemon + ctx.weights.ownedUse + moneyCost(ctx.weights, money),
      money,
      notes: r.notes,
    });
  }
  return out;
}

// ------------------------------------------------------------------ acquire

function acquireOption(ctx: EngineContext, req: Req): StaticOption | null {
  const { dex, rules, weights } = ctx;
  if (req.shiny || req.moves.length || req.incense || req.lightBall) return null;
  const features = reqStats(req).length + (req.nature ? 1 : 0) + (req.ha ? 1 : 0);
  if (features > 1) return null;
  let familyId: number;
  let speciesId: number;
  const c = req.species;
  if (c.kind === 'ditto') {
    if (!ctx.options.allowDitto || req.ha) return null;
    familyId = 132;
    speciesId = 132;
  } else {
    if (c.kind === 'family') familyId = c.familyId;
    else {
      const f = dex.canBeMale(c.familyId) && !dex.isGenderlessFamily(c.familyId) ? c.familyId : ctx.fillerFamilyFor(c.familyId);
      if (f === null) return null;
      familyId = f;
    }
    const fam = dex.getFamily(familyId);
    speciesId = c.kind === 'family' && c.speciesIds ? c.speciesIds[0] : fam.firstBreedable ?? familyId;
    if (req.gender === 'male' && !dex.canBeMale(familyId)) return null;
    if (req.gender === 'female' && !dex.canBeFemale(familyId)) return null;
    if (req.ha && !fam.members.some((m) => dex.getSpecies(m).abilities.hidden)) return null;
  }
  const key = c.kind === 'ditto' ? 'acquireDitto' : req.ha ? 'acquireHiddenAbility' : req.nature ? 'acquireNatured' : 'acquireBase';
  const money = charge(rules, emptyMoney(), 'pokemon', key);
  const what = req.ha ? 'con Habilidad Oculta' : req.nature ? `de naturaleza ${req.nature}` : features ? 'con el IV indicado' : 'cualquiera';
  return {
    kind: 'acquire',
    cost: weights.pokemon + weights.acquire + moneyCost(weights, money),
    money,
    speciesId,
    familyId,
    description: `Conseguir ${dex.speciesName(speciesId)} ${what}`,
  };
}

// ------------------------------------------------------------------ chain

function chainOption(ctx: EngineContext, req: Req): StaticOption | null {
  if (!req.moves.length || reqStats(req).length || req.nature || req.ha || req.shiny || req.incense || req.lightBall) return null;
  if (req.gender === 'female' || req.species.kind === 'ditto') return null;
  const chain = findEggMoveChain(ctx, req.moves, req.species);
  if (!chain) return null;
  return { kind: 'chain', cost: chain.cost, money: chain.money, chain };
}

// ------------------------------------------------------------------ breed

function candidateFamilies(ctx: EngineContext, c: Exclude<SpeciesConstraint, { kind: 'ditto' }>, moves: number[]): number[] {
  const { dex } = ctx;
  if (c.kind === 'family') return [c.familyId];
  const out: number[] = [];
  const F = c.familyId;
  const ok = (f: number) => dex.canBeMale(f) && !dex.isGenderlessFamily(f) && !dex.isDittoFamily(f) && (f === F || dex.shareEggGroup(f, F));
  if (ok(F)) out.push(F);
  else {
    const filler = ctx.fillerFamilyFor(F);
    if (filler !== null) out.push(filler);
    // Si el macho debe llevar movimientos, también familias capaces de llevarlos.
    if (moves.length) for (const f of ctx.moveCarrierFamilies(F, moves)) if (!out.includes(f)) out.push(f);
  }
  for (const m of ctx.owned) {
    const f = dex.familyIdOf(m.speciesId);
    if (!out.includes(f) && ok(f)) out.push(f);
  }
  return out;
}

interface Slot {
  role: NodeRole;
  species: SpeciesConstraint;
  gender: Req['gender'];
  /** Puede llevar características que pasan "por especie" (HA, incienso, Light Ball). */
  sameFamily: boolean;
  /** Puede transmitir movimientos huevo. */
  canPassMoves: boolean;
  isDitto: boolean;
}

type Special = 'nature' | 'incense' | 'lightBall';

/** Requisito que sólo pide movimientos huevo (lo resuelve la búsqueda de cadenas). */
export function isPureMoves(r: Req): boolean {
  return r.moves.length > 0 && reqStats(r).length === 0 && !r.nature && !r.ha && !r.incense && !r.lightBall;
}

function breedOptions(ctx: EngineContext, req: Req): StaticOption[] {
  const { dex, rules, weights } = ctx;
  if (req.species.kind === 'ditto') return [];
  // Un macho compatible que sólo necesita movimientos se obtiene con una cadena (R50).
  if (req.species.kind === 'compatible' && isPureMoves(req)) return [];
  const out: StaticOption[] = [];
  const stats = reqStats(req);
  const measure = reqMeasure(req);
  const key = reqKey(req);
  // Terminación: cada progenitor debe ser estrictamente "más pequeño", salvo el padre que sólo
  // lleva los movimientos (que no se vuelve a dividir con la misma clave).
  const smaller = (p: Req) => {
    const m = reqMeasure(p);
    return m < measure || (m === measure && isPureMoves(p) && reqKey(p) !== key);
  };

  for (const Y of candidateFamilies(ctx, req.species, req.moves)) {
    const fam = dex.getFamily(Y);
    if (!fam.canBreed || dex.isDittoFamily(Y)) continue;
    if (req.gender === 'male' && !dex.canBeMale(Y)) continue;
    if (req.gender === 'female' && !dex.canBeFemale(Y)) continue;
    const genderless = dex.isGenderlessFamily(Y);
    if (genderless && req.gender !== 'any') continue;
    if (req.incense && !fam.incense) continue;
    const hatch = dex.eggSpecies(Y, req.incense);
    const speciesIds = req.species.kind === 'family' ? req.species.speciesIds : null;
    // El huevo debe poder convertirse en la especie exacta pedida (p. ej. Pikachu portador de Light Ball).
    if (speciesIds && !speciesIds.some((sp) => dex.canBecome(hatch, sp))) continue;

    // Movimientos: heredables por la especie del huevo o enseñables a la familia.
    const eggList = dex.eggMovesOf(hatch);
    const natural = dex.naturalMoves(Y);
    const inheritMoves = req.moves.filter((m) => eggList.includes(m));
    const taughtMoves = req.moves.filter((m) => !eggList.includes(m) && natural.has(m));
    if (inheritMoves.length + taughtMoves.length < req.moves.length) continue;

    // Pares posibles (R03-R05)
    const pairs: { kind: 'standard' | 'ditto' | 'genderless'; slots: [Slot, Slot] }[] = [];
    const famC: SpeciesConstraint = { kind: 'family', familyId: Y, speciesIds: null };
    if (genderless) {
      pairs.push({
        kind: 'genderless',
        slots: [
          { role: 'partner', species: famC, gender: 'any', sameFamily: true, canPassMoves: false, isDitto: false },
          { role: 'partner', species: famC, gender: 'any', sameFamily: true, canPassMoves: false, isDitto: false },
        ],
      });
    } else if (dex.canBeFemale(Y)) {
      const mother: Slot = { role: 'mother', species: famC, gender: 'female', sameFamily: true, canPassMoves: rules.mechanics.eggMovesFromMother, isDitto: false };
      pairs.push({
        kind: 'standard',
        slots: [mother, { role: 'father', species: { kind: 'compatible', familyId: Y }, gender: 'male', sameFamily: false, canPassMoves: true, isDitto: false }],
      });
      if (dex.canBeMale(Y) && (req.ha || req.lightBall)) {
        pairs.push({
          kind: 'standard',
          slots: [mother, { role: 'father', species: famC, gender: 'male', sameFamily: true, canPassMoves: true, isDitto: false }],
        });
      }
    }
    if (ctx.options.allowDitto || ctx.owned.some((m) => dex.isDittoFamily(dex.familyIdOf(m.speciesId)))) {
      pairs.push({
        kind: 'ditto',
        slots: [
          { role: 'partner', species: famC, gender: inheritMoves.length && !genderless ? 'male' : 'any', sameFamily: true, canPassMoves: !genderless && dex.canBeMale(Y), isDitto: false },
          { role: 'ditto', species: { kind: 'ditto' }, gender: 'any', sameFamily: false, canPassMoves: false, isDitto: true },
        ],
      });
    }

    // Coste fijo del cruce (R60-R64)
    let baseMoney = charge(rules, emptyMoney(), 'breeding', 'breedingFee');
    const feeKey = genderFeeKey(dex.getSpecies(hatch).genderRatio, req.gender);
    if (feeKey) baseMoney = charge(rules, baseMoney, 'breeding', feeKey);
    baseMoney = charge(rules, baseMoney, 'items', 'teachMove', taughtMoves.length);

    for (const pair of pairs) {
      const [s1, s2] = pair.slots;
      if (inheritMoves.length && !s1.canPassMoves && !s2.canPassMoves) continue;
      // Reparto de características especiales entre los dos progenitores.
      const specials: Special[] = [];
      if (req.nature) specials.push('nature');
      if (req.incense) specials.push('incense');
      if (req.lightBall) specials.push('lightBall');
      const haChoices: (0 | 1 | null)[] = req.ha ? ([0, 1] as const).filter((i) => pair.slots[i].sameFamily) : [null];
      // Reparto de movimientos: normalmente todos en el padre (R50). Con la opción experimental R52
      // también se pueden repartir entre madre y padre.
      const moveChoices: [number[], number[]][] = [];
      if (!inheritMoves.length) moveChoices.push([[], []]);
      else {
        const n = inheritMoves.length;
        for (let mask = 0; mask < 1 << n; mask++) {
          const a = inheritMoves.filter((_, i) => mask & (1 << i));
          const b = inheritMoves.filter((_, i) => !(mask & (1 << i)));
          if (a.length && !pair.slots[0].canPassMoves) continue;
          if (b.length && !pair.slots[1].canPassMoves) continue;
          moveChoices.push([a, b]);
        }
      }
      for (const assign of assignSpecials(specials, pair.slots)) {
        for (const haAt of haChoices) {
          for (const mvSplit of moveChoices) {
            const free = [assign[0].length === 0, assign[1].length === 0];
            const braceOpts0: (StatKey | null)[] = free[0] ? [...stats, null] : [null];
            const braceOpts1: (StatKey | null)[] = free[1] ? [...stats, null] : [null];
            for (const b0 of braceOpts0) {
              for (const b1 of braceOpts1) {
                if (b0 && b0 === b1) continue;
                const parents = [0, 1].map((i) => {
                  const slot = pair.slots[i];
                  const mine = assign[i];
                  const braced = i === 0 ? b0 : b1;
                  const otherBrace = i === 0 ? b1 : b0;
                  let species = slot.species;
                  if (species.kind === 'family' && (mine.includes('incense') || mine.includes('lightBall'))) {
                    const holders = mine.includes('incense') ? fam.incense!.holders : [25];
                    species = { kind: 'family', familyId: Y, speciesIds: holders };
                  }
                  const preq: Req = {
                    ivs: withoutStat(req.ivs, otherBrace),
                    nature: mine.includes('nature') ? req.nature : null,
                    moves: mvSplit[i],
                    ha: haAt === i,
                    gender: slot.gender === 'any' && mvSplit[i].length && !slot.isDitto && pair.kind === 'ditto' ? 'male' : slot.gender,
                    species,
                    shiny: req.shiny,
                    incense: false,
                    lightBall: false,
                  };
                  let item: ItemUse | null = null;
                  if (mine.includes('nature')) item = { itemId: 'everstone', reason: `Transmite la naturaleza ${req.nature} (R30)` };
                  else if (mine.includes('incense')) item = { itemId: fam.incense!.itemId, reason: `Permite el huevo de ${dex.speciesName(fam.incense!.babySpecies)} (R09)` };
                  else if (mine.includes('lightBall')) item = { itemId: 'light-ball', reason: 'Volt Tackle para el Pichu (R55)' };
                  else if (braced) item = { itemId: braceFor(braced).id, reason: `Fuerza el IV de ${STAT_LABELS[braced].name} (R21)` };
                  const pp: ParentPlan = {
                    req: preq,
                    role: slot.role,
                    item,
                    braced,
                    carries: {
                      nature: mine.includes('nature'),
                      ha: haAt === i,
                      moves: mvSplit[i].length > 0,
                      incense: mine.includes('incense'),
                      lightBall: mine.includes('lightBall'),
                    },
                  };
                  return pp;
                }) as [ParentPlan, ParentPlan];
                if (!parents.every((p) => smaller(p.req))) continue;
                let money = baseMoney;
                for (const p of parents) {
                  if (!p.item) continue;
                  const def = ITEM_BY_ID.get(p.item.itemId)!;
                  if (def.priceKey !== 'none') money = charge(rules, money, 'items', def.priceKey);
                }
                out.push({
                  kind: 'breed',
                  cost: weights.cross + moneyCost(weights, money),
                  money,
                  familyId: Y,
                  hatchSpecies: hatch,
                  pairKind: pair.kind,
                  parents,
                  taughtMoves,
                });
              }
            }
          }
        }
      }
    }
  }
  return out;
}

/** Reparte objetos especiales (Everstone, incienso, Light Ball) entre los dos progenitores; uno por Pokémon (R68). */
function assignSpecials(specials: Special[], slots: [Slot, Slot]): [Special[], Special[]][] {
  let acc: [Special[], Special[]][] = [[[], []]];
  for (const sp of specials) {
    const next: [Special[], Special[]][] = [];
    for (const a of acc) {
      for (const i of [0, 1] as const) {
        if (a[i].length) continue; // un objeto por Pokémon
        const slot = slots[i];
        if ((sp === 'incense' || sp === 'lightBall') && !slot.sameFamily) continue;
        const copy: [Special[], Special[]] = [[...a[0]], [...a[1]]];
        copy[i].push(sp);
        next.push(copy);
      }
    }
    acc = next;
  }
  return acc;
}

/** Opciones que no dependen del inventario (se cachean por requisito). */
export function staticOptions(ctx: EngineContext, req: Req): StaticOption[] {
  const out: StaticOption[] = [];
  const a = acquireOption(ctx, req);
  if (a) out.push(a);
  const c = chainOption(ctx, req);
  if (c) out.push(c);
  out.push(...breedOptions(ctx, req));
  return out;
}
