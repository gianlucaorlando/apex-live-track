import { NextResponse } from "next/server";
import {
  countryName,
  normalizeLocale,
  placeName,
  weatherCodeDescription,
  type Locale,
} from "@/lib/i18n";
import type { RaceWeather, WeatherApiResponse, WeatherCondition } from "@/types/weather";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

interface CacheEntry {
  expiresAt: number;
  value: WeatherApiResponse;
}

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackWeatherCache?: Map<string, CacheEntry>;
};

const weatherCache =
  globalCache.__f1LiveTrackWeatherCache ?? new Map<string, CacheEntry>();
globalCache.__f1LiveTrackWeatherCache = weatherCache;

const ALPHA_3_TO_2: Record<string, string> = {
  ARE: "AE",
  AUS: "AU",
  AUT: "AT",
  AZE: "AZ",
  BEL: "BE",
  BHR: "BH",
  BRA: "BR",
  CAN: "CA",
  CHN: "CN",
  ESP: "ES",
  GBR: "GB",
  HUN: "HU",
  ITA: "IT",
  JPN: "JP",
  MCO: "MC",
  MEX: "MX",
  NLD: "NL",
  QAT: "QA",
  SAU: "SA",
  SGP: "SG",
  USA: "US",
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function stringValue(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(record: JsonRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeCountryCode(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const upper = value.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(upper)) {
    return upper;
  }

  return ALPHA_3_TO_2[upper] ?? null;
}

async function fetchJson(url: URL, timeoutMs = 7000): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const reason = stringValue(asRecord(payload), "reason");
      throw new Error(reason ?? `API meteo ha risposto con ${response.status}`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function weatherCodeToCondition(locale: Locale, code: number | null): {
  condition: WeatherCondition;
  description: string;
} {
  if (code === null) {
    return { condition: "unknown", description: weatherCodeDescription(locale, code) };
  }

  if (code === 0) {
    return { condition: "clear", description: weatherCodeDescription(locale, code) };
  }

  if ([1, 2, 3].includes(code)) {
    return { condition: "cloudy", description: weatherCodeDescription(locale, code) };
  }

  if ([45, 48].includes(code)) {
    return { condition: "fog", description: weatherCodeDescription(locale, code) };
  }

  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { condition: "rain", description: weatherCodeDescription(locale, code) };
  }

  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { condition: "snow", description: weatherCodeDescription(locale, code) };
  }

  if ([95, 96, 99].includes(code)) {
    return { condition: "storm", description: weatherCodeDescription(locale, code) };
  }

  return { condition: "unknown", description: weatherCodeDescription(locale, code) };
}

function buildSearchCandidates(url: URL): string[] {
  const location = url.searchParams.get("location")?.trim();
  const country = url.searchParams.get("country")?.trim();
  const circuit = url.searchParams.get("circuit")?.trim();
  const candidates = [
    location ?? "",
    circuit ?? "",
    [location, country].filter(Boolean).join(" "),
    [circuit, country].filter(Boolean).join(" "),
    country ?? "",
  ];

  return [...new Set(candidates.filter((candidate) => candidate.length > 0))];
}

async function geocode(url: URL, locale: Locale) {
  const countryCode = normalizeCountryCode(url.searchParams.get("country_code"));
  const candidates = buildSearchCandidates(url);

  for (const candidate of candidates) {
    for (const withCountryCode of [true, false]) {
      const geocodeUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
      geocodeUrl.searchParams.set("name", candidate);
      geocodeUrl.searchParams.set("count", "5");
      geocodeUrl.searchParams.set("language", locale);
      geocodeUrl.searchParams.set("format", "json");

      if (withCountryCode && countryCode) {
        geocodeUrl.searchParams.set("country_code", countryCode);
      }

      const payload = asRecord(await fetchJson(geocodeUrl));
      const results = payload.results;

      if (!Array.isArray(results) || results.length === 0) {
        continue;
      }

      const match = asRecord(results[0]);
      const latitude = numberValue(match, "latitude");
      const longitude = numberValue(match, "longitude");

      if (latitude === null || longitude === null) {
        continue;
      }

      return {
        latitude,
        longitude,
        name: placeName(locale, stringValue(match, "name") ?? candidate),
        country: countryName(locale, stringValue(match, "country") ?? url.searchParams.get("country")),
      };
    }
  }

  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("lang"));
  const cacheKey = `${locale}-v3:${url.searchParams.toString()}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  try {
    const place = await geocode(url, locale);

    if (!place) {
      const payload: WeatherApiResponse = {
        data: null,
        meta: {
          generatedAt: new Date().toISOString(),
          partial: true,
          messages: [
            locale === "it"
              ? "Localita meteo non geocodificata."
              : locale === "de"
                ? "Wetterort nicht geokodiert."
                : "Weather location was not geocoded.",
          ],
        },
      };

      return NextResponse.json(payload, { status: 404 });
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(place.latitude));
    forecastUrl.searchParams.set("longitude", String(place.longitude));
    forecastUrl.searchParams.set(
      "current",
      [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation",
        "rain",
        "weather_code",
        "cloud_cover",
        "wind_speed_10m",
      ].join(","),
    );
    forecastUrl.searchParams.set("timezone", "auto");

    const forecast = asRecord(await fetchJson(forecastUrl));
    const current = asRecord(forecast.current);
    const weatherCode = numberValue(current, "weather_code");
    const condition = weatherCodeToCondition(locale, weatherCode);
    const data: RaceWeather = {
      locationName: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      observedAt: stringValue(current, "time") ?? new Date().toISOString(),
      temperatureC: numberValue(current, "temperature_2m"),
      humidityPercent: numberValue(current, "relative_humidity_2m"),
      precipitationMm: numberValue(current, "precipitation"),
      rainMm: numberValue(current, "rain"),
      cloudCoverPercent: numberValue(current, "cloud_cover"),
      windSpeedKmh: numberValue(current, "wind_speed_10m"),
      weatherCode,
      condition: condition.condition,
      description: condition.description,
      attribution:
        locale === "it"
          ? "Meteo fornito da Open-Meteo"
          : locale === "de"
            ? "Wetter von Open-Meteo"
            : "Weather by Open-Meteo",
    };
    const payload: WeatherApiResponse = {
      data,
      meta: {
        generatedAt: new Date().toISOString(),
        partial: false,
        messages: [],
      },
    };

    weatherCache.set(cacheKey, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      value: payload,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : locale === "it"
          ? "Errore API meteo"
          : locale === "de"
            ? "Wetter-API-Fehler"
            : "Weather API error";

    return NextResponse.json(
      {
        data: null,
        meta: {
          generatedAt: new Date().toISOString(),
          partial: true,
          messages: [message],
        },
      } satisfies WeatherApiResponse,
      { status: 502 },
    );
  }
}
