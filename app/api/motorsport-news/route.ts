import { NextResponse } from "next/server";
import { normalizeLocale, type Locale } from "@/lib/i18n";
import type {
  MotorsportNewsApiResponse,
  MotorsportNewsItem,
} from "@/types/motorsportNews";

export const dynamic = "force-dynamic";

interface CacheEntry {
  expiresAt: number;
  value: MotorsportNewsApiResponse;
}

const FEED_BY_LOCALE: Record<Locale, string> = {
  it: "https://it.motorsport.com/rss/f1/news/",
  en: "https://www.motorsport.com/rss/f1/news/",
  de: "https://de.motorsport.com/rss/f1/news/",
};

const SOURCE_BY_LOCALE: Record<Locale, string> = {
  it: "Motorsport.com Italia",
  en: "Motorsport.com",
  de: "Motorsport.com Deutschland",
};

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackMotorsportNewsCache?: Map<string, CacheEntry>;
};

const newsCache =
  globalCache.__f1LiveTrackMotorsportNewsCache ?? new Map<string, CacheEntry>();
globalCache.__f1LiveTrackMotorsportNewsCache = newsCache;

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function textFromHtml(value: string): string {
  return decodeEntities(value)
    .replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(itemXml: string, tagName: string): string | null {
  const match = itemXml.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : null;
}

function firstCategory(itemXml: string): string | null {
  const values = [...itemXml.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)]
    .map((match) => decodeEntities(match[1]).trim())
    .filter(Boolean);

  return values.find((value) => !/formula\s*1|formel\s*1/i.test(value)) ?? values[0] ?? null;
}

function enclosureUrl(itemXml: string): string | null {
  const match = itemXml.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*>/i);
  return match ? decodeEntities(match[1]).trim() : null;
}

function publishedIso(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFeed(xml: string, locale: Locale): MotorsportNewsItem[] {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)]
    .map((match, index) => {
      const itemXml = match[1];
      const title = tagValue(itemXml, "title");
      const url = tagValue(itemXml, "link");
      const description = textFromHtml(tagValue(itemXml, "description") ?? "");
      const id = tagValue(itemXml, "guid") ?? url ?? `${locale}-${index}`;

      if (!title || !url) {
        return null;
      }

      return {
        id,
        title,
        description,
        url,
        imageUrl: enclosureUrl(itemXml),
        category: firstCategory(itemXml),
        publishedAt: publishedIso(tagValue(itemXml, "pubDate")),
        source: SOURCE_BY_LOCALE[locale],
      } satisfies MotorsportNewsItem;
    })
    .filter((item): item is MotorsportNewsItem => item !== null)
    .slice(0, 8);
}

async function fetchFeed(locale: Locale): Promise<string> {
  const response = await fetch(FEED_BY_LOCALE[locale], {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "F1 Live Track local app",
    },
  });

  if (!response.ok) {
    throw new Error(`Motorsport RSS responded with ${response.status}`);
  }

  return response.text();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = normalizeLocale(url.searchParams.get("lang"));
  const cacheKey = `motorsport-news:${locale}`;
  const cached = newsCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value);
  }

  try {
    const xml = await fetchFeed(locale);
    const items = parseFeed(xml, locale);
    const payload: MotorsportNewsApiResponse = {
      data: items,
      meta: {
        generatedAt: new Date().toISOString(),
        source: FEED_BY_LOCALE[locale],
        partial: items.length === 0,
        messages: items.length === 0 ? ["No Motorsport.com news items returned."] : [],
      },
    };

    newsCache.set(cacheKey, {
      expiresAt: Date.now() + 5 * 60 * 1000,
      value: payload,
    });

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Motorsport news request failed.";
    const payload: MotorsportNewsApiResponse = {
      data: [],
      meta: {
        generatedAt: new Date().toISOString(),
        source: FEED_BY_LOCALE[locale],
        partial: true,
        messages: [message],
      },
    };

    return NextResponse.json(payload, { status: 502 });
  }
}
