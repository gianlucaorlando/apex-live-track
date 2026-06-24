import { NextResponse } from "next/server";
import type { CircuitPhoto, CircuitPhotoApiResponse } from "@/types/circuit";

export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

interface CacheEntry {
  expiresAt: number;
  value: CircuitPhotoApiResponse;
}

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackCircuitPhotoCache?: Map<string, CacheEntry>;
};

const photoCache =
  globalCache.__f1LiveTrackCircuitPhotoCache ?? new Map<string, CacheEntry>();
globalCache.__f1LiveTrackCircuitPhotoCache = photoCache;

const LOCAL_F1_BACKDROP: CircuitPhoto = {
  imageUrl: "/assets/f1-track-background.webp",
  sourceUrl: "/assets/f1-track-background.webp",
  title: "Sfondo motorsport Formula 1",
  author: "OpenAI",
  license: "Asset generato per F1 Live Track",
  attribution: "Sfondo motorsport generato per F1 Live Track",
};

const KNOWN_CIRCUIT_QUERIES: Record<string, string[]> = {
  singapore: ["Marina Bay Street Circuit", "Singapore Grand Prix circuit"],
  "marina bay": ["Marina Bay Street Circuit", "Singapore Grand Prix circuit"],
};

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

function searchCandidates(url: URL): string[] {
  const circuit = url.searchParams.get("circuit")?.trim() ?? "";
  const location = url.searchParams.get("location")?.trim() ?? "";
  const country = url.searchParams.get("country")?.trim() ?? "";
  const meeting = url.searchParams.get("meeting")?.trim() ?? "";
  const lowerKeys = [circuit, location, meeting]
    .map((value) => value.toLowerCase())
    .filter(Boolean);
  const known = lowerKeys.flatMap((key) => KNOWN_CIRCUIT_QUERIES[key] ?? []);
  const generic = [
    [location, "Street Circuit"].filter(Boolean).join(" "),
    [circuit, "F1 circuit"].filter(Boolean).join(" "),
    [circuit, "Grand Prix circuit"].filter(Boolean).join(" "),
    [meeting, "circuit"].filter(Boolean).join(" "),
    [location, country, "circuit"].filter(Boolean).join(" "),
  ];

  return [...new Set([...known, ...generic].filter((value) => value.length > 0))];
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
  let score = 0;

  if (mime === "image/jpeg") {
    score += 45;
  } else if (mime === "image/png") {
    score += 12;
  } else {
    score -= 60;
  }

  if (width >= 1400 && height >= 800) {
    score += 12;
  }

  for (const word of lowerQuery.split(/\s+/).filter((part) => part.length > 3)) {
    if (lowerTitle.includes(word)) {
      score += 8;
    }
  }

  if (lowerTitle.includes("street circuit")) {
    score += 22;
  }

  if (lowerTitle.includes("pit building")) {
    score += 18;
  }

  if (lowerTitle.includes("grand prix")) {
    score += 10;
  }

  if (/(map|layout|logo|icon|diagram|svg)/.test(lowerTitle)) {
    score -= 80;
  }

  if (/(bw|black and white)/.test(lowerTitle)) {
    score -= 18;
  }

  if (lowerTitle.includes("skysat")) {
    score -= 12;
  }

  return score;
}

async function searchCircuitPhoto(query: string): Promise<CircuitPhoto | null> {
  const commonsUrl = new URL("https://commons.wikimedia.org/w/api.php");
  commonsUrl.searchParams.set("action", "query");
  commonsUrl.searchParams.set("generator", "search");
  commonsUrl.searchParams.set("gsrnamespace", "6");
  commonsUrl.searchParams.set("gsrsearch", query);
  commonsUrl.searchParams.set("gsrlimit", "14");
  commonsUrl.searchParams.set("prop", "imageinfo");
  commonsUrl.searchParams.set("iiprop", "url|mime|size|extmetadata");
  commonsUrl.searchParams.set("iiurlwidth", "1800");
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

  return candidates[0]?.score > 0 ? candidates[0].photo : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const useLocalBackdrop = url.searchParams.get("source") !== "wikimedia";
  const cacheKey = url.searchParams.toString();

  if (useLocalBackdrop) {
    const localPayload: CircuitPhotoApiResponse = {
      data: LOCAL_F1_BACKDROP,
      meta: {
        generatedAt: new Date().toISOString(),
        partial: false,
        messages: ["Sfondo locale F1 usato al posto della ricerca foto circuito."],
      },
    };

    photoCache.set(cacheKey, {
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      value: localPayload,
    });

    return NextResponse.json(localPayload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=86400",
      },
    });
  }

  const cached = photoCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  const messages: string[] = [];

  try {
    for (const candidate of searchCandidates(url)) {
      const photo = await searchCircuitPhoto(candidate);

      if (photo) {
        const payload: CircuitPhotoApiResponse = {
          data: photo,
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

      messages.push(`No circuit photo match for "${candidate}".`);
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
    const message = error instanceof Error ? error.message : "Ricerca foto circuito non riuscita";
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
