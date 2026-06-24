import { NextResponse } from "next/server";
import {
  createFallbackSeasonStandingsPayload,
  fallbackProviderMessage,
  isFallbackSeason,
} from "@/lib/f1FallbackData";
import { apiMessage, normalizeLocale } from "@/lib/i18n";
import type {
  SeasonConstructorStanding,
  SeasonDriverStanding,
  SeasonStandingsApiResponse,
  SeasonStandingsPayload,
} from "@/types/seasonStandings";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

interface CacheEntry {
  expiresAt: number;
  value: SeasonStandingsApiResponse;
}

const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackSeasonStandingsCache?: Map<string, CacheEntry>;
};

const standingsCache =
  globalCache.__f1LiveTrackSeasonStandingsCache ?? new Map<string, CacheEntry>();
globalCache.__f1LiveTrackSeasonStandingsCache = standingsCache;

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

function parseSeason(value: string | null): string {
  if (!value || value === "current") {
    return "current";
  }

  return /^\d{4}$/.test(value) ? value : "current";
}

function standingsTable(payload: unknown): JsonRecord {
  return asRecord(asRecord(asRecord(payload).MRData).StandingsTable);
}

function firstStandingsList(payload: unknown): JsonRecord {
  return asRecord(arrayValue(standingsTable(payload).StandingsLists)[0]);
}

function parseDriverStandings(payload: unknown): {
  season: number | null;
  round: number | null;
  rows: SeasonDriverStanding[];
} {
  const table = standingsTable(payload);
  const list = firstStandingsList(payload);
  const rows = arrayValue(list.DriverStandings)
    .map((rawStanding) => {
      const standing = asRecord(rawStanding);
      const driver = asRecord(standing.Driver);
      const constructor = asRecord(arrayValue(standing.Constructors)[0]);
      const position = numberValue(standing, "position");

      if (position === null) {
        return null;
      }

      return {
        position,
        positionText: stringValue(standing, "positionText") ?? String(position),
        points: numberValue(standing, "points") ?? 0,
        wins: numberValue(standing, "wins") ?? 0,
        driverId: stringValue(driver, "driverId") ?? "",
        permanentNumber: stringValue(driver, "permanentNumber"),
        code:
          stringValue(driver, "code") ??
          stringValue(driver, "permanentNumber") ??
          String(position),
        givenName: stringValue(driver, "givenName") ?? "",
        familyName: stringValue(driver, "familyName") ?? "",
        nationality: stringValue(driver, "nationality"),
        constructorId: stringValue(constructor, "constructorId") ?? "",
        constructorName: stringValue(constructor, "name") ?? "",
        constructorNationality: stringValue(constructor, "nationality"),
        wikipediaUrl: stringValue(driver, "url"),
      } satisfies SeasonDriverStanding;
    })
    .filter((row): row is SeasonDriverStanding => row !== null)
    .sort((first, second) => first.position - second.position);

  return {
    season: numberValue(list, "season") ?? numberValue(table, "season"),
    round: numberValue(list, "round") ?? numberValue(table, "round"),
    rows,
  };
}

function parseConstructorStandings(payload: unknown): {
  season: number | null;
  round: number | null;
  rows: SeasonConstructorStanding[];
} {
  const table = standingsTable(payload);
  const list = firstStandingsList(payload);
  const rows = arrayValue(list.ConstructorStandings)
    .map((rawStanding) => {
      const standing = asRecord(rawStanding);
      const constructor = asRecord(standing.Constructor);
      const position = numberValue(standing, "position");

      if (position === null) {
        return null;
      }

      return {
        position,
        positionText: stringValue(standing, "positionText") ?? String(position),
        points: numberValue(standing, "points") ?? 0,
        wins: numberValue(standing, "wins") ?? 0,
        constructorId: stringValue(constructor, "constructorId") ?? "",
        name: stringValue(constructor, "name") ?? "",
        nationality: stringValue(constructor, "nationality"),
        wikipediaUrl: stringValue(constructor, "url"),
      } satisfies SeasonConstructorStanding;
    })
    .filter((row): row is SeasonConstructorStanding => row !== null)
    .sort((first, second) => first.position - second.position);

  return {
    season: numberValue(list, "season") ?? numberValue(table, "season"),
    round: numberValue(list, "round") ?? numberValue(table, "round"),
    rows,
  };
}

async function fetchSeasonStandingsPayload(
  seasonPath: string,
): Promise<SeasonStandingsApiResponse> {
  const generatedAt = new Date().toISOString();
  const messages: string[] = [];
  const driverUrl = endpoint(`${seasonPath}/driverstandings/`);
  const constructorUrl = endpoint(`${seasonPath}/constructorstandings/`);
  driverUrl.searchParams.set("limit", "100");
  constructorUrl.searchParams.set("limit", "100");

  const [driverResult, constructorResult] = await Promise.allSettled([
    fetchJson(driverUrl),
    fetchJson(constructorUrl),
  ]);

  const drivers =
    driverResult.status === "fulfilled"
      ? parseDriverStandings(driverResult.value)
      : null;
  const constructors =
    constructorResult.status === "fulfilled"
      ? parseConstructorStandings(constructorResult.value)
      : null;

  if (driverResult.status === "rejected") {
    messages.push(
      `Classifica piloti non disponibile: ${
        driverResult.reason instanceof Error ? driverResult.reason.message : "richiesta non riuscita"
      }`,
    );
  }

  if (constructorResult.status === "rejected") {
    messages.push(
      `Classifica costruttori non disponibile: ${
        constructorResult.reason instanceof Error
          ? constructorResult.reason.message
          : "richiesta non riuscita"
      }`,
    );
  }

  if (!drivers && !constructors) {
    throw new Error("Classifiche F1 non disponibili.");
  }

  const payload: SeasonStandingsPayload = {
    season: drivers?.season ?? constructors?.season ?? new Date().getUTCFullYear(),
    round: drivers?.round ?? constructors?.round ?? 0,
    drivers: drivers?.rows ?? [],
    constructors: constructors?.rows ?? [],
    generatedAt,
    source: "jolpica",
  };

  if (payload.drivers.length === 0) {
    messages.push("Classifica piloti vuota.");
  }

  if (payload.constructors.length === 0) {
    messages.push("Classifica costruttori vuota.");
  }

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
  const cacheKey = `season-standings:${seasonPath}`;
  const cached = standingsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  try {
    const payload = await fetchSeasonStandingsPayload(seasonPath);

    standingsCache.set(cacheKey, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      value: payload,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=600",
      },
    });
  } catch (error) {
    if (isFallbackSeason(seasonPath)) {
      const payload = createFallbackSeasonStandingsPayload(locale);

      standingsCache.set(cacheKey, {
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
      error instanceof Error ? error.message : "Ricerca classifiche non riuscita",
    );
    const generatedAt = new Date().toISOString();
    const payload: SeasonStandingsApiResponse = {
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
