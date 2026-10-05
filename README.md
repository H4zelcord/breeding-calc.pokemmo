# PokeMMO Breeding Planner

Calculadora y planificador de breeding para **PokeMMO**. Introduces el Pokémon que quieres
(IVs, naturaleza, habilidad, Habilidad Oculta, movimientos huevo, género) y tu colección, y el motor
calcula el **árbol completo de crianza**: qué Pokémon usar, con qué género, qué objeto lleva cada uno,
qué aporta cada progenitor y por qué está en el árbol.

Todo lo que muestra la interfaz sale del motor: no hay datos de ejemplo.

## Características

- **Árbol de crianza completo** con zoom, desplazamiento, ramas plegables y panel de información por Pokémon.
- **Rastreo de cada característica**: de qué progenitor viene cada IV, la naturaleza, la HA y cada movimiento huevo.
- **Objetos de cada progenitor** con su nombre oficial del juego (p. ej. *Pesa Recia (Power Weight)*).
- **Mis Pokémon**: tu colección con estados *Disponible*, *OBLIGATORIO* y *PROHIBIDO*.
- **Movimientos huevo entre especies**: busca cadenas de padres compatibles.
- **Casos especiales**: Ditto, especies sin género o de un solo género, bebés con incienso y Volt Tackle.
- **Varias soluciones** según la prioridad (menos cruces, menos dinero, menos Pokémon…), con costes separados.
- **Explicación paso a paso** generada a partir del árbol, incluido el género que hay que elegir.
- **Reglas verificadas de PokeMMO**, documentadas con fuentes. Las no verificables se marcan y no se usan.
- Funciona en el navegador, **sin servidor**: los datos se guardan en `localStorage` y se importan/exportan en JSON.

---

## Instalación y ejecución

Requisitos: Node.js 18 o superior y npm.

```bash
git clone <url-de-este-repositorio>
cd <carpeta-del-repositorio>
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitarios y de integración (Vitest)
npm run build      # build de producción en dist/ (se puede servir como estático)
npm run typecheck
```

El repositorio ya incluye los datos generados (`src/data/generated/`), así que **no hace falta descargar nada
más** para ejecutar la app. La carpeta `data-raw/` sólo se necesita para regenerarlos (ver *Fuentes de datos*).

## Uso

1. **Calculadora → Pokémon deseado**: busca la especie, marca los IVs (rango mínimo-máximo, p. ej. 31-31
   o 0-0), la naturaleza, la habilidad, la HA, los movimientos huevo y el género. Cada característica
   tiene una casilla **Obligatorio** (sí/no). Si una característica no obligatoria hace imposible la solución,
   se descarta y se avisa.
2. **Mis Pokémon**: añade los Pokémon que ya tienes (IVs, naturaleza, habilidad, HA, movimientos,
   cantidad, notas…) y márcalos como **Disponible**, **OBLIGATORIO** o **PROHIBIDO**.
3. Elige el modo **Empezar desde cero** (ignora la colección) o **Usar mis Pokémon**, y la prioridad
   de optimización.
4. **Calcular breeding**. Verás la mejor solución y las alternativas. Para cada una hay tres vistas:
   - **Árbol**: zoom (rueda / botones), pan (arrastrar), contraer y expandir ramas, clic en un Pokémon
     para ver su panel, y **Resaltar origen de…** un IV, la naturaleza, la HA o un movimiento.
   - **Explicar solución**: pasos generados a partir del árbol, con el género que hay que elegir en cada cruce
     y un *Resultado final*.
   - **Lista de Pokémon**: lo que tienes que conseguir o preparar.
5. Puedes **guardar**, **exportar** e **importar** planes y colecciones (JSON).

Los colores del árbol siempre van acompañados de un icono y un texto (accesibilidad):
✓ conseguida · ★ obtenida en este paso (brace) · ↓ heredada (ambos padres) · ✗ pendiente · ◆ habilidad/movimiento especial.

---

## Fuentes de datos

- **Especies, grupos huevo, géneros, habilidades, evoluciones y movimientos**: volcado oficial del cliente
  de PokeMMO publicado en [PokeMMO-Tools/pokemmo-data](https://github.com/PokeMMO-Tools/pokemmo-data)
  (commit `58b840b`, 2025-08-20). Se convierte con `scripts/build-data.mjs` a `src/data/generated/*.json`.
- **Objetos**: nombre oficial en inglés, nombre oficial del cliente en español (`locales/es-ES/item_names.json`)
  y texto in-game, todos del mismo volcado. Se generan en `src/data/generated/items.json`; la app muestra
  "Nombre en español (nombre en inglés)", p. ej. *Pesa Recia (Power Weight)*.
- **Mecánicas**: guías del foro oficial y wikis (ver documento de reglas).
- **Sprites**: [PokeAPI/sprites](https://github.com/PokeAPI/sprites) (se cargan desde la red; si no hay
  conexión se muestra el número).

Regenerar los datos:

```bash
git clone --depth 1 https://github.com/PokeMMO-Tools/pokemmo-data data-raw/pokemmo-data
npm run data   # usa data/*.json y locales/es-ES/item_names.json
```

---

## Arquitectura

```
src/
├── data/                    Datos y modelos (sin UI ni reglas)
│   ├── models.ts            Tipos: especies, familias, IVs, grupos huevo…
│   ├── dex.ts               Acceso a especies, familias, huevo, movimientos
│   ├── natures.ts           25 naturalezas
│   ├── items.ts             Base de datos de objetos de crianza
│   └── generated/           JSON generado desde el volcado de PokeMMO
├── engine/                  Motor de breeding (TypeScript puro, sin React)
│   ├── rules/
│   │   ├── rulesCatalog.ts  Catálogo de reglas con estado y fuentes
│   │   ├── config.ts        BreedingRules: precios y mecánicas configurables
│   │   └── inheritance.ts   Herencia de IVs, compatibilidad, coste de género
│   ├── validation.ts        Validación previa y motivos exactos de imposibilidad
│   ├── requirement.ts       Estado de búsqueda (requisito de un nodo)
│   ├── options.ts           Transiciones: colección / conseguir / cadena / cruce
│   ├── eggMoveChain.ts      Dijkstra de cadenas de movimientos huevo
│   ├── search.ts            Heurística (DP relajada) + A* con inventario
│   ├── cost.ts              Función de coste y perfiles (separados del motor)
│   ├── planBuilder.ts       Decisiones → árbol (recalcula garantías con las reglas)
│   ├── explain.ts           Explicación paso a paso a partir del árbol
│   └── BreedingEngine.ts    Fachada: DesiredPokemon + colección + reglas + opciones → BreedingPlan
├── persistence/storage.ts   Interfaz KeyValueStore (localStorage hoy, backend mañana) + import/export
├── engine.worker.ts         El motor se ejecuta en un Web Worker
└── ui/                      React: páginas, componentes, árbol
tests/                       Vitest
docs/POKEMMO_BREEDING_RULES.md
```

La UI nunca contiene reglas de breeding: llama a `BreedingEngine.plan()` (a través del worker) y pinta el resultado.

### Motor de breeding

Entrada: `DesiredPokemon`, `OwnedPokemon[]`, `BreedingRules`, `PlannerOptions`.
Salida: `BreedingPlan { target, best, alternatives[], warnings[], errors[], info[] }`, donde cada solución
tiene `nodes` (árbol), `steps`, `stats`, `cost`, `items`, `requiredPokemon`, `optionalPokemon`.

```ts
import { BreedingEngine, defaultOptions, defaultRules, emptyDesired } from './src/engine';
const d = emptyDesired(445);                                    // Garchomp
d.ivs.speed = { min: 31, max: 31, priority: 'required' };
d.nature = 'Jolly';
const plan = new BreedingEngine().plan({ desired: d, owned: [], rules: defaultRules(), options: defaultOptions() });
```

### Algoritmo de búsqueda

El problema se modela como **planificación AND-OR**:

- **Estado** = un *requisito* para un Pokémon: intervalo de cada IV, naturaleza, movimientos, HA,
  género y restricción de especie (familia exacta, "macho compatible con X" o Ditto).
- **Transiciones** para satisfacer un requisito:
  1. usar un Pokémon de la colección (se consume: respeta la cantidad),
  2. conseguirlo (sólo requisitos de una característica: 1 IV, naturaleza o HA),
  3. una **cadena de movimientos huevo** (Dijkstra sobre familia × subconjunto de movimientos),
  4. **criarlo**: elegir familia, tipo de pareja (estándar, Ditto, sin género), quién lleva Piedraeterna /
     incienso / Bolaluminosa, quién lleva la HA y los movimientos, y qué brace lleva cada padre. Cada cruce
     abre dos requisitos estrictamente más pequeños (R24), lo que garantiza la terminación.
- **Heurística**: programación dinámica con memo sobre el problema relajado (la colección se puede reutilizar
  y se ignoran los obligatorios). Es una cota inferior admisible; se recalcula cuando un Pokémon de la colección
  se agota.
- **A\***: sobre árboles parciales con el uso de la colección en el estado, poda por dominancia
  (mismo conjunto de requisitos abiertos y mismo uso) y penalización para los **OBLIGATORIOS** que ya no se
  pueden colocar. La búsqueda es *anytime*: A\* ponderado (w = 3) para obtener una cota, mejora con w = 1,5 y
  A\* exacto (w = 1) acotado. Si el exacto agota el espacio, la solución está demostrada como óptima; si se
  alcanza el presupuesto, la solución es válida y se indica que puede no ser óptima.
- **Alternativas**: las siguientes soluciones distintas de A\* y las óptimas para otros perfiles de coste
  (mínimos cruces, mínimo dinero, mínimos Pokémon, conservar colección) y "sólo obligatorias".

### Función de coste

`coste = Σ pesos × (cruces, Pokémon consumidos, Pokémon a conseguir, dinero/1000, uso de la colección)`
y, al ordenar, `+ peso × generaciones`. Los pesos se editan en *Configuración*, y los perfiles están en
`src/engine/cost.ts`. Los costes monetarios separan **Pokémon / objetos / crianza** y distinguen
**coste exacto** (todos los precios introducidos por el usuario) de **estimación**. Los precios desconocidos
no se inventan: no se suman y se avisa.

---

## Extender

- **Añadir/actualizar Pokémon o movimientos**: actualiza el volcado (`data-raw/pokemmo-data`) y ejecuta
  `npm run data`. Los movimientos huevo, los aprendibles y los grupos huevo salen de ahí.
- **Añadir un objeto**: añade su id interno a `BREEDING_ITEM_IDS` en `scripts/build-data.mjs`, ejecuta
  `npm run data` y añade una entrada a `BREEDING_ITEMS` en `src/data/items.ts` con su efecto, restricciones y
  reglas (el nombre y el texto se leen de los datos generados, no se escriben a mano). Si tiene un efecto nuevo durante la crianza, añade el tipo en `ItemEffect`
  y su uso en `engine/options.ts` (reparto de objetos especiales).
- **Modificar una regla**:
  1. documenta el cambio en `docs/POKEMMO_BREEDING_RULES.md` y en `src/engine/rules/rulesCatalog.ts`;
  2. las reglas numéricas o de herencia están en `src/engine/rules/inheritance.ts`; las mecánicas
     configurables (precios, opción R52…) en `src/engine/rules/config.ts`; la generación de cruces en
     `src/engine/options.ts`;
  3. `tests/helpers.ts › verifySolution` vuelve a comprobar cada árbol con las reglas: ajústalo si cambia una regla.

## Tests

```bash
npm test
```

102 tests: nombres oficiales de objetos, herencia de cada stat, intervalos de IVs, braces, naturaleza, habilidad, HA, movimientos huevo
(cadenas y combinaciones), grupos huevo, géneros, Ditto, sin género, bebés e inciensos, Volt Tackle, objetos,
costes, colección (disponible, obligatorio, prohibido, cantidades, shiny), casos imposibles, múltiples
soluciones, persistencia, importación/exportación y casos completos de principio a fin.
Cada árbol generado en los tests se valida de forma independiente (`verifySolution`).

---

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `src/` | Código de la app (datos, motor, persistencia, UI) |
| `src/data/generated/` | Datos generados desde el volcado de PokeMMO (se versionan) |
| `tests/` | Tests (Vitest) |
| `docs/` | Documentación de las reglas de breeding |
| `scripts/build-data.mjs` | Generador de datos |
| `LICENSE` | Licencia MIT |

No se suben (`.gitignore`): `node_modules/`, `dist/`, `data-raw/` (volcado en bruto, ≈12 MB) ni la configuración
local de editores y herramientas.

## Créditos y aviso legal

- Datos del juego: [PokeMMO-Tools/pokemmo-data](https://github.com/PokeMMO-Tools/pokemmo-data) (mantenido por
  PokeMMOHub). Su README pide que se cite el repositorio al usar los datos.
- Sprites: [PokeAPI/sprites](https://github.com/PokeAPI/sprites).
- Mecánicas: guías y foros de la comunidad de PokeMMO (ver [docs/POKEMMO_BREEDING_RULES.md](docs/POKEMMO_BREEDING_RULES.md)).

Proyecto de fans sin ánimo de lucro. **No está afiliado a PokeMMO** ni a Nintendo, Game Freak, Creatures o
The Pokémon Company. Pokémon y sus nombres son marcas registradas de sus respectivos propietarios.

## Licencia

El código se publica bajo la licencia [MIT](LICENSE). Los datos del juego, los nombres y los sprites
pertenecen a sus respectivos propietarios y no están cubiertos por esta licencia.
