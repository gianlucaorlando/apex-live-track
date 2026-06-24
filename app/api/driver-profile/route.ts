import { NextResponse } from "next/server";
import {
  normalizeLocale,
  t,
  wikipediaLanguage,
  type Locale,
} from "@/lib/i18n";
import type { DriverProfile, DriverProfileApiResponse } from "@/types/driver";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

interface CacheEntry {
  expiresAt: number;
  value: DriverProfileApiResponse;
}

interface JolpicaDriver {
  driverId: string;
  givenName: string;
  familyName: string;
  code: string | null;
}

interface JolpicaDriverCacheEntry {
  expiresAt: number;
  value: JolpicaDriver[];
}

interface DriverChampionshipsCacheEntry {
  expiresAt: number;
  value: Map<string, number>;
}

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackDriverProfileCache?: Map<string, CacheEntry>;
  __f1LiveTrackJolpicaDriverDirectoryCacheV3?: JolpicaDriverCacheEntry;
  __f1LiveTrackDriverChampionshipsCacheV3?: DriverChampionshipsCacheEntry;
};

const profileCache =
  globalCache.__f1LiveTrackDriverProfileCache ?? new Map<string, CacheEntry>();
globalCache.__f1LiveTrackDriverProfileCache = profileCache;

const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";

const FALLBACK_DRIVER_CHAMPIONSHIPS_BY_ID: Record<string, number> = {
  alonso: 2,
  button: 1,
  hamilton: 7,
  max_verstappen: 4,
  norris: 1,
  raikkonen: 1,
  rosberg: 1,
  vettel: 4,
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

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

function cleanDriverName(value: string): string {
  return value
    .toLocaleLowerCase("en-US")
    .replace(/\b\w/g, (letter) => letter.toLocaleUpperCase("en-US"))
    .replace(/\bJr\b/g, "Jr.")
    .replace(/\bIi\b/g, "II")
    .replace(/\bIii\b/g, "III");
}

function comparableName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchJson(
  url: URL | string,
  timeoutMs = 8000,
  serviceName = "Wikipedia",
): Promise<unknown> {
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
      throw new Error(`${serviceName} ha risposto con ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function parseNumberToken(value: string): number | null {
  const normalized = value.trim().toLocaleLowerCase("en-US");
  const numeric = Number(normalized.replace(/,/g, ""));

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const parts = normalized.split(/[\s-]+/);
  let total = 0;

  for (const part of parts) {
    const number = NUMBER_WORDS[part];

    if (!number) {
      return null;
    }

    total += number;
  }

  return total > 0 ? total : null;
}

function parseWinsFromExtract(extract: string): number | null {
  const patterns = [
    /most wins\s*\(([\d,]+)\)/i,
    /has won\s+([\d,]+|[a-z\s-]+?)\s+(?:Formula One\s+)?Grands Prix/i,
    /has won\s+([\d,]+|[a-z\s-]+?)\s+(?:Formula One\s+)?Grand Prix/i,
    /won\s+([\d,]+|[a-z\s-]+?)\s+(?:Formula One\s+)?Grands Prix/i,
    /ha vinto\s+([\d,]+)\s+(?:Gran Premi|gran premi)/i,
    /vincitore di\s+([\d,]+)\s+(?:Gran Premi|gran premi)/i,
    /gewann\s+([\d,]+)\s+(?:Formel-1-)?(?:Grand Prix|Grands Prix|Rennen)/i,
    /hat\s+([\d,]+)\s+(?:Formel-1-)?(?:Grand Prix|Grands Prix|Rennen)\s+gewonnen/i,
  ];

  for (const pattern of patterns) {
    const match = extract.match(pattern);
    const wins = match?.[1] ? parseNumberToken(match[1]) : null;

    if (wins !== null) {
      return wins;
    }
  }

  return null;
}

function jolpicaEndpoint(path: string): URL {
  return new URL(`${JOLPICA_BASE_URL}/${path}`);
}

function jolpicaDriverTable(payload: unknown): JsonRecord {
  return asRecord(asRecord(asRecord(payload).MRData).DriverTable);
}

async function fetchJolpicaDrivers(): Promise<JolpicaDriver[]> {
  const cached = globalCache.__f1LiveTrackJolpicaDriverDirectoryCacheV3;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const drivers: JolpicaDriver[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const url = jolpicaEndpoint("drivers/");
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(offset));
    const payload = await fetchJson(url, 10000, "Jolpica");
    const meta = asRecord(asRecord(payload).MRData);
    const limit = numberValue(meta, "limit") ?? 100;
    total = numberValue(meta, "total") ?? 0;

    const pageDrivers = arrayValue(jolpicaDriverTable(payload).Drivers)
      .map((rawDriver) => {
        const driver = asRecord(rawDriver);
        const driverId = stringValue(driver, "driverId");

        if (!driverId) {
          return null;
        }

        return {
          driverId,
          givenName: stringValue(driver, "givenName") ?? "",
          familyName: stringValue(driver, "familyName") ?? "",
          code: stringValue(driver, "code"),
        } satisfies JolpicaDriver;
      })
      .filter((driver): driver is JolpicaDriver => driver !== null);

    drivers.push(...pageDrivers);
    offset += limit;

    if (pageDrivers.length === 0) {
      break;
    }
  }

  if (drivers.length === 0) {
    throw new Error("Directory piloti Jolpica non disponibile.");
  }

  globalCache.__f1LiveTrackJolpicaDriverDirectoryCacheV3 = {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    value: drivers,
  };

  return drivers;
}

function jolpicaDriverName(driver: JolpicaDriver): string {
  return [driver.givenName, driver.familyName].filter(Boolean).join(" ");
}

function jolpicaDriverIdCandidates(driverName: string): string[] {
  const tokens = comparableName(cleanDriverName(driverName)).split(" ").filter(Boolean);
  const familyName = tokens[tokens.length - 1];
  const fullId = tokens.join("_");

  return [...new Set([fullId, familyName].filter(Boolean))];
}

function matchJolpicaDriver(
  driverName: string,
  drivers: JolpicaDriver[],
): JolpicaDriver | null {
  const requested = comparableName(cleanDriverName(driverName));
  const requestedTokens = requested.split(" ").filter(Boolean);
  const requestedFamily = requestedTokens[requestedTokens.length - 1];

  if (!requested || !requestedFamily) {
    return null;
  }

  const exact = drivers.find((driver) => comparableName(jolpicaDriverName(driver)) === requested);

  if (exact) {
    return exact;
  }

  return (
    drivers.find((driver) => {
      const fullName = comparableName(jolpicaDriverName(driver));
      const familyName = comparableName(driver.familyName);

      return (
        familyName === requestedFamily &&
        requestedTokens.every((token) => fullName.includes(token))
      );
    }) ?? null
  );
}

async function fetchCareerWinsForDriverId(driverId: string): Promise<number | null> {
  const url = jolpicaEndpoint(`drivers/${driverId}/results/1/`);
  url.searchParams.set("limit", "1");
  const payload = asRecord(await fetchJson(url, 10000, "Jolpica"));

  return numberValue(asRecord(payload.MRData), "total");
}

async function fetchCareerWinsFromJolpica(driverName: string): Promise<number | null> {
  const drivers = await fetchJolpicaDrivers().catch(() => []);
  const driver = matchJolpicaDriver(driverName, drivers);
  const driverIds = driver ? [driver.driverId] : jolpicaDriverIdCandidates(driverName);

  for (const driverId of driverIds) {
    const total = await fetchCareerWinsForDriverId(driverId).catch(() => null);

    if (total !== null) {
      return total;
    }
  }

  return null;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

async function fetchChampionDriverIdForSeason(season: number): Promise<string | null> {
  const url = jolpicaEndpoint(`${season}/driverstandings/1/`);
  url.searchParams.set("limit", "1");
  const payload = asRecord(await fetchJson(url, 10000, "Jolpica"));
  const standingsTable = asRecord(asRecord(payload.MRData).StandingsTable);
  const standingsList = asRecord(arrayValue(standingsTable.StandingsLists)[0]);
  const championStanding = asRecord(arrayValue(standingsList.DriverStandings)[0]);
  const championDriver = asRecord(championStanding.Driver);

  return stringValue(championDriver, "driverId");
}

async function fetchDriverChampionshipsByDriverId(): Promise<Map<string, number>> {
  const cached = globalCache.__f1LiveTrackDriverChampionshipsCacheV3;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const lastCompletedSeason = new Date().getUTCFullYear() - 1;
  const seasons = Array.from(
    { length: Math.max(0, lastCompletedSeason - 1950 + 1) },
    (_, index) => 1950 + index,
  );
  const championIds = await mapWithConcurrency(seasons, 3, async (season) =>
    fetchChampionDriverIdForSeason(season).catch(() => null),
  );
  const championships = new Map<string, number>();

  for (const driverId of championIds) {
    if (driverId) {
      championships.set(driverId, (championships.get(driverId) ?? 0) + 1);
    }
  }

  if (championships.size > 0) {
    globalCache.__f1LiveTrackDriverChampionshipsCacheV3 = {
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      value: championships,
    };
  }

  return championships;
}

async function fetchWorldChampionshipsFromJolpica(driverName: string): Promise<number | null> {
  const [drivers, championships] = await Promise.all([
    fetchJolpicaDrivers().catch(() => []),
    fetchDriverChampionshipsByDriverId().catch(() => new Map<string, number>()),
  ]);
  const driver = matchJolpicaDriver(driverName, drivers);
  const driverIds = driver ? [driver.driverId] : jolpicaDriverIdCandidates(driverName);

  for (const driverId of driverIds) {
    const titles =
      championships.get(driverId) ?? FALLBACK_DRIVER_CHAMPIONSHIPS_BY_ID[driverId];

    if (typeof titles === "number") {
      return titles;
    }
  }

  return driverIds.length > 0 ? 0 : null;
}

function searchTermFor(locale: Locale, driverName: string): string {
  const cleanName = cleanDriverName(driverName);

  if (locale === "de") {
    return `${cleanName} Formel 1 Fahrer`;
  }

  if (locale === "it") {
    return `${cleanName} pilota Formula 1`;
  }

  return `${cleanName} Formula One driver`;
}

async function wikipediaTitleFor(
  driverName: string,
  locale: Locale,
): Promise<string | null> {
  const wikipediaLanguageCode = wikipediaLanguage(locale);
  const searchUrl = new URL(`https://${wikipediaLanguageCode}.wikipedia.org/w/api.php`);
  searchUrl.searchParams.set("action", "query");
  searchUrl.searchParams.set("list", "search");
  searchUrl.searchParams.set("srsearch", searchTermFor(locale, driverName));
  searchUrl.searchParams.set("srlimit", "1");
  searchUrl.searchParams.set("format", "json");

  const payload = asRecord(await fetchJson(searchUrl));
  const results = asRecord(payload.query).search;

  if (!Array.isArray(results) || results.length === 0) {
    return null;
  }

  return stringValue(asRecord(results[0]), "title");
}

function summaryMatchesDriver(summary: JsonRecord, driverName: string): boolean {
  const title = comparableName(stringValue(summary, "title") ?? "");
  const description = stringValue(summary, "description") ?? "";
  const extract = stringValue(summary, "extract") ?? "";
  const text = comparableName(`${description} ${extract}`);
  const requested = comparableName(cleanDriverName(driverName));
  const requestedTokens = requested.split(" ").filter(Boolean);

  if (!title || requestedTokens.length < 2) {
    return false;
  }

  const familyName = requestedTokens[requestedTokens.length - 1];
  const givenTokens = requestedTokens.slice(0, -1);
  const mentionsFormulaOne =
    /\bformula\s*(1|one|uno)\b/.test(text) ||
    /\bformel\s*1\b/.test(text) ||
    /\bf1\b/.test(text);

  return (
    mentionsFormulaOne &&
    title.includes(familyName) &&
    givenTokens.some((token) => title.includes(token))
  );
}

async function wikipediaSummaryForDriver(
  driverName: string,
  locale: Locale,
): Promise<{ summary: JsonRecord; title: string; languageCode: string } | null> {
  const wikipediaLanguageCode = wikipediaLanguage(locale);
  const directTitle = cleanDriverName(driverName);
  const searchedTitle = await wikipediaTitleFor(driverName, locale).catch(() => null);
  const titles = [
    ...new Set(
      [
        directTitle,
        `${directTitle} Jr.`,
        `${directTitle} (pilota automobilistico)`,
        `${directTitle} (racing driver)`,
        `${directTitle} (Rennfahrer)`,
        searchedTitle,
      ].filter(Boolean),
    ),
  ] as string[];

  for (const title of titles) {
    const summaryUrl = `https://${wikipediaLanguageCode}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const summary = asRecord(await fetchJson(summaryUrl).catch(() => null));

    if (summaryMatchesDriver(summary, driverName)) {
      return {
        summary,
        title,
        languageCode: wikipediaLanguageCode,
      };
    }
  }

  return null;
}

async function fetchDriverProfile(
  driverName: string,
  locale: Locale,
): Promise<DriverProfile | null> {
  const wikipediaProfile = await wikipediaSummaryForDriver(driverName, locale);

  if (!wikipediaProfile) {
    return null;
  }

  const { summary, title, languageCode } = wikipediaProfile;
  const contentUrls = asRecord(asRecord(summary.content_urls).desktop);
  const thumbnail = asRecord(summary.thumbnail);
  const extract = stringValue(summary, "extract") ?? "";
  const extractWins = parseWinsFromExtract(extract);
  const jolpicaWins = await fetchCareerWinsFromJolpica(driverName).catch(() => null);
  const worldChampionships = await fetchWorldChampionshipsFromJolpica(driverName).catch(
    () => null,
  );
  const careerWins = jolpicaWins ?? extractWins;

  if (!extract) {
    return null;
  }

  return {
    title: stringValue(summary, "title") ?? title,
    description: stringValue(summary, "description"),
    extract,
    thumbnailUrl: stringValue(thumbnail, "source"),
    pageUrl:
      stringValue(contentUrls, "page") ??
      `https://${languageCode}.wikipedia.org/wiki/${encodeURIComponent(title)}`,
    wins: careerWins,
    worldChampionships,
    wikidataId: stringValue(summary, "wikibase_item"),
    attribution: t(locale, "wikiAttribution"),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const driverName = url.searchParams.get("name")?.trim();
  const locale = normalizeLocale(url.searchParams.get("lang"));
  const cacheKey = driverName ? `v11:${locale}:${cleanDriverName(driverName)}` : "";
  const cached = profileCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  if (!driverName) {
    return NextResponse.json(
      {
        data: null,
        meta: {
          generatedAt: new Date().toISOString(),
          partial: true,
          messages: [
            locale === "it"
              ? "Nome pilota mancante."
              : locale === "de"
                ? "Fahrername fehlt."
                : "Driver name is missing.",
          ],
        },
      } satisfies DriverProfileApiResponse,
      { status: 400 },
    );
  }

  try {
    const profile = await fetchDriverProfile(driverName, locale);
    const payload: DriverProfileApiResponse = {
      data: profile,
      meta: {
        generatedAt: new Date().toISOString(),
        partial:
          profile === null ||
          profile.wins === null ||
          profile.worldChampionships === null,
        messages:
          profile === null
            ? [t(locale, "profileNotFound")]
            : profile.wins === null
              ? [
                  locale === "it"
                    ? "Vittorie non trovate nel riepilogo Wikipedia."
                    : locale === "de"
                      ? "Siege im Wikipedia-Auszug nicht gefunden."
                      : "Wins were not found in the Wikipedia summary.",
                ]
              : profile.worldChampionships === null
                ? [
                    locale === "it"
                      ? "Mondiali piloti non trovati nei dati Jolpica."
                      : locale === "de"
                        ? "Fahrer-WM-Titel in Jolpica nicht gefunden."
                        : "Driver world titles were not found in Jolpica data.",
                  ]
              : [],
      },
    };

    profileCache.set(cacheKey, {
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      value: payload,
    });

    return NextResponse.json(payload, {
      status: profile ? 200 : 404,
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : t(locale, "profileUnavailable");

    return NextResponse.json(
      {
        data: null,
        meta: {
          generatedAt: new Date().toISOString(),
          partial: true,
          messages: [message],
        },
      } satisfies DriverProfileApiResponse,
      { status: 502 },
    );
  }
}
