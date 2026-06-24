import { formatGap, formatInterval, safeTeamColour } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { getLatestLocationByDriver } from "@/lib/track";
import type {
  F1Driver,
  F1Interval,
  F1Lap,
  F1LocationPoint,
  F1Meeting,
  F1Position,
  F1TyreStint,
  RaceControlMessage,
  F1Session,
  F1SessionResult,
  F1SessionStatus,
  LiveStandingRow,
} from "@/types/f1";

type SourceRecord = Record<string, unknown>;

function asRecord(value: unknown): SourceRecord {
  return value && typeof value === "object" ? (value as SourceRecord) : {};
}

function stringValue(record: SourceRecord, key: string, fallback = ""): string {
  const value = record[key];
  return typeof value === "string" ? value : fallback;
}

function nullableString(record: SourceRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(record: SourceRecord, key: string, fallback = 0): number {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nullableNumber(record: SourceRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(record: SourceRecord, key: string): boolean {
  return record[key] === true;
}

function gapValue(record: SourceRecord, key: string): number | string | null {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  return null;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getSessionStatus(
  dateStart: string,
  dateEnd: string,
  isCancelled: boolean,
  now = new Date(),
): Pick<F1Session, "status" | "isLive" | "isToday"> {
  if (isCancelled) {
    return {
      status: "no-session-today",
      isLive: false,
      isToday: false,
    };
  }

  const start = new Date(dateStart);
  const end = new Date(dateEnd);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      status: "replay",
      isLive: false,
      isToday: false,
    };
  }

  const isToday = sameLocalDay(start, now) || sameLocalDay(end, now);
  const isLive = now >= start && now <= end;

  let status: F1SessionStatus = "replay";
  if (isLive) {
    status = "live";
  } else if (isToday && now > end) {
    status = "finished";
  } else if (!isToday) {
    status = "no-session-today";
  }

  return {
    status,
    isLive,
    isToday,
  };
}

export function normalizeSession(raw: unknown): F1Session {
  const record = asRecord(raw);
  const dateStart = stringValue(record, "date_start");
  const dateEnd = stringValue(record, "date_end");
  const isCancelled = booleanValue(record, "is_cancelled");
  const status = getSessionStatus(dateStart, dateEnd, isCancelled);

  return {
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    sessionName: stringValue(record, "session_name", "Session"),
    sessionType: stringValue(record, "session_type", "Session"),
    dateStart,
    dateEnd,
    circuitKey: nullableNumber(record, "circuit_key"),
    circuitShortName: stringValue(record, "circuit_short_name", "Circuit"),
    countryCode: stringValue(record, "country_code"),
    countryName: stringValue(record, "country_name", "Unknown country"),
    location: stringValue(record, "location"),
    year: numberValue(record, "year"),
    isCancelled,
    ...status,
  };
}

export function normalizeMeeting(raw: unknown): F1Meeting {
  const record = asRecord(raw);

  return {
    meetingKey: numberValue(record, "meeting_key"),
    meetingName: stringValue(record, "meeting_name", "Grand Prix"),
    meetingOfficialName: stringValue(record, "meeting_official_name", "Grand Prix"),
    circuitKey: nullableNumber(record, "circuit_key"),
    circuitShortName: stringValue(record, "circuit_short_name", "Circuit"),
    circuitImage: nullableString(record, "circuit_image"),
    circuitInfoUrl: nullableString(record, "circuit_info_url"),
    circuitType: nullableString(record, "circuit_type"),
    countryCode: stringValue(record, "country_code"),
    countryName: stringValue(record, "country_name", "Unknown country"),
    location: stringValue(record, "location"),
    dateStart: stringValue(record, "date_start"),
    dateEnd: stringValue(record, "date_end"),
    year: numberValue(record, "year"),
  };
}

export function normalizeDriver(raw: unknown): F1Driver {
  const record = asRecord(raw);
  const driverNumber = numberValue(record, "driver_number");

  return {
    driverNumber,
    broadcastName: stringValue(record, "broadcast_name", `#${driverNumber}`),
    fullName: stringValue(record, "full_name", `Driver ${driverNumber}`),
    acronym: stringValue(record, "name_acronym", String(driverNumber)),
    teamName: stringValue(record, "team_name", "Unknown team"),
    teamColour: safeTeamColour(nullableString(record, "team_colour")),
    firstName: stringValue(record, "first_name"),
    lastName: stringValue(record, "last_name"),
    headshotUrl: nullableString(record, "headshot_url"),
    countryCode: stringValue(record, "country_code"),
  };
}

export function normalizeLocationPoint(raw: unknown): F1LocationPoint {
  const record = asRecord(raw);

  return {
    date: stringValue(record, "date"),
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    driverNumber: numberValue(record, "driver_number"),
    x: numberValue(record, "x"),
    y: numberValue(record, "y"),
    z: nullableNumber(record, "z"),
  };
}

export function normalizePosition(raw: unknown): F1Position {
  const record = asRecord(raw);

  return {
    date: stringValue(record, "date"),
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    driverNumber: numberValue(record, "driver_number"),
    position: numberValue(record, "position", Number.MAX_SAFE_INTEGER),
  };
}

export function normalizeInterval(raw: unknown): F1Interval {
  const record = asRecord(raw);

  return {
    date: stringValue(record, "date"),
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    driverNumber: numberValue(record, "driver_number"),
    gapToLeader: gapValue(record, "gap_to_leader"),
    interval: gapValue(record, "interval"),
  };
}

export function normalizeLap(raw: unknown): F1Lap {
  const record = asRecord(raw);

  return {
    dateStart: nullableString(record, "date_start"),
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    driverNumber: numberValue(record, "driver_number"),
    lapNumber: numberValue(record, "lap_number"),
  };
}

export function normalizeTyreStint(raw: unknown): F1TyreStint {
  const record = asRecord(raw);

  return {
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    driverNumber: numberValue(record, "driver_number"),
    compound: stringValue(record, "compound"),
    stintNumber: numberValue(record, "stint_number"),
    lapStart: nullableNumber(record, "lap_start"),
    lapEnd: nullableNumber(record, "lap_end"),
    tyreAgeAtStart: nullableNumber(record, "tyre_age_at_start"),
  };
}

export function normalizeSessionResult(raw: unknown): F1SessionResult {
  const record = asRecord(raw);

  return {
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    driverNumber: numberValue(record, "driver_number"),
    position: nullableNumber(record, "position"),
    gapToLeader: gapValue(record, "gap_to_leader"),
    duration: gapValue(record, "duration"),
    numberOfLaps: nullableNumber(record, "number_of_laps"),
    dnf: booleanValue(record, "dnf"),
    dns: booleanValue(record, "dns"),
    dsq: booleanValue(record, "dsq"),
  };
}

export function normalizeRaceControlMessage(raw: unknown): RaceControlMessage {
  const record = asRecord(raw);

  return {
    date: stringValue(record, "date"),
    sessionKey: numberValue(record, "session_key"),
    meetingKey: numberValue(record, "meeting_key"),
    category: stringValue(record, "category", "Message"),
    message: stringValue(record, "message"),
    driverNumber: nullableNumber(record, "driver_number"),
    flag: nullableString(record, "flag"),
    lapNumber: nullableNumber(record, "lap_number"),
    scope: nullableString(record, "scope"),
    sector: nullableNumber(record, "sector"),
    qualifyingPhase: nullableString(record, "qualifying_phase"),
  };
}

function latestByDriver<T extends { driverNumber: number; date?: string }>(
  items: T[],
): Map<number, T> {
  const latest = new Map<number, T>();

  for (const item of items) {
    const current = latest.get(item.driverNumber);
    const itemTime = item.date ? new Date(item.date).getTime() : 0;
    const currentTime = current?.date ? new Date(current.date).getTime() : -1;

    if (!current || itemTime >= currentTime) {
      latest.set(item.driverNumber, item);
    }
  }

  return latest;
}

function latestLapByDriver(laps: F1Lap[]): Map<number, F1Lap> {
  const latest = new Map<number, F1Lap>();

  for (const lap of laps) {
    const current = latest.get(lap.driverNumber);

    if (!current || lap.lapNumber >= current.lapNumber) {
      latest.set(lap.driverNumber, lap);
    }
  }

  return latest;
}

function tyreInfoByDriver(
  stints: F1TyreStint[],
  laps: F1Lap[],
): Map<number, LiveStandingRow["tyre"]> {
  const latestLap = latestLapByDriver(laps);
  const byDriver = new Map<number, F1TyreStint[]>();

  for (const stint of stints) {
    if (!stint.driverNumber || !stint.compound) {
      continue;
    }

    const driverStints = byDriver.get(stint.driverNumber) ?? [];
    driverStints.push(stint);
    byDriver.set(stint.driverNumber, driverStints);
  }

  const result = new Map<number, LiveStandingRow["tyre"]>();

  for (const [driverNumber, driverStints] of byDriver) {
    const currentLap = latestLap.get(driverNumber)?.lapNumber ?? null;
    const sorted = [...driverStints].sort((a, b) => {
      const startDelta = (a.lapStart ?? 0) - (b.lapStart ?? 0);
      return startDelta !== 0 ? startDelta : a.stintNumber - b.stintNumber;
    });
    const currentStint =
      currentLap !== null
        ? sorted.find((stint) => {
            const lapStart = stint.lapStart ?? 1;
            const lapEnd = stint.lapEnd ?? Number.MAX_SAFE_INTEGER;
            return lapStart <= currentLap && currentLap <= lapEnd;
          }) ??
          sorted
            .filter((stint) => (stint.lapStart ?? 1) <= currentLap)
            .at(-1)
        : sorted.at(-1);

    if (!currentStint) {
      continue;
    }

    const lapStart = currentStint.lapStart ?? null;
    const ageLaps =
      currentLap !== null && lapStart !== null
        ? Math.max(
            0,
            (currentStint.tyreAgeAtStart ?? 0) + currentLap - lapStart,
          )
        : currentStint.tyreAgeAtStart;

    result.set(driverNumber, {
      compound: currentStint.compound,
      stintNumber: currentStint.stintNumber,
      lapStart,
      lapEnd: currentStint.lapEnd,
      currentLap,
      ageLaps,
    });
  }

  return result;
}

function totalLapsFromResults(results: F1SessionResult[]): number | null {
  const laps = results
    .map((result) => result.numberOfLaps)
    .filter((value): value is number => typeof value === "number" && value > 0);

  return laps.length > 0 ? Math.max(...laps) : null;
}

export function buildStandings({
  drivers,
  positions,
  intervals,
  locations,
  tyreStints = [],
  laps = [],
  sessionResults = [],
  locale = "it",
}: {
  drivers: F1Driver[];
  positions: F1Position[];
  intervals: F1Interval[];
  locations: F1LocationPoint[];
  tyreStints?: F1TyreStint[];
  laps?: F1Lap[];
  sessionResults?: F1SessionResult[];
  locale?: Locale;
}): LiveStandingRow[] {
  const latestPosition = latestByDriver(positions);
  const latestInterval = latestByDriver(intervals);
  const latestLocation = getLatestLocationByDriver(locations);
  const latestLap = latestLapByDriver(laps);
  const totalLaps = totalLapsFromResults(sessionResults);
  const useSessionResultFallback = positions.length === 0;
  const tyres = tyreInfoByDriver(tyreStints, laps);
  const resultByDriver = new Map(
    sessionResults.map((result) => [result.driverNumber, result]),
  );

  return drivers
    .map((driver) => {
      const position = latestPosition.get(driver.driverNumber);
      const interval = latestInterval.get(driver.driverNumber);
      const result = resultByDriver.get(driver.driverNumber);
      const currentLap =
        latestLap.get(driver.driverNumber)?.lapNumber ??
        (useSessionResultFallback ? result?.numberOfLaps : null) ??
        null;
      const currentPosition =
        position?.position ?? (useSessionResultFallback ? result?.position : null) ?? null;
      const rawGap =
        interval?.gapToLeader ??
        (useSessionResultFallback ? result?.gapToLeader : null) ??
        null;
      const rawInterval = interval?.interval ?? null;
      const lapped =
        typeof rawGap === "string" &&
        rawGap.toLocaleUpperCase("en-US").includes("LAP");

      return {
        driverNumber: driver.driverNumber,
        acronym: driver.acronym,
        fullName: driver.fullName,
        headshotUrl: driver.headshotUrl,
        teamName: driver.teamName,
        teamColour: driver.teamColour,
        position: currentPosition,
        gap: formatGap(rawGap, currentPosition, locale),
        interval: formatInterval(rawInterval, currentPosition, locale),
        status:
          useSessionResultFallback && (result?.dnf || result?.dns || result?.dsq)
            ? "OUT"
            : lapped
              ? "LAPPED"
              : null,
        tyre: tyres.get(driver.driverNumber) ?? null,
        currentLap,
        totalLaps,
        latestLocation: latestLocation.get(driver.driverNumber) ?? null,
        updatedAt: interval?.date ?? position?.date ?? null,
      } satisfies LiveStandingRow;
    })
    .sort((a, b) => {
      if (a.position === null && b.position === null) {
        return a.driverNumber - b.driverNumber;
      }

      if (a.position === null) {
        return 1;
      }

      if (b.position === null) {
        return -1;
      }

      return a.position - b.position;
    });
}
