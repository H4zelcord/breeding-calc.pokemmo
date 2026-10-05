import speciesJson from './generated/species.json';
import movesJson from './generated/moves.json';
import metaJson from './generated/meta.json';
import type { EggGroup, Family, GenderRatioKind, MoveData, SpeciesData } from './models';
import { BREEDING_ITEMS } from './items';

export const DITTO_ID = 132;
const SPECIAL_GROUPS: EggGroup[] = ['cannot breed', 'ditto', 'genderless'];

export function genderKind(ratio: number): GenderRatioKind {
  if (ratio === 0) return 'male-only';
  if (ratio === 254) return 'female-only';
  if (ratio === 255) return 'genderless';
  return 'mixed';
}

/** Fracción de hembras para la codificación Gen 5 (31 → 12,5 %, 63 → 25 %, 127 → 50 %, 191 → 75 %). */
export function femaleFraction(ratio: number): number {
  const kind = genderKind(ratio);
  if (kind === 'male-only') return 0;
  if (kind === 'female-only') return 1;
  if (kind === 'genderless') return 0;
  return (ratio + 1) / 256;
}

/**
 * Acceso a los datos de especies, familias y movimientos.
 * Es puro: se puede instanciar en tests con datos reducidos.
 */
export class Dex {
  readonly species = new Map<number, SpeciesData>();
  readonly moves = new Map<number, MoveData>();
  readonly families = new Map<number, Family>();
  private readonly familyOfSpecies = new Map<number, number>();
  private readonly preEvolution = new Map<number, number>();
  private readonly naturalCache = new Map<number, Set<number>>();
  readonly meta: typeof metaJson;

  constructor(species: SpeciesData[], moves: MoveData[], meta = metaJson) {
    this.meta = meta;
    for (const s of species) this.species.set(s.id, s);
    for (const m of moves) this.moves.set(m.id, m);
    for (const s of species) for (const e of s.evolvesTo) if (this.species.has(e.id)) this.preEvolution.set(e.id, s.id);
    this.buildFamilies(species);
  }

  private buildFamilies(species: SpeciesData[]): void {
    const incenseByBaby = new Map<number, { itemId: string; holders: number[] }>();
    for (const item of BREEDING_ITEMS) {
      if (item.data.kind === 'incense') incenseByBaby.set(item.data.babySpecies, { itemId: item.id, holders: item.data.holders });
    }
    for (const s of species) {
      if (this.preEvolution.has(s.id)) continue; // no es raíz
      const members: number[] = [];
      const queue = [s.id];
      while (queue.length) {
        const id = queue.shift()!;
        if (members.includes(id)) continue;
        members.push(id);
        for (const e of this.species.get(id)!.evolvesTo) if (this.species.has(e.id)) queue.push(e.id);
      }
      const breedable = members.filter((m) => !this.species.get(m)!.eggGroups.includes('cannot breed'));
      const groups = new Set<EggGroup>();
      for (const m of breedable) for (const g of this.species.get(m)!.eggGroups) groups.add(g);
      const inc = incenseByBaby.get(s.id);
      const defaultEgg = inc ? this.species.get(s.id)!.evolvesTo[0].id : s.id;
      const ratio = this.species.get(defaultEgg)!.genderRatio;
      const family: Family = {
        id: s.id,
        members,
        eggGroups: [...groups],
        canBreed: breedable.length > 0,
        genderRatio: ratio,
        genderKind: genderKind(ratio),
        defaultEggSpecies: defaultEgg,
        incense: inc ? { itemId: inc.itemId, babySpecies: s.id, holders: inc.holders } : null,
        firstBreedable: breedable[0] ?? null,
      };
      this.families.set(s.id, family);
      for (const m of members) this.familyOfSpecies.set(m, s.id);
    }
  }

  getSpecies(id: number): SpeciesData {
    const s = this.species.get(id);
    if (!s) throw new Error(`Especie desconocida: ${id}`);
    return s;
  }

  speciesName(id: number): string {
    return this.species.get(id)?.name ?? `#${id}`;
  }

  moveName(id: number): string {
    return this.moves.get(id)?.name ?? `Movimiento #${id}`;
  }

  familyIdOf(speciesId: number): number {
    const f = this.familyOfSpecies.get(speciesId);
    if (f === undefined) throw new Error(`Especie desconocida: ${speciesId}`);
    return f;
  }

  familyOf(speciesId: number): Family {
    return this.families.get(this.familyIdOf(speciesId))!;
  }

  getFamily(familyId: number): Family {
    const f = this.families.get(familyId);
    if (!f) throw new Error(`Familia desconocida: ${familyId}`);
    return f;
  }

  isDittoFamily(familyId: number): boolean {
    return familyId === DITTO_ID;
  }

  isGenderlessFamily(familyId: number): boolean {
    return this.getFamily(familyId).genderKind === 'genderless' && !this.isDittoFamily(familyId);
  }

  /** La especie puede actuar como progenitor tal cual (no es un bebé / legendario). */
  speciesCanBreed(speciesId: number): boolean {
    return !this.getSpecies(speciesId).eggGroups.includes('cannot breed');
  }

  isBaby(speciesId: number): boolean {
    const s = this.getSpecies(speciesId);
    const fam = this.familyOf(speciesId);
    return s.eggGroups.includes('cannot breed') && fam.canBreed && fam.id === speciesId;
  }

  preEvolutionOf(speciesId: number): number | null {
    return this.preEvolution.get(speciesId) ?? null;
  }

  /** `from` puede evolucionar (0 o más veces) hasta `to`. */
  canBecome(from: number, to: number): boolean {
    let cur: number | null = to;
    while (cur !== null) {
      if (cur === from) return true;
      cur = this.preEvolutionOf(cur);
    }
    return false;
  }

  /** Cadena de evolución desde la raíz hasta la especie. */
  evolutionPathTo(speciesId: number): number[] {
    const path: number[] = [];
    let cur: number | null = speciesId;
    while (cur !== null) {
      path.unshift(cur);
      cur = this.preEvolutionOf(cur);
    }
    return path;
  }

  /** Especie que eclosiona al criar esta familia. */
  eggSpecies(familyId: number, withIncense = false): number {
    const f = this.getFamily(familyId);
    if (withIncense && f.incense) return f.incense.babySpecies;
    return f.defaultEggSpecies;
  }

  /** Especie que eclosiona cuando el objetivo es `targetSpecies` (usa incienso sólo si el objetivo es el bebé). */
  eggSpeciesForTarget(targetSpecies: number): number {
    const fam = this.familyOf(targetSpecies);
    if (fam.incense && fam.incense.babySpecies === targetSpecies) return targetSpecies;
    return fam.defaultEggSpecies;
  }

  breedingGroups(familyId: number): EggGroup[] {
    return this.getFamily(familyId).eggGroups.filter((g) => !SPECIAL_GROUPS.includes(g));
  }

  /** Comparten algún grupo huevo "normal" (R03). */
  shareEggGroup(familyA: number, familyB: number): boolean {
    const a = this.breedingGroups(familyA);
    const b = this.breedingGroups(familyB);
    return a.some((g) => b.includes(g));
  }

  canBeMale(familyId: number): boolean {
    const f = this.getFamily(familyId);
    return f.canBreed && (f.genderKind === 'mixed' || f.genderKind === 'male-only');
  }

  canBeFemale(familyId: number): boolean {
    const f = this.getFamily(familyId);
    return f.canBreed && (f.genderKind === 'mixed' || f.genderKind === 'female-only');
  }

  /** Movimientos aprendibles sin crianza por algún miembro de la familia. */
  naturalMoves(familyId: number): Set<number> {
    let s = this.naturalCache.get(familyId);
    if (!s) {
      s = new Set<number>();
      for (const m of this.getFamily(familyId).members) for (const mv of this.getSpecies(m).learnable) s.add(mv);
      this.naturalCache.set(familyId, s);
    }
    return s;
  }

  eggMovesOf(speciesId: number): number[] {
    return this.getSpecies(speciesId).eggMoves;
  }

  /** Movimientos huevo que se pueden pedir para un objetivo (incluye Volt Tackle). */
  desiredEggMoveOptions(targetSpecies: number): number[] {
    const egg = this.getSpecies(this.eggSpeciesForTarget(targetSpecies));
    return [...egg.eggMoves, ...egg.specialEggMoves];
  }

  allSpecies(): SpeciesData[] {
    return [...this.species.values()];
  }

  breedingFamilies(): Family[] {
    return [...this.families.values()].filter((f) => f.canBreed && !this.isDittoFamily(f.id));
  }

  search(query: string, limit = 30): SpeciesData[] {
    const q = query.trim().toLowerCase();
    if (!q) return this.allSpecies().slice(0, limit);
    const asNum = Number(q.replace('#', ''));
    const res = this.allSpecies().filter((s) => s.name.toLowerCase().includes(q) || s.id === asNum);
    res.sort((a, b) => {
      const as = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bs = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return as - bs || a.id - b.id;
    });
    return res.slice(0, limit);
  }
}

let defaultDex: Dex | null = null;

/** Dex con los datos generados de PokeMMO. */
export function getDex(): Dex {
  if (!defaultDex) defaultDex = new Dex(speciesJson as SpeciesData[], movesJson as MoveData[]);
  return defaultDex;
}
