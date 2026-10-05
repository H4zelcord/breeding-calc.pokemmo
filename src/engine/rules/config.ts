import type { RuleStatus } from './rulesCatalog';

/** Un precio con su procedencia. `value: null` = desconocido (no se inventa). */
export interface Price {
  value: number | null;
  status: Extract<RuleStatus, 'ESTIMATE' | 'UNKNOWN' | 'REPORTED'> | 'USER';
  note: string;
}

export interface BreedingRules {
  prices: {
    brace: Price;
    everstone: Price;
    incense: Price;
    lightBall: Price;
    abilityPill: Price;
    abilityPatch: Price;
    breedingFee: Price;
    genderEven: Price;
    genderMajority: Price;
    genderMinority25: Price;
    genderMinority12: Price;
    /** Pokémon con 1 IV objetivo (capturado o comprado). */
    acquireBase: Price;
    /** Pokémon con la naturaleza objetivo (sin IVs). */
    acquireNatured: Price;
    acquireDitto: Price;
    /** Pokémon con Habilidad Oculta (alfa, Ability Patch…). */
    acquireHiddenAbility: Price;
    /** Enseñar un movimiento (nivel/MT/tutor). */
    teachMove: Price;
  };
  mechanics: {
    /** R52 (UNKNOWN). Si es true, la madre también puede transmitir movimientos huevo. */
    eggMovesFromMother: boolean;
    /** R44 (UNKNOWN). Probabilidad de transmitir la HA; null = desconocida. */
    hiddenAbilityChance: number | null;
    /** R09b (VERIFIED en el juego): probabilidad de obtener el bebé con incienso. */
    incenseChance: number | null;
    maxMoves: number;
    /** R67 (REPORTED) en segundos. */
    hatchSeconds: number;
  };
}

const unknown = (note: string): Price => ({ value: null, status: 'UNKNOWN', note });

export function defaultRules(): BreedingRules {
  return {
    prices: {
      brace: { value: 10000, status: 'ESTIMATE', note: 'R62: precio del NPC de la guardería según S3/S7.' },
      everstone: unknown('R63: se puede obtener de Geodude/Graveler salvajes (S3) o comprar; precio no verificado.'),
      incense: unknown('R63'),
      lightBall: unknown('R63'),
      abilityPill: unknown('R63'),
      abilityPatch: unknown('R63'),
      breedingFee: { value: 0, status: 'REPORTED', note: 'R64: no hay tarifa por cruce según S2.' },
      genderEven: { value: 5000, status: 'ESTIMATE', note: 'R61: 50/50 → 5.000 (todas las fuentes coinciden).' },
      genderMajority: { value: 5000, status: 'ESTIMATE', note: 'R61: género mayoritario → 5.000 (S3).' },
      genderMinority25: { value: 10000, status: 'ESTIMATE', note: 'R61: minoritario 3:1 → 9.000 (S3) / 10.000 (S7).' },
      genderMinority12: { value: 25000, status: 'ESTIMATE', note: 'R61: minoritario 7:1 → 21.000 (S3) / 25.000 (S6, S7).' },
      acquireBase: unknown('Precio de un Pokémon con 1 IV perfecto: depende del mercado (GTL).'),
      acquireNatured: unknown('Precio de un Pokémon con la naturaleza deseada.'),
      acquireDitto: unknown('Precio de un Ditto con 1 IV perfecto.'),
      acquireHiddenAbility: unknown('Precio de un Pokémon con HA (alfa / Ability Patch).'),
      teachMove: unknown('Coste de enseñar un movimiento (MT/tutor).'),
    },
    mechanics: {
      eggMovesFromMother: false,
      hiddenAbilityChance: null,
      incenseChance: 1,
      maxMoves: 4,
      hatchSeconds: 320,
    },
  };
}

export type PriceKey = keyof BreedingRules['prices'];

export const PRICE_LABELS: Record<PriceKey, string> = {
  brace: 'Brace (Pesa/Brazal/Cinto/Lente/Banda/Franja Recia)',
  everstone: 'Piedraeterna (Everstone)',
  incense: 'Incienso',
  lightBall: 'Bolaluminosa (Light Ball)',
  abilityPill: 'Píldora Habilidad (Ability Pill)',
  abilityPatch: 'Parche de Habilidad (Ability Patch)',
  breedingFee: 'Tarifa por cruce',
  genderEven: 'Elegir género (ratio 50/50)',
  genderMajority: 'Elegir género mayoritario',
  genderMinority25: 'Elegir género minoritario (25 %)',
  genderMinority12: 'Elegir género minoritario (12,5 %)',
  acquireBase: 'Pokémon base (1 IV)',
  acquireNatured: 'Pokémon con naturaleza',
  acquireDitto: 'Ditto (1 IV)',
  acquireHiddenAbility: 'Pokémon con Habilidad Oculta',
  teachMove: 'Enseñar un movimiento',
};
