/** Dati extra OpenF1 (team radio, pit, meteo pista, settori, mondiale...) per la sessione. */

export interface TeamRadioClip {
  driverNumber: number;
  date: string;
  url: string;
}

export interface PitStop {
  driverNumber: number;
  date: string;
  lapNumber: number | null;
  /** Tempo da fermo (s). */
  stopDuration: number | null;
  /** Tempo totale in corsia box (s). */
  laneDuration: number | null;
}

export interface TrackWeather {
  date: string;
  trackTemperature: number | null;
  airTemperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  rainfall: boolean;
}

export interface OfficialOvertake {
  date: string;
  overtakingDriver: number;
  overtakenDriver: number;
  position: number;
}

export interface ChampionshipDriverRow {
  driverNumber: number;
  positionStart: number | null;
  positionCurrent: number | null;
  pointsStart: number;
  pointsCurrent: number;
}

export interface ChampionshipTeamRow {
  teamName: string;
  positionStart: number | null;
  positionCurrent: number | null;
  pointsStart: number;
  pointsCurrent: number;
}

/** Colore stile timing F1: viola = migliore assoluto, verde = personale, giallo = altro. */
export type SectorColour = "purple" | "green" | "yellow";

export interface DriverLapInfo {
  driverNumber: number;
  lapNumber: number;
  lapDuration: number | null;
  sectors: [number | null, number | null, number | null];
  sectorColours: [SectorColour | null, SectorColour | null, SectorColour | null];
  lapColour: SectorColour | null;
  bestLap: number | null;
  topSpeed: number | null;
}

export interface FastestLap {
  driverNumber: number;
  lapNumber: number;
  duration: number;
}

export interface SessionInsights {
  teamRadio: TeamRadioClip[];
  pitStops: PitStop[];
  weather: TrackWeather | null;
  /** driverNumber -> posizione in griglia. */
  startingGrid: Record<number, number>;
  overtakes: OfficialOvertake[];
  championshipDrivers: ChampionshipDriverRow[];
  championshipTeams: ChampionshipTeamRow[];
  fastestLap: FastestLap | null;
  bestSectors: [FastestLap | null, FastestLap | null, FastestLap | null];
  lapsByDriver: Record<number, DriverLapInfo>;
  speedTrap: { driverNumber: number; speed: number }[];
  /** Distacco dal leader (s) al passaggio sul traguardo: driverNumber -> giro -> secondi. */
  gapByLap: Record<number, Record<number, number>>;
}

export interface CarTelemetrySample {
  date: string;
  speed: number;
  rpm: number;
  gear: number;
  throttle: number;
  brake: number;
  drs: boolean;
}
