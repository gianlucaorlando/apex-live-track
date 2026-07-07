import { NextResponse } from "next/server";
import {
  createFallbackCalendarPayload,
  fallbackProviderMessage,
  isFallbackSeason,
} from "@/lib/f1FallbackData";
import {
  apiMessage,
  circuitName,
  countryName,
  normalizeLocale,
  placeName,
  raceName,
  type Locale,
} from "@/lib/i18n";
import type {
  F1CalendarApiResponse,
  F1CalendarPayload,
  F1CalendarRace,
  F1CalendarSession,
  F1CalendarSessionType,
  RacePodiumDriver,
  RaceStatus,
} from "@/types/calendar";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

type PodiumEntry = RacePodiumDriver & { round: number };

interface ResultsByRound {
  lapsByRound: Map<number, number>;
  podiumByRound: Map<number, RacePodiumDriver[]>;
}

interface CacheEntry {
  expiresAt: number;
  value: F1CalendarApiResponse;
}

const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const CALENDAR_CACHE_VERSION = "v4";

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackCalendarCacheV3?: Map<string, CacheEntry>;
};

const calendarCache =
  globalCache.__f1LiveTrackCalendarCacheV3 ?? new Map<string, CacheEntry>();
globalCache.__f1LiveTrackCalendarCacheV3 = calendarCache;

const SESSION_FIELDS: Array<{
  field: string;
  type: F1CalendarSessionType;
}> = [
  { field: "FirstPractice", type: "practice-1" },
  { field: "SecondPractice", type: "practice-2" },
  { field: "ThirdPractice", type: "practice-3" },
  { field: "SprintShootout", type: "sprint-shootout" },
  { field: "SprintQualifying", type: "sprint-qualifying" },
  { field: "Sprint", type: "sprint" },
  { field: "Qualifying", type: "qualifying" },
];

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(record: JsonRecord, key: string): number | null {
  const value = record[key];

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function endpoint(path: string): URL {
  return new URL(`${JOLPICA_BASE_URL}/${path}`);
}

async function fetchJson(url: URL, timeoutMs = 9000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "F1 Live Track local app",
      },
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(`Jolpica ha risposto con ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function raceStartsAt(date: string | null, time: string | null): string {
  const safeDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "1970-01-01";
  const startsAt = new Date(`${safeDate}T${time ?? "00:00:00Z"}`);

  return Number.isNaN(startsAt.getTime())
    ? new Date(`${safeDate}T00:00:00Z`).toISOString()
    : startsAt.toISOString();
}

function sameUtcDay(first: Date, second: Date): boolean {
  return (
    first.getUTCFullYear() === second.getUTCFullYear() &&
    first.getUTCMonth() === second.getUTCMonth() &&
    first.getUTCDate() === second.getUTCDate()
  );
}

function raceStatus(startsAt: string, now = new Date()): RaceStatus {
  const startDate = new Date(startsAt);

  if (startDate.getTime() < now.getTime()) {
    return "past";
  }

  return sameUtcDay(startDate, now) ? "today" : "upcoming";
}

function parseCalendarSession(
  race: JsonRecord,
  field: string,
  type: F1CalendarSessionType,
): F1CalendarSession | null {
  const session = asRecord(race[field]);
  const date = stringValue(session, "date");

  if (!date) {
    return null;
  }

  const time = stringValue(session, "time");
  const startsAt = raceStartsAt(date, time);

  return {
    type,
    date,
    time,
    startsAt,
    status: raceStatus(startsAt),
  };
}

function calendarSessionsForRace(race: JsonRecord): F1CalendarSession[] {
  const sessions = SESSION_FIELDS.map(({ field, type }) =>
    parseCalendarSession(race, field, type),
  ).filter((session): session is F1CalendarSession => session !== null);
  const raceDate = stringValue(race, "date");

  if (raceDate) {
    const raceTime = stringValue(race, "time");
    const startsAt = raceStartsAt(raceDate, raceTime);

    sessions.push({
      type: "race",
      date: raceDate,
      time: raceTime,
      startsAt,
      status: raceStatus(startsAt),
    });
  }

  return sessions.sort(
    (first, second) =>
      new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime(),
  );
}

function parseSeason(value: string | null): string {
  if (!value || value === "current") {
    return "current";
  }

  return /^\d{4}$/.test(value) ? value : "current";
}

function raceTable(payload: unknown): JsonRecord {
  return asRecord(asRecord(asRecord(payload).MRData).RaceTable);
}

function parsePodiums(payload: unknown): PodiumEntry[] {
  const races = arrayValue(raceTable(payload).Races);

  return races.flatMap((rawRace) => {
    const race = asRecord(rawRace);
    const round = numberValue(race, "round");

    if (round === null) {
      return [];
    }

    return arrayValue(race.Results)
      .map((rawResult) => {
        const result = asRecord(rawResult);
        const driver = asRecord(result.Driver);
        const constructor = asRecord(result.Constructor);
        const time = asRecord(result.Time);
        const position = numberValue(result, "position");

        if (position === null || position < 1 || position > 3) {
          return null;
        }

        return {
          round,
          driver: {
            position,
            code:
              stringValue(driver, "code") ??
              stringValue(driver, "permanentNumber") ??
              String(position),
            givenName: stringValue(driver, "givenName") ?? "",
            familyName: stringValue(driver, "familyName") ?? "",
            constructorName: stringValue(constructor, "name") ?? "",
            points: numberValue(result, "points"),
            time: stringValue(time, "time"),
            wikipediaUrl: stringValue(driver, "url"),
          } satisfies RacePodiumDriver,
        };
      })
      .filter(
        (entry): entry is { round: number; driver: RacePodiumDriver } =>
          entry !== null,
      );
  })
    .map((entry): PodiumEntry => ({
      ...entry.driver,
      round: entry.round,
    }));
}

function parseLapsByRound(payload: unknown): Map<number, number> {
  const lapsByRound = new Map<number, number>();

  for (const rawRace of arrayValue(raceTable(payload).Races)) {
    const race = asRecord(rawRace);
    const result = asRecord(arrayValue(race.Results)[0]);
    const round = numberValue(race, "round");
    const laps = numberValue(result, "laps");

    if (round !== null && laps !== null) {
      lapsByRound.set(round, laps);
    }
  }

  return lapsByRound;
}

function parsePodiumPosition(payload: unknown): PodiumEntry[] {
  const races = arrayValue(raceTable(payload).Races);

  return races
    .map((rawRace) => {
      const race = asRecord(rawRace);
      const result = asRecord(arrayValue(race.Results)[0]);
      const driver = asRecord(result.Driver);
      const constructor = asRecord(result.Constructor);
      const time = asRecord(result.Time);
      const round = numberValue(race, "round");
      const position = numberValue(result, "position");

      if (round === null || position === null) {
        return null;
      }

      return {
        round,
        driver: {
          position,
          code:
            stringValue(driver, "code") ??
            stringValue(driver, "permanentNumber") ??
            String(position),
          givenName: stringValue(driver, "givenName") ?? "",
          familyName: stringValue(driver, "familyName") ?? "",
          constructorName: stringValue(constructor, "name") ?? "",
          points: numberValue(result, "points"),
          time: stringValue(time, "time"),
          wikipediaUrl: stringValue(driver, "url"),
        } satisfies RacePodiumDriver,
      };
    })
    .filter(
      (entry): entry is { round: number; driver: RacePodiumDriver } =>
        entry !== null,
    )
    .map((entry): PodiumEntry => ({
      ...entry.driver,
      round: entry.round,
    }));
}

async function fetchAllResultsPayload(season: number): Promise<unknown> {
  const PAGE_SIZE = 100;
  const racesByRound = new Map<string, JsonRecord>();
  let total = Infinity;

  for (let offset = 0; offset < total; offset += PAGE_SIZE) {
    const url = endpoint(`${season}/results/`);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(offset));

    const payload = await fetchJson(url);
    const mr = asRecord(asRecord(payload).MRData);
    total = numberValue(mr, "total") ?? offset + 1;

    for (const rawRace of arrayValue(asRecord(mr.RaceTable).Races)) {
      const race = asRecord(rawRace);
      const key = String(numberValue(race, "round") ?? "");
      const existing = racesByRound.get(key);

      if (existing) {
        existing.Results = [...arrayValue(existing.Results), ...arrayValue(race.Results)];
      } else {
        racesByRound.set(key, { ...race });
      }
    }
  }

  const pages = Math.ceil(total / PAGE_SIZE);
  console.log(`[calendar] Results fetch: total=${total} results, ${pages} page(s), ${racesByRound.size} rounds`);

  const allRaces = [...racesByRound.values()].sort(
    (a, b) => (numberValue(asRecord(a), "round") ?? 0) - (numberValue(asRecord(b), "round") ?? 0),
  );

  return { MRData: { RaceTable: { Races: allRaces }, season: String(season) } };
}

async function fetchPodiumByRound(
  season: number,
  messages: string[],
): Promise<ResultsByRound> {
  const podiumByRound = new Map<number, RacePodiumDriver[]>();
  const lapsByRound = new Map<number, number>();

  try {
    const payload = await fetchAllResultsPayload(season);

    const roundsWithResults = new Set<number>();

    for (const [round, laps] of parseLapsByRound(payload)) {
      lapsByRound.set(round, laps);
    }

    for (const driver of parsePodiums(payload)) {
      const existing = podiumByRound.get(driver.round) ?? [];
      const { round, ...podiumDriver } = driver;
      podiumByRound.set(round, [...existing, podiumDriver]);
      roundsWithResults.add(round);
    }

    console.log(`[calendar] Rounds with podium data: ${[...roundsWithResults].sort((a, b) => a - b).join(", ") || "none"}`);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Ricerca podio non riuscita";
    console.error(`[calendar] Primary results fetch failed: ${reason}`);

    if (/429/.test(reason)) {
      return { lapsByRound, podiumByRound };
    }

    try {
      for (const position of [1, 2, 3]) {
        const url = endpoint(`${season}/results/${position}/`);
        url.searchParams.set("limit", "100");

        const payload = await fetchJson(url);

        for (const [round, laps] of parseLapsByRound(payload)) {
          lapsByRound.set(round, laps);
        }

        for (const driver of parsePodiumPosition(payload)) {
          const existing = podiumByRound.get(driver.round) ?? [];
          const { round, ...podiumDriver } = driver;
          podiumByRound.set(round, [...existing, podiumDriver]);
        }
      }
    } catch (fallbackError) {
      const fallbackReason = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.error(`[calendar] Fallback results fetch also failed: ${fallbackReason}`);
      messages.push(`Podio non disponibile: ${reason}`);
    }
  }

  for (const [round, podium] of podiumByRound) {
    podiumByRound.set(
      round,
      podium.sort((first, second) => first.position - second.position).slice(0, 3),
    );
  }

  return { lapsByRound, podiumByRound };
}

async function fetchCalendarPayload(
  seasonPath: string,
  locale: Locale,
): Promise<F1CalendarApiResponse> {
  const messages: string[] = [];
  const racesUrl = endpoint(`${seasonPath}/races/`);
  racesUrl.searchParams.set("limit", "100");

  const racesPayload = await fetchJson(racesUrl);
  const table = raceTable(racesPayload);
  const rawRaces = arrayValue(table.Races);
  const season =
    numberValue(table, "season") ??
    numberValue(asRecord(rawRaces[0]), "season") ??
    new Date().getUTCFullYear();
  const { lapsByRound, podiumByRound } = await fetchPodiumByRound(season, messages);
  const generatedAt = new Date().toISOString();
  const races: F1CalendarRace[] = rawRaces
    .map((rawRace) => {
      const race = asRecord(rawRace);
      const circuit = asRecord(race.Circuit);
      const location = asRecord(circuit.Location);
      const round = numberValue(race, "round");
      const date = stringValue(race, "date");

      if (round === null || !date) {
        return null;
      }

      const time = stringValue(race, "time");
      const startsAt = raceStartsAt(date, time);
      const status = raceStatus(startsAt);

      return {
        season,
        round,
        raceName: raceName(locale, stringValue(race, "raceName"), stringValue(location, "country")),
        circuitName: circuitName(locale, stringValue(circuit, "circuitName")),
        locality: placeName(locale, stringValue(location, "locality")),
        country: countryName(locale, stringValue(location, "country")),
        date,
        time,
        startsAt,
        laps: lapsByRound.get(round) ?? null,
        status,
        wikipediaUrl: stringValue(race, "url"),
        circuitWikipediaUrl: stringValue(circuit, "url"),
        sessions: calendarSessionsForRace(race),
        podium: status === "past" ? podiumByRound.get(round) ?? [] : [],
      } satisfies F1CalendarRace;
    })
    .filter((race): race is F1CalendarRace => race !== null)
    .sort((first, second) => first.round - second.round);

  if (races.length === 0) {
    messages.push("Calendario non disponibile per la stagione richiesta.");
  }

  const pastWithoutPodium = races.filter(
    (r) => r.status === "past" && r.podium.length === 0,
  );
  if (pastWithoutPodium.length > 0) {
    console.warn(
      `[calendar] ${pastWithoutPodium.length} past race(s) with no podium data: rounds ${pastWithoutPodium.map((r) => r.round).join(", ")}`,
    );
  }

  const payload: F1CalendarPayload = {
    season,
    races,
    generatedAt,
    source: "jolpica",
  };

  return {
    data: payload,
    meta: {
      generatedAt,
      partial: messages.length > 0,
      messages,
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const seasonPath = parseSeason(url.searchParams.get("season"));
  const locale = normalizeLocale(url.searchParams.get("lang"));
  const cacheKey = `${CALENDAR_CACHE_VERSION}:calendar:${seasonPath}:${locale}`;
  const cached = calendarCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    const ttlSec = Math.round((cached.expiresAt - Date.now()) / 1000);
    console.log(`[calendar] Cache hit — key=${cacheKey} ttl=${ttlSec}s`);
    return NextResponse.json(cached.value);
  }

  console.log(`[calendar] Cache miss — fetching key=${cacheKey}`);

  try {
    const payload = await fetchCalendarPayload(seasonPath, locale);

    calendarCache.set(cacheKey, {
      expiresAt: Date.now() + 30 * 60 * 1000,
      value: payload,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=1800",
      },
    });
  } catch (error) {
    if (isFallbackSeason(seasonPath)) {
      const payload = createFallbackCalendarPayload(locale);

      calendarCache.set(cacheKey, {
        expiresAt: Date.now() + 5 * 60 * 1000,
        value: payload,
      });

      return NextResponse.json(
        {
          ...payload,
          meta: {
            ...payload.meta,
            messages: [fallbackProviderMessage(locale)],
          },
        },
        {
          headers: {
            "Cache-Control": "public, max-age=0, s-maxage=300",
          },
        },
      );
    }

    const message = apiMessage(
      locale,
      error instanceof Error ? error.message : "Ricerca calendario non riuscita",
    );
    const generatedAt = new Date().toISOString();
    const payload: F1CalendarApiResponse = {
      data: null,
      meta: {
        generatedAt,
        partial: true,
        messages: [message],
      },
    };

    return NextResponse.json(payload, { status: 502 });
  }
}
