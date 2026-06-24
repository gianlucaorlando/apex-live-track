import { NextResponse } from "next/server";
import { normalizeLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

function numberParam(url: URL, key: string, fallback: number): number {
  const value = Number(url.searchParams.get(key));
  return Number.isFinite(value) ? value : fallback;
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return new NextResponse(null, { status: 204 });
  }

  const url = new URL(request.url);
  const latitude = numberParam(url, "lat", 0);
  const longitude = numberParam(url, "lon", 0);
  const zoom = Math.min(Math.max(numberParam(url, "zoom", 12), 1), 20);
  const mapType = url.searchParams.get("maptype") ?? "hybrid";
  const locale = normalizeLocale(url.searchParams.get("lang"));
  const mapUrl = new URL("https://maps.googleapis.com/maps/api/staticmap");

  mapUrl.searchParams.set("center", `${latitude},${longitude}`);
  mapUrl.searchParams.set("zoom", String(zoom));
  mapUrl.searchParams.set("size", "640x640");
  mapUrl.searchParams.set("scale", "2");
  mapUrl.searchParams.set("format", "jpg");
  mapUrl.searchParams.set("maptype", mapType);
  mapUrl.searchParams.set("language", locale);
  mapUrl.searchParams.set("key", apiKey);

  const response = await fetch(mapUrl, {
    cache: "no-store",
  });

  if (!response.ok || !response.body) {
    return new NextResponse(null, { status: response.status || 502 });
  }

  return new NextResponse(response.body, {
    status: 200,
    headers: {
      "Cache-Control": "public, max-age=0, s-maxage=3600",
      "Content-Type": response.headers.get("content-type") ?? "image/jpeg",
    },
  });
}
