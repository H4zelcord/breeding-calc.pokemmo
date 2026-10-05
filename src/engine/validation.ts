/**
 * Validación previa (requisito 15). Nunca se genera un árbol si algo es imposible.
 */
import type { Dex } from '../data/dex';
import { itemName } from '../data/items';
import { STATS, STAT_LABELS } from '../data/models';
import { isValidNature } from '../data/natures';
import { couldContribute, matchOwned, type Req } from './requirement';
import type { BreedingRules } from './rules/config';
import type { DesiredPokemon, OwnedPokemon, PlanMessage } from './types';

export const VOLT_TACKLE = 344;
const NIDORAN_F = 29;
const ILLUMISE = 314;

export interface ValidationResult {
  errors: PlanMessage[];
  warnings: PlanMessage[];
  info: PlanMessage[];
}

export function validateDesired(dex: Dex, d: DesiredPokemon, rules: BreedingRules): ValidationResult {
  const errors: PlanMessage[] = [];
  const warnings: PlanMessage[] = [];
  const info: PlanMessage[] = [];
  const err = (code: string, message: string, detail?: string) => errors.push({ code, message, detail });

  const sp = dex.species.get(d.speciesId);
  if (!sp) {
    err('UNKNOWN_SPECIES', 'Especie desconocida.');
    return { errors, warnings, info };
  }
  const fam = dex.familyOf(d.speciesId);
  if (dex.isDittoFamily(fam.id)) err('DITTO_TARGET', 'Ditto no se puede obtener criando: dos Ditto no crían entre sí y Ditto + X produce X (R04).');
  else if (!fam.canBreed) {
    err(
      'NOT_BREEDABLE',
      `${sp.name} no se puede criar.`,
      `Pertenece al grupo huevo "No puede criar" (legendarios, Unown, Shedinja…) y ningún miembro de su línea puede criar (R06).`,
    );
  }
  if (!sp.obtainable) warnings.push({ code: 'NOT_OBTAINABLE', message: `${sp.name} figura como no obtenible en PokeMMO (S1).` });
  if (errors.length) return { errors, warnings, info };

  const eggSpecies = dex.eggSpeciesForTarget(d.speciesId);
  if (dex.isBaby(d.speciesId)) {
    const parents = fam.members.filter((m) => dex.speciesCanBreed(m)).map((m) => dex.speciesName(m));
    if (fam.incense && fam.incense.babySpecies === d.speciesId) {
      info.push({
        code: 'BABY_INCENSE',
        message: `${sp.name} es un Pokémon bebé: se obtiene criando a ${fam.incense.holders.map((h) => dex.speciesName(h)).join(' o ')} con ${itemName(fam.incense.itemId)} (R09).`,
        detail: 'Con el incienso el huevo es siempre el bebé (R09b). Los bebés no pueden criar (R08).',
      });
    } else {
      info.push({ code: 'BABY', message: `${sp.name} es un Pokémon bebé: se obtiene criando a ${parents.join(' / ')}. No puede criar (R08).` });
    }
  } else if (eggSpecies !== d.speciesId) {
    info.push({ code: 'EVOLVE', message: `Del huevo sale ${dex.speciesName(eggSpecies)}; hay que evolucionarlo a ${sp.name}.` });
  }
  if (fam.id === NIDORAN_F || fam.id === ILLUMISE) {
    warnings.push({ code: 'R11', message: 'Caso especial no verificado en PokeMMO (R11): el motor asume que la cría es de la especie de la hembra.' });
  }

  // Género
  if (d.gender !== 'any') {
    if (fam.genderKind === 'genderless') err('GENDER', `${sp.name} no tiene género.`);
    else if (d.gender === 'male' && fam.genderKind === 'female-only') err('GENDER', `${sp.name} sólo puede ser hembra.`);
    else if (d.gender === 'female' && fam.genderKind === 'male-only') err('GENDER', `${sp.name} sólo puede ser macho.`);
  }
  if (fam.genderKind === 'male-only') info.push({ code: 'MALE_ONLY', message: `${sp.name} sólo tiene machos: cada cruce de su línea necesita un Ditto (R04).` });

  // IVs
  for (const s of STATS) {
    const t = d.ivs[s];
    if (!t) continue;
    if (!Number.isInteger(t.min) || !Number.isInteger(t.max) || t.min < 0 || t.max > 31 || t.min > t.max) {
      err('IV_RANGE', `Rango de IV no válido para ${STAT_LABELS[s].short}: ${t.min}-${t.max}.`);
    }
  }
  // Naturaleza
  if (d.nature && !isValidNature(d.nature)) err('NATURE', `Naturaleza desconocida: ${d.nature}.`);

  // Habilidades
  const abil = sp.abilities;
  if (d.ability) {
    const regular = [abil.primary, abil.secondary].filter(Boolean);
    if (d.ability === abil.hidden && !regular.includes(d.ability)) {
      if (!d.hiddenAbility) err('ABILITY', `${d.ability} es la Habilidad Oculta de ${sp.name}: activa "Habilidad Oculta".`);
    } else if (!regular.includes(d.ability)) {
      err('ABILITY', `${sp.name} no puede tener la habilidad ${d.ability}.`);
    }
  }
  if (d.hiddenAbility && !abil.hidden) err('NO_HA', `${sp.name} no tiene Habilidad Oculta en PokeMMO (S1).`);

  // Movimientos
  if (d.eggMoves.length > rules.mechanics.maxMoves) err('MOVES_MAX', `Un Pokémon sólo puede conocer ${rules.mechanics.maxMoves} movimientos (R54).`);
  const options = dex.desiredEggMoveOptions(d.speciesId);
  for (const { moveId } of d.eggMoves) {
    if (!options.includes(moveId)) {
      const natural = dex.naturalMoves(fam.id).has(moveId);
      err(
        'NOT_EGG_MOVE',
        `${dex.moveName(moveId)} no es un movimiento huevo de ${dex.speciesName(eggSpecies)} (R51).`,
        natural ? 'Se puede aprender sin criar (nivel, MT o tutor).' : undefined,
      );
    }
  }
  if (d.eggMoves.some((m) => m.moveId !== VOLT_TACKLE) && fam.genderKind === 'genderless') {
    err('GENDERLESS_MOVES', `${sp.name} no tiene género: sólo cría con su línea o con Ditto y no está verificado cómo transmite movimientos huevo (R56).`);
  }
  if (d.shiny) warnings.push({ code: 'SHINY', message: 'Objetivo shiny: sólo se pueden usar shinies de tu colección (R65).' });
  return { errors, warnings, info };
}

/** Construye el requisito raíz. Si `includeDesired` es false, sólo incluye lo obligatorio. */
export function buildRootReq(dex: Dex, d: DesiredPokemon, includeDesired: boolean): { req: Req; dropped: string[] } {
  const dropped: string[] = [];
  const take = (p: 'required' | 'desired', label: string) => {
    if (p === 'required' || includeDesired) return true;
    dropped.push(label);
    return false;
  };
  const fam = dex.familyOf(d.speciesId);
  const ivs: Req['ivs'] = {};
  for (const s of STATS) {
    const t = d.ivs[s];
    if (t && take(t.priority, `IV ${STAT_LABELS[s].short}`)) ivs[s] = { min: t.min, max: t.max };
  }
  const moves = d.eggMoves
    .filter((m) => m.moveId !== VOLT_TACKLE && take(m.priority, dex.moveName(m.moveId)))
    .map((m) => m.moveId)
    .sort((a, b) => a - b);
  const vt = d.eggMoves.find((m) => m.moveId === VOLT_TACKLE);
  const lightBall = !!vt && take(vt.priority, 'Volt Tackle');
  const gender = d.gender !== 'any' && take(d.genderPriority, 'Género') ? d.gender : 'any';
  const req: Req = {
    ivs,
    nature: d.nature && take(d.naturePriority, `Naturaleza ${d.nature}`) ? d.nature : null,
    moves,
    ha: d.hiddenAbility && take(d.hiddenAbilityPriority, 'Habilidad Oculta'),
    gender: fam.genderKind === 'genderless' ? 'any' : gender,
    species: { kind: 'family', familyId: fam.id, speciesIds: null },
    shiny: d.shiny,
    incense: !!fam.incense && fam.incense.babySpecies === d.speciesId,
    lightBall,
  };
  return { req, dropped };
}

export function hasDesiredFeatures(d: DesiredPokemon): boolean {
  return (
    Object.values(d.ivs).some((t) => t?.priority === 'desired') ||
    (!!d.nature && d.naturePriority === 'desired') ||
    (d.hiddenAbility && d.hiddenAbilityPriority === 'desired') ||
    d.eggMoves.some((m) => m.priority === 'desired') ||
    (d.gender !== 'any' && d.genderPriority === 'desired')
  );
}

/** Motivo exacto por el que un Pokémon OBLIGATORIO no puede usarse (o null si podría usarse). */
export function mandatoryProblem(dex: Dex, m: OwnedPokemon, root: Req): string | null {
  const sp = dex.species.get(m.speciesId);
  if (!sp) return 'Especie desconocida.';
  if (m.quantity < 1) return 'La cantidad es 0.';
  if (m.shiny !== root.shiny) return root.shiny ? 'El objetivo es shiny y este Pokémon no (R65).' : 'Un shiny no puede criar con Pokémon no shiny (R65).';
  const fam = dex.familyOf(m.speciesId);
  if (!fam.canBreed) return `${sp.name} pertenece al grupo "No puede criar" (R06).`;
  if (root.species.kind !== 'family') return null;
  const target = root.species.familyId;
  const isDitto = dex.isDittoFamily(fam.id);
  if (!isDitto && fam.id !== target) {
    if (dex.isGenderlessFamily(target)) return `El objetivo no tiene género: sólo cría con su propia línea o con Ditto (R05).`;
    if (dex.isGenderlessFamily(fam.id)) return `${sp.name} no tiene género: sólo cría con su propia línea o con Ditto (R05).`;
    if (!dex.shareEggGroup(fam.id, target)) {
      return `${sp.name} (${dex.breedingGroups(fam.id).join(', ')}) no comparte grupo huevo con ${dex.speciesName(target)} (${dex.breedingGroups(target).join(', ')}) (R03).`;
    }
  }
  if (!couldContribute(dex, m, root)) {
    const exact = matchOwned(dex, m, root);
    return `No aporta ninguna característica requerida (IVs dentro del rango, naturaleza, movimiento huevo o HA de la misma línea).${exact.reason ? ` ${exact.reason}` : ''}`;
  }
  return null;
}

export function validateOwned(dex: Dex, m: OwnedPokemon): string[] {
  const out: string[] = [];
  const sp = dex.species.get(m.speciesId);
  if (!sp) return ['Especie desconocida.'];
  const fam = dex.familyOf(m.speciesId);
  if (m.gender === 'genderless' && fam.genderKind !== 'genderless' && !dex.isDittoFamily(fam.id)) out.push(`${sp.name} tiene género.`);
  if (m.gender !== 'genderless' && (fam.genderKind === 'genderless' || dex.isDittoFamily(fam.id))) out.push(`${sp.name} no tiene género.`);
  if (m.gender === 'male' && dex.getSpecies(m.speciesId).genderRatio === 254) out.push(`${sp.name} sólo puede ser hembra.`);
  if (m.gender === 'female' && dex.getSpecies(m.speciesId).genderRatio === 0) out.push(`${sp.name} sólo puede ser macho.`);
  for (const s of STATS) if (!(m.ivs[s] >= 0 && m.ivs[s] <= 31)) out.push(`IV de ${STAT_LABELS[s].short} fuera de rango.`);
  if (!isValidNature(m.nature)) out.push(`Naturaleza desconocida: ${m.nature}.`);
  return out;
}
