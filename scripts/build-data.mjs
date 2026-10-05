#!/usr/bin/env node
/**
 * Genera los datos compactos que usa la aplicación a partir del volcado oficial
 * del cliente de PokeMMO publicado en https://github.com/PokeMMO-Tools/pokemmo-data
 *
 * Uso:
 *   git clone --depth 1 https://github.com/PokeMMO-Tools/pokemmo-data data-raw/pokemmo-data
 *   npm run data            # o: node scripts/build-data.mjs <ruta-al-repo>
 *
 * Salida: src/data/generated/{species,moves,meta}.json
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'data-raw/pokemmo-data');
const out = path.resolve('src/data/generated');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, 'data', f), 'utf8'));

// El volcado contiene algunos nombres con doble codificación UTF-8 -> CP1252.
const MOJIBAKE = [
  ['â™€', '♀'],
  ['â™‚', '♂'],
  ['Ã©', 'é'],
  ['â€™', '’'],
];
const fixName = (s) => MOJIBAKE.reduce((acc, [bad, good]) => acc.split(bad).join(good), s);

const STAT_MAP = {
  hp: 'hp',
  attack: 'attack',
  defense: 'defense',
  sp_attack: 'specialAttack',
  sp_defense: 'specialDefense',
  speed: 'speed',
};

/** Métodos que permiten que un Pokémon aprenda un movimiento sin crianza. */
const NATURAL_METHODS = new Set(['level', 'move_tutor', 'move_learner_tools', 'on_evolution', 'prevo_moves']);

const monsters = read('monster.json').filter((m) => m.id >= 1 && m.id <= 649);
const rawMoves = read('moves.json');

const species = monsters
  .sort((a, b) => a.id - b.id)
  .map((m) => {
    const [a1, a2, ha] = m.abilities;
    const ability = (a) => (a && a.id !== 0 && a.name !== '--' ? fixName(a.name) : null);
    const eggMoves = new Set();
    const specialEggMoves = new Set();
    const learnable = new Set();
    for (const mv of m.moves) {
      if (mv.type === 'egg_moves') eggMoves.add(mv.id);
      else if (mv.type === 'special_egg') specialEggMoves.add(mv.id);
      else if (NATURAL_METHODS.has(mv.type)) learnable.add(mv.id);
    }
    const stats = {};
    for (const [k, v] of Object.entries(m.stats)) stats[STAT_MAP[k]] = v;
    return {
      id: m.id,
      name: fixName(m.name),
      types: m.types.map((t) => t[0] + t.slice(1).toLowerCase()),
      genderRatio: m.gender_ratio,
      eggGroups: m.egg_groups,
      abilities: { primary: ability(a1), secondary: ability(a2), hidden: ability(ha) },
      evolvesTo: m.evolutions
        .filter((e) => e.id <= 649)
        .map((e) => ({ id: e.id, method: e.type, value: e.val ?? 0 })),
      eggMoves: [...eggMoves].sort((a, b) => a - b),
      specialEggMoves: [...specialEggMoves].sort((a, b) => a - b),
      learnable: [...learnable].sort((a, b) => a - b),
      obtainable: m.obtainable,
      baseStats: stats,
    };
  });

const usedMoveIds = new Set(species.flatMap((s) => [...s.eggMoves, ...s.specialEggMoves, ...s.learnable]));
const moves = rawMoves
  .filter((m) => usedMoveIds.has(m.id))
  .map((m) => ({
    id: m.id,
    name: fixName(m.name),
    type: m.type[0] + m.type.slice(1).toLowerCase(),
    category: m.skill_damage_type,
    power: m.base_power,
    accuracy: m.base_accuracy,
    pp: m.base_pp,
  }))
  .sort((a, b) => a.id - b.id);

// Objetos de crianza: nombre oficial (inglés), nombre oficial del cliente en español y texto in-game.
// Ids internos del volcado (las distintas regiones usan ids distintos para el mismo objeto).
const BREEDING_ITEM_IDS = [
  5294, 1005, 5289, 1006, 5290, 1007, 5291, 1008, 5292, 1009, 5293, 1010, // Power items / Braces
  5229, 6229, 195, // Everstone
  5254, 6254, 5255, 6255, 5314, 6314, 5315, 6315, 5316, 6316, 5317, 6317, 5318, 6318, 5319, 6319, 5320, 6320, // Inciensos
  5236, 6236, 202, // Light Ball
  1018, 1125, 7018, // Ability Pill
  1296, // Ability Patch
  1422, // Prismatic Pearl
  5280, // Destiny Knot
];
const rawItems = new Map(read('items.json').map((i) => [i.id, i]));
const esNames = JSON.parse(fs.readFileSync(path.join(root, 'locales', 'es-ES', 'item_names.json'), 'utf8'));
const items = {};
for (const id of BREEDING_ITEM_IDS) {
  const it = rawItems.get(id);
  if (!it) throw new Error(`Objeto ${id} no encontrado en el volcado`);
  const name = fixName(it.name);
  items[id] = {
    id,
    name,
    nameEs: esNames[name.toLowerCase()] ?? null,
    description: fixName(it.description ?? '').replace(/\s+/g, ' ').trim(),
  };
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'items.json'), JSON.stringify(items, null, 1));
fs.writeFileSync(path.join(out, 'species.json'), JSON.stringify(species));
fs.writeFileSync(path.join(out, 'moves.json'), JSON.stringify(moves));
fs.writeFileSync(
  path.join(out, 'meta.json'),
  JSON.stringify(
    {
      source: 'https://github.com/PokeMMO-Tools/pokemmo-data',
      sourceCommit: '58b840b3014e2c2162c38c460cd4464589aa07af',
      sourceDate: '2025-08-20',
      generatedAt: new Date().toISOString().slice(0, 10),
      speciesCount: species.length,
      moveCount: moves.length,
    },
    null,
    2,
  ),
);
console.log(`species: ${species.length}, moves: ${moves.length} -> ${out}`);
