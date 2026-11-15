import { fetchOpenF1Array, positionCutoffIso } from "@/lib/openf1";
import type { F1Session } from "@/types/f1";
import type {
  CarTelemetrySample,
  ChampionshipDriverRow,
  ChampionshipTeamRow,
  DriverLapInfo,
  FastestLap,
  OfficialOvertake,
  PitStop,
  SectorColour,
  SessionInsights,
  TeamRadioClip,
  TrackWeather,
} from "@/types/f1Insights";

type Raw = Record<string, unknown>;

function num(record: Raw, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(record: Raw, key: string): string | null {
  const value = record[key];
  return typeof value === "string" ? value : null;
}

function records(payload: unknown[]): Raw[] {
  return payload.filter((item): item is Raw => Boolean(item) && typeof item === "object");
}

/** Tiene solo i record gia' "accaduti" rispetto al cutoff (replay o live con lag). */
function beforeCutoff(rows: Raw[], cutoffMs: number, key = "date"): Raw[] {
  return rows.filter((row) => {
    const date = str(row, key);
    return date === null || new Date(date).getTime() <= cutoffMs;
  });
}

// Un endpoint che fallisce (beta, 404 senza dati, rate limit) non deve far cadere gli altri.
async function safeFetch(
  endpoint: string,
  params: Record<string, string | number>,
  cacheMs: number,
): Promise<Raw[]> {
  try {
    return records(await fetchOpenF1Array<unknown>(endpoint, params, { cacheMs, timeoutMs: 20000 }));
  } catch {
    return [];
  }
}

function colourFor(value: number | null, personalBest: number | null, overallBest: number | null): SectorColour | null {
  if (value === null) return null;
  if (overallBest !== null && value <= overallBest) return "purple";
  if (personalBest !== null && value <= personalBest) return "green";
  return "yellow";
}

function computeLaps(laps: Raw[]): Pick<SessionInsights, "fastestLap" | "bestSectors" | "lapsByDriver" | "speedTrap"> {
  const sectorKeys = ["duration_sector_1", "duration_sector_2", "duration_sector_3"] as const;
  let fastestLap: FastestLap | null = null;
  const bestSectors: [FastestLap | null, FastestLap | null, FastestLap | null] = [null, null, null];
  const personal = new Map<number, { lap: number | null; sectors: (number | null)[]; topSpeed: number | null }>();
  const latest = new Map<number, Raw>();

  for (const lap of laps) {
    const driverNumber = num(lap, "driver_number");
    const lapNumber = num(lap, "lap_number");
    if (driverNumber === null || lapNumber === null) continue;

    const best = personal.get(driverNumber) ?? { lap: null, sectors: [null, null, null], topSpeed: null };
    const duration = num(lap, "lap_duration");
    const pitOut = lap.is_pit_out_lap === true;

    if (duration !== null && !pitOut) {
      best.lap = best.lap === null ? duration : Math.min(best.lap, duration);
      if (!fastestLap || duration < fastestLap.duration) {
        fastestLap = { driverNumber, lapNumber, duration };
      }
    }

    sectorKeys.forEach((key, index) => {
      const value = num(lap, key);
      if (value === null) return;
      const current = best.sectors[index];
      best.sectors[index] = current === null ? value : Math.min(current, value);
      const overall = bestSectors[index];
      if (!overall || value < overall.duration) {
        bestSectors[index] = { driverNumber, lapNumber, duration: value };
      }
    });

    const speed = num(lap, "st_speed");
    if (speed !== null) {
      best.topSpeed = best.topSpeed === null ? speed : Math.max(best.topSpeed, speed);
    }

    personal.set(driverNumber, best);

    // Ultimo giro con almeno un settore registrato.
    const previous = latest.get(driverNumber);
    if (sectorKeys.some((key) => num(lap, key) !== null) && (!previous || lapNumber > (num(previous, "lap_number") ?? 0))) {
      latest.set(driverNumber, lap);
    }
  }

  const lapsByDriver: Record<number, DriverLapInfo> = {};

  for (const [driverNumber, lap] of latest) {
    const best = personal.get(driverNumber)!;
    const sectors = sectorKeys.map((key) => num(lap, key)) as [number | null, number | null, number | null];
    const duration = num(lap, "lap_duration");

    lapsByDriver[driverNumber] = {
      driverNumber,
      lapNumber: num(lap, "lap_number") ?? 0,
      lapDuration: duration,
      sectors,
      sectorColours: sectors.map((value, index) =>
        colourFor(value, best.sectors[index], bestSectors[index]?.duration ?? null),
      ) as DriverLapInfo["sectorColours"],
      lapColour: colourFor(duration, best.lap, fastestLap?.duration ?? null),
      bestLap: best.lap,
      topSpeed: best.topSpeed,
    };
  }

  const speedTrap = [...personal]
    .filter(([, best]) => best.topSpeed !== null)
    .map(([driverNumber, best]) => ({ driverNumber, speed: best.topSpeed! }))
    .sort((a, b) => b.speed - a.speed)
    .slice(0, 10);

  return { fastestLap, bestSectors, lapsByDriver, speedTrap };
}

export async function fetchSessionInsights(request: Request, session: F1Session): Promise<SessionInsights> {
  const cutoffMs = new Date(positionCutoffIso(request, session)).getTime();
  const sessionKey = session.sessionKey;
  const live = session.isLive;
  const isRace = session.sessionType.toLowerCase().includes("race");
  const shortCache = live ? 8000 : 60000;

  const [radio, pit, weather, overtakes, champDrivers, champTeams, laps, grid] = await Promise.all([
    safeFetch("team_radio", { session_key: sessionKey }, shortCache),
    safeFetch("pit", { session_key: sessionKey }, shortCache),
    safeFetch("weather", { session_key: sessionKey }, live ? 30000 : 300000),
    isRace ? safeFetch("overtakes", { session_key: sessionKey }, shortCache) : Promise.resolve([]),
    isRace ? safeFetch("championship_drivers", { session_key: sessionKey }, live ? 30000 : 600000) : Promise.resolve([]),
    isRace ? safeFetch("championship_teams", { session_key: sessionKey }, live ? 30000 : 600000) : Promise.resolve([]),
    safeFetch("laps", { session_key: sessionKey }, live ? 10000 : 60000),
    // La griglia e' legata alla qualifica: si cerca per meeting.
    isRace ? safeFetch("starting_grid", { meeting_key: session.meetingKey }, 600000) : Promise.resolve([]),
  ]);

  const teamRadio: TeamRadioClip[] = beforeCutoff(radio, cutoffMs)
    .map((row) => ({ driverNumber: num(row, "driver_number") ?? 0, date: str(row, "date") ?? "", url: str(row, "recording_url") ?? "" }))
    .filter((clip) => clip.url && clip.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);

  const pitStops: PitStop[] = beforeCutoff(pit, cutoffMs)
    .map((row) => ({
      driverNumber: num(row, "driver_number") ?? 0,
      date: str(row, "date") ?? "",
      lapNumber: num(row, "lap_number"),
      stopDuration: num(row, "stop_duration"),
      laneDuration: num(row, "lane_duration") ?? num(row, "pit_duration"),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  const lastWeather = beforeCutoff(weather, cutoffMs).sort((a, b) => (str(b, "date") ?? "").localeCompare(str(a, "date") ?? ""))[0];
  const trackWeather: TrackWeather | null = lastWeather
    ? {
        date: str(lastWeather, "date") ?? "",
        trackTemperature: num(lastWeather, "track_temperature"),
        airTemperature: num(lastWeather, "air_temperature"),
        humidity: num(lastWeather, "humidity"),
        windSpeed: num(lastWeather, "wind_speed"),
        windDirection: num(lastWeather, "wind_direction"),
        rainfall: (num(lastWeather, "rainfall") ?? 0) > 0,
      }
    : null;

  const officialOvertakes: OfficialOvertake[] = beforeCutoff(overtakes, cutoffMs)
    .map((row) => ({
      date: str(row, "date") ?? "",
      overtakingDriver: num(row, "overtaking_driver_number") ?? 0,
      overtakenDriver: num(row, "overtaken_driver_number") ?? 0,
      position: num(row, "position") ?? 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40);

  // Il mondiale "live" e' pubblicato a fine gara nei replay: lo mostriamo solo se
  // la sessione e' live o il replay e' arrivato in fondo (i dati non hanno data).
  const sessionEndMs = new Date(session.dateEnd ?? "").getTime();
  const championshipVisible = live || !Number.isFinite(sessionEndMs) || cutoffMs >= sessionEndMs;

  const championshipDrivers: ChampionshipDriverRow[] = championshipVisible
    ? champDrivers
        .map((row) => ({
          driverNumber: num(row, "driver_number") ?? 0,
          positionStart: num(row, "position_start"),
          positionCurrent: num(row, "position_current"),
          pointsStart: num(row, "points_start") ?? 0,
          pointsCurrent: num(row, "points_current") ?? 0,
        }))
        .sort((a, b) => (a.positionCurrent ?? 99) - (b.positionCurrent ?? 99))
    : [];

  const championshipTeams: ChampionshipTeamRow[] = championshipVisible
    ? champTeams
        .map((row) => ({
          teamName: str(row, "team_name") ?? "",
          positionStart: num(row, "position_start"),
          positionCurrent: num(row, "position_current"),
          pointsStart: num(row, "points_start") ?? 0,
          pointsCurrent: num(row, "points_current") ?? 0,
        }))
        .sort((a, b) => (a.positionCurrent ?? 99) - (b.positionCurrent ?? 99))
    : [];

  // Griglia: se il meeting ha piu' griglie (sprint), si prende quella della
  // qualifica piu' recente prima della gara.
  const gridSessions = [...new Set(grid.map((row) => num(row, "session_key") ?? 0))].sort((a, b) => b - a);
  const gridSession = gridSessions.find((key) => key < sessionKey) ?? gridSessions[0];
  const startingGrid: Record<number, number> = {};
  for (const row of grid) {
    const driver = num(row, "driver_number");
    const position = num(row, "position");
    if (num(row, "session_key") === gridSession && driver !== null && position !== null) {
      startingGrid[driver] = position;
    }
  }

  // Un giro conta quando e' completato: data di inizio + durata <= cutoff.
  const completedLaps = laps.filter((lap) => {
    const start = new Date(str(lap, "date_start") ?? "").getTime();
    const duration = num(lap, "lap_duration") ?? 0;
    return Number.isFinite(start) && start + duration * 1000 <= cutoffMs;
  });

  return {
    teamRadio,
    pitStops,
    weather: trackWeather,
    startingGrid,
    overtakes: officialOvertakes,
    championshipDrivers,
    championshipTeams,
    ...computeLaps(completedLaps),
  };
}

/** Ultimi secondi di telemetria (car_data, ~3.7 Hz) per un pilota, fino al cutoff. */
export async function fetchCarTelemetry(
  request: Request,
  session: F1Session,
  driverNumber: number,
): Promise<CarTelemetrySample[]> {
  const cutoff = new Date(positionCutoffIso(request, session));
  const from = new Date(cutoff.getTime() - 6000);
  const rows = await safeFetch(
    "car_data",
    {
      session_key: session.sessionKey,
      driver_number: driverNumber,
      "date>": from.toISOString(),
      "date<": cutoff.toISOString(),
    },
    1000,
  );

  return rows
    .map((row) => ({
      date: str(row, "date") ?? "",
      speed: num(row, "speed") ?? 0,
      rpm: num(row, "rpm") ?? 0,
      gear: num(row, "n_gear") ?? 0,
      throttle: num(row, "throttle") ?? 0,
      brake: num(row, "brake") ?? 0,
      // OpenF1: 10/12/14 = DRS aperto.
      drs: [10, 12, 14].includes(num(row, "drs") ?? 0),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
