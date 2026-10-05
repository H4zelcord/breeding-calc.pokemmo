/**
 * Catálogo de reglas con su estado de verificación.
 * Debe mantenerse sincronizado con docs/POKEMMO_BREEDING_RULES.md.
 */
export type RuleStatus = 'VERIFIED' | 'REPORTED' | 'ESTIMATE' | 'UNKNOWN' | 'DERIVED';

export interface RuleEntry {
  id: string;
  category: 'Compatibilidad' | 'IVs' | 'Naturaleza' | 'Habilidades' | 'Movimientos' | 'Costes y otros';
  text: string;
  status: RuleStatus;
  sources: string[];
  engineUse: string;
}

export const SOURCES: Record<string, { title: string; url: string }> = {
  S1: { title: 'Volcado de datos del cliente PokeMMO (PokeMMO-Tools/pokemmo-data, 2025-08-20)', url: 'https://github.com/PokeMMO-Tools/pokemmo-data' },
  S2: { title: 'PokeMMO Complete Breeding Guide (foro oficial, 2023-2024)', url: 'https://forums.pokemmo.com/index.php?/topic/172994-pokemmo-complete-breeding-guide/' },
  S3: { title: 'The Breeding Guide (foro oficial, 2015/2019)', url: 'https://forums.pokemmo.com/index.php?/topic/49440-the-breeding-guide/' },
  S4: { title: '[Hidden Ability] Breeding Guide (foro oficial, 2022-2025)', url: 'https://forums.pokemmo.com/index.php?/topic/147619-hidden-ability-breeding-guide/' },
  S5: { title: 'Can you breed alpha mons? (respuesta de administrador, 2022)', url: 'https://forums.pokemmo.com/index.php?/topic/147290-can-you-breed-alpha-mons/' },
  S6: { title: 'PokeMMO Wiki (shoutwiki) – Breeding', url: 'https://pokemmo.shoutwiki.com/wiki/Breeding' },
  S7: { title: 'PikaMMO – Breeding guide (terceros)', url: 'https://www.pikammo.fr/Pokemmo/en/tools/breeding' },
  S8: { title: 'How are moves inherited when breeding? (foro, 2021)', url: 'https://forums.pokemmo.com/index.php?/topic/139644-how-are-moves-inherited-when-breeding/' },
  S9: { title: 'Comprobación en el juego por el usuario (octubre de 2026)', url: '' },
};

export const RULES: RuleEntry[] = [
  { id: 'R01', category: 'Compatibilidad', text: 'Ambos progenitores se entregan y no se devuelven.', status: 'VERIFIED', sources: ['S2', 'S3', 'S6'], engineUse: 'Cada nodo es un Pokémon consumido; se respeta la cantidad de la colección.' },
  { id: 'R02', category: 'Compatibilidad', text: 'Dos progenitores producen exactamente un huevo.', status: 'VERIFIED', sources: ['S3'], engineUse: 'Un cruce = un hijo.' },
  { id: 'R03', category: 'Compatibilidad', text: 'Género opuesto y al menos un grupo huevo en común.', status: 'VERIFIED', sources: ['S2', 'S6'], engineUse: 'Validación de cada cruce.' },
  { id: 'R04', category: 'Compatibilidad', text: 'Ditto cría con cualquier Pokémon que pueda criar, salvo otro Ditto.', status: 'VERIFIED', sources: ['S2', 'S3'], engineUse: 'Opción de cruce con Ditto.' },
  { id: 'R05', category: 'Compatibilidad', text: 'Los Pokémon sin género sólo crían con su propia línea evolutiva o con Ditto.', status: 'VERIFIED', sources: ['S2', 'S3'], engineUse: 'Restricción de pareja.' },
  { id: 'R06', category: 'Compatibilidad', text: 'No pueden criar: grupo "cannot breed" (legendarios, bebés, Unown, Shedinja).', status: 'VERIFIED', sources: ['S1', 'S2'], engineUse: 'Validación.' },
  { id: 'R07', category: 'Compatibilidad', text: 'El huevo es de la especie de la hembra (o del progenitor que no es Ditto), en su forma base.', status: 'VERIFIED', sources: ['S2', 'S6'], engineUse: 'Especie de cada nodo criado.' },
  { id: 'R08', category: 'Compatibilidad', text: 'Los bebés no pueden criar: hay que evolucionarlos.', status: 'VERIFIED', sources: ['S1', 'S2'], engineUse: 'Nota "evolucionar antes de criar".' },
  { id: 'R09', category: 'Compatibilidad', text: 'Un incienso llevado por la especie indicada permite obtener el huevo bebé.', status: 'VERIFIED', sources: ['S1', 'S2'], engineUse: 'Objeto del cruce final si el objetivo es un bebé de incienso.' },
  { id: 'R09b', category: 'Compatibilidad', text: 'El incienso funciona siempre: 100 % de huevos bebé (aunque el texto dice "may help").', status: 'VERIFIED', sources: ['S9'], engineUse: 'El cruce con incienso garantiza el bebé; sin aviso.' },
  { id: 'R10', category: 'Compatibilidad', text: 'Sin incienso, esas familias producen la siguiente etapa (p. ej. Marill).', status: 'REPORTED', sources: [], engineUse: 'Especie de los nodos intermedios.' },
  { id: 'R11', category: 'Compatibilidad', text: 'Casos especiales Nidoran♀→Nidoran♂ / Illumise→Volbeat.', status: 'UNKNOWN', sources: [], engineUse: 'Se asume la especie de la hembra y se avisa.' },
  { id: 'R20', category: 'IVs', text: '3 IVs se heredan directamente; los otros 3 son la media de los padres redondeada hacia abajo.', status: 'VERIFIED', sources: ['S3', 'S6', 'S7'], engineUse: 'Cálculo de intervalos de IV del hijo.' },
  { id: 'R21', category: 'IVs', text: 'Un brace (Pesa Recia, Brazal Recio… / Power Weight, Power Bracer…) garantiza el IV de ese stat del portador. Se consume.', status: 'VERIFIED', sources: ['S1', 'S3'], engineUse: 'Un brace por progenitor.' },
  { id: 'R22', category: 'IVs', text: 'Si ambos padres tienen el mismo IV en un stat, el hijo lo tiene garantizado.', status: 'VERIFIED', sources: ['S2'], engineUse: 'Árbol piramidal.' },
  { id: 'R23', category: 'IVs', text: 'Si ambos padres están en [min,max] en un stat, el hijo también.', status: 'DERIVED', sources: [], engineUse: 'Objetivos parciales (p. ej. 0 Velocidad).' },
  { id: 'R24', category: 'IVs', text: 'Para k stats: un padre necesita S∖{b}, el otro S∖{a} (a, b = stats con brace).', status: 'DERIVED', sources: [], engineUse: 'Divisiones del árbol.' },
  { id: 'R25', category: 'IVs', text: 'Shiny × shiny: 2 IVs con brace, 2 = máximo, 2 = media.', status: 'VERIFIED', sources: ['S3', 'S6'], engineUse: 'Mismas garantías.' },
  { id: 'R30', category: 'Naturaleza', text: 'Piedraeterna (Everstone): el hijo tiene siempre la naturaleza del portador.', status: 'VERIFIED', sources: ['S1', 'S3'], engineUse: 'Objeto Everstone.' },
  { id: 'R31', category: 'Naturaleza', text: 'Es la única forma de garantizar la naturaleza.', status: 'VERIFIED', sources: ['S2'], engineUse: 'Sin Piedraeterna la naturaleza es aleatoria.' },
  { id: 'R32', category: 'Naturaleza', text: 'La Piedraeterna (Everstone) se consume.', status: 'VERIFIED', sources: ['S3'], engineUse: 'Coste.' },
  { id: 'R33', category: 'Naturaleza', text: 'El portador de la Piedraeterna no lleva brace: el otro padre necesita todos los stats.', status: 'DERIVED', sources: [], engineUse: 'Árbol con naturaleza.' },
  { id: 'R40', category: 'Habilidades', text: 'La Píldora Habilidad (Ability Pill) cambia la habilidad (incluida la HA si está desbloqueada).', status: 'VERIFIED', sources: ['S1', 'S4'], engineUse: 'Paso final opcional.' },
  { id: 'R41', category: 'Habilidades', text: '80 % de heredar la habilidad de la madre.', status: 'REPORTED', sources: ['S3'], engineUse: 'Informativo.' },
  { id: 'R42', category: 'Habilidades', text: 'La HA pasa por especie: un padre de la misma línea que el hijo debe tenerla; si es macho, la hembra debe ser de su línea (o Ditto).', status: 'VERIFIED', sources: ['S2', 'S4'], engineUse: 'Requisito de HA.' },
  { id: 'R43', category: 'Habilidades', text: 'Un Ditto con HA no desbloquea la HA.', status: 'VERIFIED', sources: ['S4'], engineUse: 'Nunca se asigna HA a Ditto.' },
  { id: 'R44', category: 'Habilidades', text: 'Probabilidad de transmitir la HA.', status: 'UNKNOWN', sources: ['S7'], engineUse: 'Aviso en cada cruce con HA.' },
  { id: 'R45', category: 'Habilidades', text: 'Parche de Habilidad (Ability Patch) desbloquea la HA; Perla Prismática (Prismatic Pearl) la transfiere en la misma línea.', status: 'VERIFIED', sources: ['S1', 'S4'], engineUse: 'Alternativa sugerida.' },
  { id: 'R50', category: 'Movimientos', text: 'Los movimientos huevo pasan del padre a crías de otra especie compatible (cadenas).', status: 'VERIFIED', sources: ['S2'], engineUse: 'Búsqueda de cadenas.' },
  { id: 'R51', category: 'Movimientos', text: 'Sólo se heredan los movimientos huevo de la especie del huevo.', status: 'VERIFIED', sources: ['S1', 'S2'], engineUse: 'Validación.' },
  { id: 'R52', category: 'Movimientos', text: 'La madre también transmite movimientos huevo.', status: 'UNKNOWN', sources: [], engineUse: 'Desactivado por defecto (opción experimental).' },
  { id: 'R53', category: 'Movimientos', text: 'MT y tutores se tratan como movimientos huevo.', status: 'VERIFIED', sources: ['S2'], engineUse: 'Cuentan como aprendibles en las cadenas.' },
  { id: 'R54', category: 'Movimientos', text: 'Prioridad huevo > MT/tutor > nivel; máximo 4 movimientos.', status: 'REPORTED', sources: ['S8'], engineUse: 'Máximo 4 movimientos.' },
  { id: 'R55', category: 'Movimientos', text: 'Bolaluminosa (Light Ball) en Pikachu al criar un Pichu → Volt Tackle.', status: 'VERIFIED', sources: ['S1'], engineUse: 'Objeto del cruce final.' },
  { id: 'R56', category: 'Movimientos', text: 'Sin género + Ditto transmitiendo movimientos.', status: 'UNKNOWN', sources: [], engineUse: 'No se planifica.' },
  { id: 'R60', category: 'Costes y otros', text: 'Se puede elegir el género del huevo pagando según el ratio.', status: 'VERIFIED', sources: ['S2', 'S3', 'S6', 'S7'], engineUse: 'Coste por nodo con género fijado.' },
  { id: 'R61', category: 'Costes y otros', text: 'Precio de elección de género: 5.000 / 10.000 / 25.000 (las fuentes discrepan).', status: 'ESTIMATE', sources: ['S3', 'S6', 'S7'], engineUse: 'Editable.' },
  { id: 'R62', category: 'Costes y otros', text: 'Precio de un brace: 10.000.', status: 'ESTIMATE', sources: ['S3', 'S7'], engineUse: 'Editable.' },
  { id: 'R63', category: 'Costes y otros', text: 'Precios de Piedraeterna, inciensos, Bolaluminosa, Píldora Habilidad y Pokémon.', status: 'UNKNOWN', sources: [], engineUse: 'Sin precio: coste marcado como incompleto.' },
  { id: 'R64', category: 'Costes y otros', text: 'Sin tarifa adicional por cruce.', status: 'REPORTED', sources: ['S2'], engineUse: 'Tarifa = 0, editable.' },
  { id: 'R65', category: 'Costes y otros', text: 'Shiny no cría con no shiny; shiny × shiny = shiny.', status: 'VERIFIED', sources: ['S2', 'S3', 'S6'], engineUse: 'Objetivo shiny sólo usa shinies.' },
  { id: 'R66', category: 'Costes y otros', text: 'El estado alfa sólo se hereda si ambos padres son alfa.', status: 'VERIFIED', sources: ['S5'], engineUse: 'Informativo.' },
  { id: 'R67', category: 'Costes y otros', text: 'Eclosión: 5 min 20 s (4 min 20 s con Flame Body/Magma Armor).', status: 'REPORTED', sources: ['S2'], engineUse: 'Estimación de tiempo.' },
  { id: 'R68', category: 'Costes y otros', text: 'Cada Pokémon lleva un único objeto.', status: 'VERIFIED', sources: [], engineUse: 'No se combinan brace y Piedraeterna.' },
];

export const RULE_BY_ID = new Map(RULES.map((r) => [r.id, r]));
