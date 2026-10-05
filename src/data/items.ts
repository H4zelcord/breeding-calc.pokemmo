import itemsJson from './generated/items.json';
import { STAT_LABELS, type StatKey } from './models';

/**
 * Objetos relevantes para la crianza en PokeMMO.
 * Nombre oficial, nombre oficial en español y texto in-game salen del volcado del cliente
 * (src/data/generated/items.json, generado por scripts/build-data.mjs). Aquí sólo se define
 * su papel en la crianza.
 */
export type ItemEffect =
  | { kind: 'iv'; stat: StatKey }
  | { kind: 'nature' }
  | { kind: 'incense'; babySpecies: number; holders: number[] }
  | { kind: 'voltTackle'; holder: number; babySpecies: number }
  | { kind: 'ability' }
  | { kind: 'hiddenAbility' }
  | { kind: 'none' };

export type PriceKey = 'brace' | 'everstone' | 'incense' | 'lightBall' | 'abilityPill' | 'abilityPatch' | 'none';

export interface GameItem {
  id: number;
  name: string;
  nameEs: string | null;
  description: string;
}

const GAME_ITEMS = itemsJson as unknown as Record<string, GameItem>;

export function gameItem(id: number): GameItem {
  const it = GAME_ITEMS[id];
  if (!it) throw new Error(`Objeto ${id} no está en los datos generados`);
  return it;
}

export interface BreedingItem {
  id: string;
  /** Nombre oficial en inglés (cliente de PokeMMO). */
  name: string;
  /** Nombre oficial del cliente de PokeMMO en español. */
  nameEs: string | null;
  /** Otros nombres oficiales del mismo objeto (otras regiones / versiones del cliente). */
  aliases: string[];
  /** Ids internos del objeto en el volcado del cliente; el primero es el principal. */
  gameIds: number[];
  /** Texto in-game del objeto principal. */
  gameText: string;
  /** Efecto resumido en español. */
  effect: string;
  /** Característica afectada. */
  affects: string;
  restrictions: string[];
  compatibility: string;
  /** Se usa (lo lleva un progenitor) durante la crianza. */
  heldWhileBreeding: boolean;
  consumed: boolean;
  priceKey: PriceKey;
  ruleIds: string[];
  data: ItemEffect;
}

type ItemDef = Omit<BreedingItem, 'name' | 'nameEs' | 'aliases' | 'gameText'>;

function fromGame(def: ItemDef): BreedingItem {
  const main = gameItem(def.gameIds[0]);
  const aliases: string[] = [];
  for (const id of def.gameIds.slice(1)) {
    const g = gameItem(id);
    for (const n of [g.name, g.nameEs]) if (n && n !== main.name && n !== main.nameEs && !aliases.includes(n)) aliases.push(n);
  }
  return { ...def, name: main.name, nameEs: main.nameEs, aliases, gameText: main.description };
}

/** "Pesa Recia (Power Weight)": nombre oficial en español con el inglés entre paréntesis. */
export function itemLabel(item: Pick<BreedingItem, 'name' | 'nameEs'>): string {
  return item.nameEs && item.nameEs !== item.name ? `${item.nameEs} (${item.name})` : item.name;
}

const BRACE_RESTRICTIONS = [
  'Un Pokémon sólo puede llevar un objeto: no se puede combinar con Piedraeterna, incienso o Bolaluminosa.',
  'Sólo garantiza el IV del portador para ese stat (si el portador tiene 0, el hijo tendrá 0).',
];

function brace(id: string, gameIds: number[], stat: StatKey): BreedingItem {
  const statName = STAT_LABELS[stat].name;
  return fromGame({
    id,
    gameIds,
    effect: `El hijo hereda el IV de ${statName} del portador.`,
    affects: `IV de ${statName}`,
    restrictions: BRACE_RESTRICTIONS,
    compatibility: 'Cualquier Pokémon que críe.',
    heldWhileBreeding: true,
    consumed: true,
    priceKey: 'brace',
    ruleIds: ['R21', 'R62', 'R68'],
    data: { kind: 'iv', stat },
  });
}

function incense(id: string, gameIds: number[], babySpecies: number, holders: number[], holderNames: string, babyName: string): BreedingItem {
  return fromGame({
    id,
    gameIds,
    effect: `Permite obtener un huevo de ${babyName}.`,
    affects: 'Especie del huevo (bebé)',
    restrictions: [
      `Debe llevarlo ${holderNames} (la especie exacta que indica el objeto).`,
      'Funciona siempre: 100 % de huevos bebé (R09b, comprobado en el juego).',
      'Ocupa la ranura de objeto: el portador no puede llevar brace ni Piedraeterna.',
    ],
    compatibility: holderNames,
    heldWhileBreeding: true,
    consumed: false,
    priceKey: 'incense',
    ruleIds: ['R09', 'R09b', 'R68'],
    data: { kind: 'incense', babySpecies, holders },
  });
}

export const BREEDING_ITEMS: BreedingItem[] = [
  brace('power-weight', [5294, 1005], 'hp'),
  brace('power-bracer', [5289, 1006], 'attack'),
  brace('power-belt', [5290, 1007], 'defense'),
  brace('power-lens', [5291, 1008], 'specialAttack'),
  brace('power-band', [5292, 1009], 'specialDefense'),
  brace('power-anklet', [5293, 1010], 'speed'),
  fromGame({
    id: 'everstone',
    gameIds: [5229, 6229, 195],
    effect: 'El hijo tiene siempre la naturaleza del portador.',
    affects: 'Naturaleza',
    restrictions: [
      'Es la única forma de garantizar la naturaleza (R31).',
      'Se consume junto con los padres (R32).',
      'Ocupa la ranura de objeto: el portador no puede llevar brace.',
    ],
    compatibility: 'Cualquier Pokémon que críe.',
    heldWhileBreeding: true,
    consumed: true,
    priceKey: 'everstone',
    ruleIds: ['R30', 'R31', 'R32', 'R68'],
    data: { kind: 'nature' },
  }),
  incense('sea-incense', [5254, 6254], 298, [183, 184], 'Marill o Azumarill', 'Azurill'),
  incense('lax-incense', [5255, 6255], 360, [202], 'Wobbuffet', 'Wynaut'),
  incense('odd-incense', [5314, 6314], 439, [122], 'Mr. Mime', 'Mime Jr.'),
  incense('rock-incense', [5315, 6315], 438, [185], 'Sudowoodo', 'Bonsly'),
  incense('full-incense', [5316, 6316], 446, [143], 'Snorlax', 'Munchlax'),
  incense('wave-incense', [5317, 6317], 458, [226], 'Mantine', 'Mantyke'),
  incense('rose-incense', [5318, 6318], 406, [315, 407], 'Roselia o Roserade', 'Budew'),
  incense('luck-incense', [5319, 6319], 440, [113], 'Chansey', 'Happiny'),
  incense('pure-incense', [5320, 6320], 433, [358], 'Chimecho', 'Chingling'),
  fromGame({
    id: 'light-ball',
    gameIds: [5236, 6236, 202],
    effect: 'El Pichu resultante aprende Volt Tackle.',
    affects: 'Movimiento huevo especial (Volt Tackle)',
    restrictions: ['Debe llevarlo un Pikachu.', 'Ocupa la ranura de objeto.'],
    compatibility: 'Pikachu',
    heldWhileBreeding: true,
    consumed: false,
    priceKey: 'lightBall',
    ruleIds: ['R55', 'R68'],
    data: { kind: 'voltTackle', holder: 25, babySpecies: 172 },
  }),
  fromGame({
    id: 'ability-pill',
    gameIds: [1018, 1125, 7018],
    effect: 'Cambia la habilidad del Pokémon (incluida la oculta si está desbloqueada).',
    affects: 'Habilidad',
    restrictions: ['No desbloquea la Habilidad Oculta (R45).', 'Se usa después de criar, no durante.'],
    compatibility: 'Cualquier Pokémon.',
    heldWhileBreeding: false,
    consumed: true,
    priceKey: 'abilityPill',
    ruleIds: ['R40'],
    data: { kind: 'ability' },
  }),
  fromGame({
    id: 'ability-patch',
    gameIds: [1296],
    effect: 'Desbloquea la Habilidad Oculta del Pokémon.',
    affects: 'Habilidad Oculta',
    restrictions: ['No se usa durante la crianza.', 'Alternativa a criar la Habilidad Oculta.'],
    compatibility: 'Cualquier Pokémon.',
    heldWhileBreeding: false,
    consumed: true,
    priceKey: 'abilityPatch',
    ruleIds: ['R45'],
    data: { kind: 'hiddenAbility' },
  }),
  fromGame({
    id: 'prismatic-pearl',
    gameIds: [1422],
    effect: 'Transfiere la Habilidad Oculta de un Pokémon a otro de la misma línea evolutiva.',
    affects: 'Habilidad Oculta',
    restrictions: ['No se usa durante la crianza.', 'Sólo dentro de la misma línea evolutiva.'],
    compatibility: 'Misma línea evolutiva.',
    heldWhileBreeding: false,
    consumed: true,
    priceKey: 'none',
    ruleIds: ['R45'],
    data: { kind: 'hiddenAbility' },
  }),
  fromGame({
    id: 'destiny-knot',
    gameIds: [5280],
    effect: 'Sin efecto de crianza en PokeMMO (a diferencia de los juegos principales).',
    affects: '—',
    restrictions: ['No usar para criar.'],
    compatibility: '—',
    heldWhileBreeding: false,
    consumed: false,
    priceKey: 'none',
    ruleIds: ['R20'],
    data: { kind: 'none' },
  }),
];

export const ITEM_BY_ID = new Map(BREEDING_ITEMS.map((i) => [i.id, i]));

/** Etiqueta oficial de un objeto por su id interno de la app. */
export function itemName(id: string): string {
  const it = ITEM_BY_ID.get(id);
  return it ? itemLabel(it) : id;
}

export function braceFor(stat: StatKey): BreedingItem {
  const item = BREEDING_ITEMS.find((i) => i.data.kind === 'iv' && i.data.stat === stat);
  if (!item) throw new Error(`No brace for ${stat}`);
  return item;
}

export function incenseForBaby(babySpecies: number): BreedingItem | null {
  return BREEDING_ITEMS.find((i) => i.data.kind === 'incense' && i.data.babySpecies === babySpecies) ?? null;
}
