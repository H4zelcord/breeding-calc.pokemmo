# Reglas de breeding de PokeMMO

Este documento recoge **todas** las reglas que utiliza el motor, con su estado de verificación y su
fuente. El catálogo equivalente en código está en `src/engine/rules/rulesCatalog.ts` y se muestra en la
página **Configuración → Reglas** de la aplicación.

Investigación realizada en octubre de 2026.

Los objetos se nombran con su **nombre oficial del cliente en español** seguido del nombre en inglés,
p. ej. *Piedraeterna (Everstone)*. Los nombres salen del volcado S1 (`locales/es-ES/item_names.json`).

## Estados

| Estado | Significado |
|---|---|
| `VERIFIED` | Confirmado por el texto del propio cliente de PokeMMO (descripciones de objetos / volcado de datos) o por al menos una guía de la comunidad reciente y coherente con el resto de fuentes. |
| `REPORTED` | Lo afirma una fuente de la comunidad pero no ha podido contrastarse con otra fuente reciente. El motor lo usa sólo como información o como valor **editable**. |
| `ESTIMATE` | Valores numéricos (precios) en los que las fuentes discrepan. Se usan como estimación editable y los costes que dependen de ellos se marcan como *Estimación*. |
| `UNKNOWN` | No verificable. **El motor no basa ninguna solución en ello**: o elige la opción conservadora que es válida en cualquier caso, o lo trata como probabilidad desconocida y avisa. |
| `DERIVED` | Consecuencia matemática directa de reglas `VERIFIED`. |

## Fuentes

| Id | Fuente |
|---|---|
| S1 | Volcado de datos del cliente PokeMMO: <https://github.com/PokeMMO-Tools/pokemmo-data> (commit `58b840b`, 2025-08-20). Incluye especies, grupos huevo, ratios de género, habilidades, evoluciones, movimientos huevo y las descripciones in-game de los objetos. |
| S2 | *PokeMMO Complete Breeding Guide*, PhoenixNoah, foro oficial, 2023-2024: <https://forums.pokemmo.com/index.php?/topic/172994-pokemmo-complete-breeding-guide/> |
| S3 | *The Breeding Guide*, Gilan, foro oficial (2015, editado 2019): <https://forums.pokemmo.com/index.php?/topic/49440-the-breeding-guide/> |
| S4 | *[Hidden Ability] Breeding Guide*, Zuladra, foro oficial (2022, editado 2025-03): <https://forums.pokemmo.com/index.php?/topic/147619-hidden-ability-breeding-guide/> |
| S5 | Respuesta de un administrador (Rache) sobre alfas, 2022: <https://forums.pokemmo.com/index.php?/topic/147290-can-you-breed-alpha-mons/> |
| S6 | Wiki comunitaria (shoutwiki): <https://pokemmo.shoutwiki.com/wiki/Breeding> |
| S7 | PikaMMO (herramienta de terceros): <https://www.pikammo.fr/Pokemmo/en/tools/breeding> |
| S8 | Hilo del foro sobre herencia de movimientos, 2021: <https://forums.pokemmo.com/index.php?/topic/139644-how-are-moves-inherited-when-breeding/> |
| S9 | Comprobación directa en el juego por el usuario (octubre de 2026). |

## Diferencias principales con los juegos oficiales

1. **Ambos progenitores se pierden** al criar. Cada cruce produce **un único huevo**.
2. **Herencia de IVs propia**: 3 IVs directos y **3 IVs promediados** (redondeo hacia abajo). No hay Lazo Destino (el objeto existe pero no tiene efecto de crianza).
3. **Los braces se consumen** (Pesa Recia, Brazal Recio, Cinto Recio, Lente Recia, Banda Recia y Franja Recia /
   Power Weight, Power Bracer, Power Belt, Power Lens, Power Band y Power Anklet) y cada uno fuerza un IV concreto.
4. **El género del huevo se puede comprar** pagando al cuidador.
5. **Los huevos eclosionan por tiempo**, no por pasos.
6. Grupos huevo propios del volcado: `water a/b/c` (=Agua 1/2/3), `humanoid`, `chaos` (=Amorfo), `genderless` (todos los Pokémon sin género que pueden criar), `cannot breed` (=Desconocido).
7. Algunas especies tienen datos distintos a los oficiales (p. ej. **Nidoqueen y Nidoking sí pueden criar** en PokeMMO según S1). El motor usa siempre los datos de S1.

## Reglas

### Compatibilidad y especie

| Id | Regla | Estado | Fuente | Uso en el motor |
|---|---|---|---|---|
| R01 | Ambos progenitores se entregan y **no se devuelven**. | VERIFIED | S2, S3, S6 | Cada nodo del árbol es un Pokémon consumido. Los Pokémon de la colección tienen `cantidad` y no se pueden reutilizar más veces. |
| R02 | Dos progenitores producen **exactamente un huevo**. | VERIFIED | S3 | Un cruce = un nodo hijo. |
| R03 | Deben ser de **género opuesto** y compartir **al menos un grupo huevo**. | VERIFIED | S2, S6 | `rules/inheritance.ts › canBreedPair` |
| R04 | **Ditto** cría con cualquier Pokémon que pueda criar, salvo con otro Ditto. | VERIFIED | S2, S3 | Opción de cruce "Ditto + X". |
| R05 | Los Pokémon **sin género** sólo crían con **su propia línea evolutiva** o con Ditto. | VERIFIED | S2, S3 | Grupo `genderless`. |
| R06 | No pueden criar: grupo `cannot breed` (legendarios, bebés, Unown, Shedinja…). | VERIFIED | S1, S2 | Validación. Los bebés de la colección se aceptan indicando que hay que **evolucionarlos antes**. |
| R07 | El huevo es de la **especie de la hembra** (o del progenitor que no es Ditto), en su **forma base**. | VERIFIED | S2, S6 | `Dex.eggSpecies`. |
| R08 | Los bebés **no pueden criar**; hay que evolucionarlos. | VERIFIED | S1, S2 | Nota en el nodo ("Evolucionar a X antes de criar"). |
| R09 | **Incienso**: si lo lleva una especie concreta al criar "*may help them produce*" el huevo bebé (Azurill, Wynaut, Mime Jr., Bonsly, Munchlax, Mantyke, Budew, Happiny, Chingling). | VERIFIED (existencia, portador) | S1 (descripciones de objetos), S2 | El incienso lo lleva el progenitor de esa especie exacta (p. ej. Chansey, no Blissey). Ocupa la ranura de objeto. |
| R09b | **Probabilidad** del incienso: funciona **siempre** (100 % de huevos bebé), aunque el texto dice "*may help*". | VERIFIED | S9 | El cruce con incienso garantiza el bebé. |
| R10 | Sin incienso, esas familias producen la **siguiente etapa** (p. ej. Marill). | REPORTED | Wiki comunitaria (fandom), coherente con S1/S2 | Los nodos intermedios de esas familias se crían sin incienso y no hace falta evolucionarlos. |
| R11 | Casos especiales oficiales Nidoran♀→Nidoran♂ e Illumise→Volbeat. | UNKNOWN | — | El motor asume que la cría es de la especie de la hembra y **avisa**. |

### IVs

| Id | Regla | Estado | Fuente | Uso en el motor |
|---|---|---|---|---|
| R20 | Se heredan **3 IVs directamente** (de uno u otro progenitor); los **otros 3 son la media** de ambos progenitores **redondeada hacia abajo**. | VERIFIED | S3, S6, S7 | `rules/inheritance.ts › childIvInterval` |
| R21 | Un **brace** (Pesa Recia / Power Weight, Brazal Recio / Power Bracer…) garantiza que el IV de ese stat del portador pase al hijo (cuenta como uno de los 3 directos). Se **consume**. | VERIFIED | S1 (texto del objeto), S3 | Cada progenitor puede llevar un brace. |
| R22 | Si ambos progenitores tienen el **mismo IV** en un stat, el hijo lo tiene garantizado. | VERIFIED | S2 | Es la base del árbol piramidal. |
| R23 | Generalización: si ambos progenitores tienen un stat dentro de `[min,max]`, el hijo también (porque el hijo recibe `a`, `b` o `⌊(a+b)/2⌋`). Permite objetivos como 0 IV de Velocidad. | DERIVED | R20 | `childIvInterval`. |
| R24 | Requisitos mínimos de un cruce para un objetivo de *k* stats: un progenitor necesita `S∖{b}` y el otro `S∖{a}`, donde `a` y `b` son los stats con brace. | DERIVED | R20–R22 | Genera las divisiones del árbol. |
| R25 | Shiny × shiny: 2 IVs con brace, 2 IVs = máximo de los padres, 2 IVs = media. | VERIFIED | S3, S6 | Las garantías de R22–R24 siguen siendo válidas. |

### Naturaleza

| Id | Regla | Estado | Fuente | Uso en el motor |
|---|---|---|---|---|
| R30 | Un progenitor con **Piedraeterna (Everstone)** transmite **siempre** su naturaleza. | VERIFIED | S1 (texto del objeto), S3 | Objeto Piedraeterna. |
| R31 | Es la **única** forma de garantizar la naturaleza. | VERIFIED | S2 | Sin Piedraeterna la naturaleza del nodo es "aleatoria". |
| R32 | La Piedraeterna se **consume** con los padres. | VERIFIED | S3 | Coste por cruce. |
| R33 | Como el portador de la Piedraeterna no lleva brace: el otro progenitor necesita **todos** los stats objetivo y el portador todos menos uno. | DERIVED | R21, R30 | Árbol "con naturaleza". |

### Habilidades

| Id | Regla | Estado | Fuente | Uso en el motor |
|---|---|---|---|---|
| R40 | La **Píldora Habilidad (Ability Pill)** cambia la habilidad (entre todas las disponibles, incluida la oculta si está desbloqueada). | VERIFIED | S1, S4 | La habilidad normal no se planifica por crianza: se añade un paso final "usar Píldora Habilidad" si hace falta. |
| R41 | 80 % de que se herede la habilidad de la madre (si hay dos). | REPORTED (2015) | S3 | Sólo informativo. |
| R42 | La **Habilidad Oculta** pasa "por especie": debe tenerla un progenitor de la **misma línea evolutiva** que el hijo. Si el portador es **macho**, la hembra debe ser de la **misma línea** (o Ditto). Si es **hembra**, sirve cualquier macho compatible (o Ditto). | VERIFIED | S2, S4 | Requisito `ha` sólo en progenitores de la familia del hijo. |
| R43 | Un Ditto con HA **no** desbloquea la HA. | VERIFIED | S4 | Nunca se asigna HA a Ditto. |
| R44 | **Probabilidad** de transmitir la HA (S7 afirma ~60 %). | UNKNOWN | S7 | Aviso en cada cruce que transmite HA. |
| R45 | **Parche de Habilidad (Ability Patch)** desbloquea la HA; **Perla Prismática (Prismatic Pearl)** transfiere la HA dentro de la misma línea. | VERIFIED | S1, S4 | Se sugieren como alternativa. |

### Movimientos huevo

| Id | Regla | Estado | Fuente | Uso en el motor |
|---|---|---|---|---|
| R50 | Los movimientos huevo pasan de especie a especie dentro de grupos huevo compatibles (cadenas, p. ej. Squirtle → Kabuto → Tentacool). El **padre** que conoce el movimiento lo transmite a una cría de otra especie. | VERIFIED | S2 | Búsqueda de cadenas (Dijkstra) `eggMoveChain.ts`. |
| R51 | Sólo se heredan los movimientos de la lista de movimientos huevo de la **especie del huevo**. | VERIFIED | S1, S2 | Validación. |
| R52 | La **madre** también transmite movimientos huevo. | UNKNOWN | — | **Desactivado** por defecto (opción experimental). El motor sólo usa al padre, que es válido en cualquier caso. |
| R53 | PokeMMO trata MT y tutores como movimientos huevo. | VERIFIED | S2 | Esos movimientos se pueden enseñar directamente; en las cadenas cuentan como "aprendibles". |
| R54 | Prioridad: huevo > MT/tutor > nivel; máximo 4 movimientos. | REPORTED | S8 | Máximo 4 movimientos deseados. |
| R55 | **Bolaluminosa (Light Ball)**: si la lleva un **Pikachu** al criar un Pichu, éste aprende **Volt Tackle**. | VERIFIED | S1 (texto del objeto) | Objeto en el cruce final. |
| R56 | Un Pokémon sin género + Ditto transmitiendo movimientos. | UNKNOWN | — | No se planifica. |

### Género, costes y otros

| Id | Regla | Estado | Fuente | Uso en el motor |
|---|---|---|---|---|
| R60 | Se puede **elegir el género** del huevo pagando; el precio depende del ratio de la especie. | VERIFIED | S2, S3, S6, S7 | Coste por nodo con género fijado. |
| R61 | Precios de elección de género: 50/50 → 5.000; género mayoritario → 5.000; minoritario 3:1 → 9.000 (S3) / 10.000 (S7); minoritario 7:1 → 21.000 (S3) / 25.000 (S6, S7). | ESTIMATE | S3, S6, S7 | Valores por defecto 5.000 / 10.000 / 25.000, editables. |
| R62 | Precio de un brace: 10.000. | ESTIMATE | S3, S7 | Editable. |
| R63 | Precio de Piedraeterna, inciensos, Bolaluminosa, Píldora Habilidad y de los Pokémon. | UNKNOWN | — | Sin precio por defecto: el coste se marca como **incompleto** hasta que el usuario lo introduzca. |
| R64 | No hay tarifa adicional por cruce (S2 calcula el coste mínimo sólo con objetos y género). | REPORTED | S2 | Tarifa por cruce = 0, editable. |
| R65 | Un shiny **no** puede criar con un no shiny; shiny × shiny da shiny. | VERIFIED | S2, S3, S6 | Si el objetivo es shiny sólo se usan shinies de la colección. |
| R66 | El estado **alfa** sólo se hereda si ambos padres son alfa. | VERIFIED | S5 | Informativo. |
| R67 | Eclosión: 5 min 20 s (4 min 20 s con Flame Body / Magma Armor). | REPORTED | S2 | Estimación de tiempo. |
| R68 | Cada Pokémon lleva **un solo objeto**. | VERIFIED | Mecánica básica | Un progenitor no puede llevar brace y Piedraeterna a la vez. |

## Qué NO hace el motor (por falta de verificación)

* No calcula probabilidades: sólo planifica con **garantías**. Las características con probabilidad desconocida (HA) se marcan como **no garantizadas**. El incienso está comprobado en el juego al 100 % (R09b).
* No usa la transmisión de movimientos huevo por la madre (R52) salvo que el usuario active la opción experimental.
* No modela los casos especiales Nidoran/Illumise (R11).
