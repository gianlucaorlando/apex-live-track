import { NextResponse } from "next/server";
import type { CircuitPhoto, CircuitPhotoApiResponse } from "@/types/circuit";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

interface CacheEntry {
  expiresAt: number;
  value: CircuitPhotoApiResponse;
}

interface ScoredEventPhoto {
  photo: CircuitPhoto;
  query: string;
  score: number;
}

const COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php";
const CACHE_VERSION = "event-photo-v3";
const STRONG_PHOTO_SCORE = 120;

const CURATED_EVENT_PHOTOS: Array<{ keywords: string[]; photo: CircuitPhoto }> = [
  {
    keywords: ["singapore", "marina bay"],
    photo: {
      imageUrl:
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/af/Formula_One_Grand_Prix_Singapore_2013_-_Ferrari_3.jpg/1280px-Formula_One_Grand_Prix_Singapore_2013_-_Ferrari_3.jpg",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Formula_One_Grand_Prix_Singapore_2013_-_Ferrari_3.jpg",
      title: "Formula One Grand Prix Singapore 2013 - Ferrari 3",
      author: "Benjamin Goetzinger",
      license: "CC BY-SA 4.0",
      attribution: "Benjamin Goetzinger · CC BY-SA 4.0 · Wikimedia Commons",
    },
  },
];

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackEventPhotoCache?: Map<string, CacheEntry>;
};

const photoCache =
  globalCache.__f1LiveTrackEventPhotoCache ?? new Map<string, CacheEntry>();
globalCache.__f1LiveTrackEventPhotoCache = photoCache;

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function stringValue(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function htmlToText(value: string | null): string | null {
  if (!value) {
    return null;
  }

  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function curatedEventPhoto(url: URL): CircuitPhoto | null {
  const haystack = [
    url.searchParams.get("meeting"),
    url.searchParams.get("location"),
    url.searchParams.get("circuit"),
    url.searchParams.get("country"),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    CURATED_EVENT_PHOTOS.find(({ keywords }) =>
      keywords.some((keyword) => haystack.includes(keyword)),
    )?.photo ?? null
  );
}

function searchCandidates(url: URL): string[] {
  const meeting = url.searchParams.get("meeting")?.trim() ?? "";
  const circuit = url.searchParams.get("circuit")?.trim() ?? "";
  const location = url.searchParams.get("location")?.trim() ?? "";
  const country = url.searchParams.get("country")?.trim() ?? "";
  const year = url.searchParams.get("year")?.trim() ?? "";
  const eventName = [year, meeting, "Formula 1"].filter(Boolean).join(" ");

  return [
    [year, meeting, "F1 race car"].filter(Boolean).join(" "),
    [meeting, year, "F1 cars"].filter(Boolean).join(" "),
    [meeting, "Formula 1 cars"].filter(Boolean).join(" "),
    [meeting, "F1 car race"].filter(Boolean).join(" "),
    [location, "Grand Prix Formula 1 cars"].filter(Boolean).join(" "),
    [circuit, "Formula 1 car"].filter(Boolean).join(" "),
    [country, "Grand Prix Formula 1 cars"].filter(Boolean).join(" "),
    eventName,
  ].filter((value, index, values) => value.length > 0 && values.indexOf(value) === index);
}

async function fetchJson(url: URL, timeoutMs = 8000): Promise<unknown> {
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

    if (!response.ok) {
      throw new Error(`Wikimedia responded with ${response.status}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function imageScore(title: string, info: JsonRecord, query: string): number {
  const lowerTitle = title.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const mime = stringValue(info, "mime") ?? "";
  const width = typeof info.width === "number" ? info.width : 0;
  const height = typeof info.height === "number" ? info.height : 0;
  const hasFormulaSubject =
    /(car|cars|race|racing|practice|fp\d|qualifying|q\d|circuit|mercedes|ferrari|mclaren|red bull|williams|alpine|haas|aston|toro rosso|sauber|renault|caterham|lotus|scuderia|fw\d|sf\d|str\d|ct\d)/.test(
      lowerTitle,
    );
  let score = 0;

  if (mime === "image/jpeg") {
    score += 45;
  } else if (mime === "image/png") {
    score += 10;
  } else {
    score -= 70;
  }

  if (width >= 900 && height >= 500) {
    score += 14;
  }

  for (const word of lowerQuery.split(/\s+/).filter((part) => part.length > 3)) {
    if (lowerTitle.includes(word)) {
      score += 6;
    }
  }

  if (/(grand prix|formula one|formula 1|f1|race|racing|fp\d|qualifying|circuit)/.test(lowerTitle)) {
    score += 18;
  }

  if (hasFormulaSubject) {
    score += 30;
  } else if (/(grand prix|formula one|formula 1|f1)/.test(lowerTitle)) {
    score -= 22;
  }

  if (/(preparations|preparation|construction|setup|map|logo|icon|diagram|svg)/.test(lowerTitle)) {
    score -= 48;
  }

  if (/(podium|trophy|driver portrait|helmet)/.test(lowerTitle)) {
    score -= 30;
  }

  return score;
}

async function searchEventPhoto(query: string): Promise<ScoredEventPhoto | null> {
  const commonsUrl = new URL(COMMONS_API_URL);
  commonsUrl.searchParams.set("action", "query");
  commonsUrl.searchParams.set("generator", "search");
  commonsUrl.searchParams.set("gsrnamespace", "6");
  commonsUrl.searchParams.set("gsrsearch", query);
  commonsUrl.searchParams.set("gsrlimit", "16");
  commonsUrl.searchParams.set("prop", "imageinfo");
  commonsUrl.searchParams.set("iiprop", "url|mime|size|extmetadata");
  commonsUrl.searchParams.set("iiurlwidth", "1000");
  commonsUrl.searchParams.set("format", "json");

  const payload = asRecord(await fetchJson(commonsUrl));
  const pages = asRecord(asRecord(payload.query).pages);
  const candidates = Object.values(pages)
    .map((page) => {
      const pageRecord = asRecord(page);
      const imageInfo = Array.isArray(pageRecord.imageinfo)
        ? asRecord(pageRecord.imageinfo[0])
        : {};
      const title = stringValue(pageRecord, "title") ?? "";
      const extmetadata = asRecord(imageInfo.extmetadata);
      const url = stringValue(imageInfo, "thumburl") ?? stringValue(imageInfo, "url");
      const sourceUrl = stringValue(imageInfo, "descriptionurl") ?? url;

      if (!title || !url || !sourceUrl) {
        return null;
      }

      const author = htmlToText(stringValue(asRecord(extmetadata.Artist), "value"));
      const license = htmlToText(stringValue(asRecord(extmetadata.LicenseShortName), "value"));
      const cleanedTitle = title.replace(/^File:/, "").replace(/\.[^.]+$/, "");
      const attribution = [author, license, "Wikimedia Commons"]
        .filter((value): value is string => Boolean(value))
        .join(" · ");

      return {
        photo: {
          imageUrl: url,
          sourceUrl,
          title: cleanedTitle,
          author,
          license,
          attribution,
        } satisfies CircuitPhoto,
        score: imageScore(title, imageInfo, query),
      };
    })
    .filter((candidate): candidate is { photo: CircuitPhoto; score: number } => candidate !== null)
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];

  return best?.score > 0
    ? {
        photo: best.photo,
        query,
        score: best.score,
      }
    : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const cacheKey = `${CACHE_VERSION}:${url.searchParams.toString()}`;
  const cached = photoCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  const messages: string[] = [];
  const fallbackPhoto = curatedEventPhoto(url);

  try {
    let bestPhoto: ScoredEventPhoto | null = null;

    for (const candidate of searchCandidates(url)) {
      const result = await searchEventPhoto(candidate);

      if (result) {
        if (!bestPhoto || result.score > bestPhoto.score) {
          bestPhoto = result;
        }

        if (bestPhoto.score >= STRONG_PHOTO_SCORE) {
          break;
        }

        continue;
      }

      messages.push(`No event photo match for "${candidate}".`);
    }

    if (bestPhoto) {
      const payload: CircuitPhotoApiResponse = {
        data: bestPhoto.photo,
        meta: {
          generatedAt: new Date().toISOString(),
          partial: false,
          messages,
        },
      };

      photoCache.set(cacheKey, {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        value: payload,
      });

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=86400",
        },
      });
    }

    if (fallbackPhoto) {
      const payload: CircuitPhotoApiResponse = {
        data: fallbackPhoto,
        meta: {
          generatedAt: new Date().toISOString(),
          partial: true,
          messages: [...messages, "Using curated event photo fallback."],
        },
      };

      photoCache.set(cacheKey, {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        value: payload,
      });

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=86400",
        },
      });
    }

    const payload: CircuitPhotoApiResponse = {
      data: null,
      meta: {
        generatedAt: new Date().toISOString(),
        partial: true,
        messages,
      },
    };

    return NextResponse.json(payload, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ricerca foto evento non riuscita";

    if (fallbackPhoto) {
      const payload: CircuitPhotoApiResponse = {
        data: fallbackPhoto,
        meta: {
          generatedAt: new Date().toISOString(),
          partial: true,
          messages: [message, "Using curated event photo fallback."],
        },
      };

      photoCache.set(cacheKey, {
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        value: payload,
      });

      return NextResponse.json(payload, {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=86400",
        },
      });
    }

    const payload: CircuitPhotoApiResponse = {
      data: null,
      meta: {
        generatedAt: new Date().toISOString(),
        partial: true,
        messages: [message],
      },
    };

    return NextResponse.json(payload, { status: 502 });
  }
}
