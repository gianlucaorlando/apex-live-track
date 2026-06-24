"use client";

import { Cloud, CloudFog, CloudRain, CloudSun, Snowflake, Sun, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { t, weatherPlace, type Locale } from "@/lib/i18n";
import type { CircuitPhoto } from "@/types/circuit";
import type { RaceWeather, WeatherCondition } from "@/types/weather";

interface WeatherBackdropProps {
  weather: RaceWeather | null;
  circuitPhoto: CircuitPhoto | null;
  locale: Locale;
}

interface Tile {
  key: string;
  url: string;
  left: number;
  top: number;
}

const BASE_TILE_SIZE = 256;
const BASE_ZOOM = 12;

function lonToTileX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latToTileY(latitude: number, zoom: number): number {
  const radians = (latitude * Math.PI) / 180;
  return (
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
    2 ** zoom
  );
}

function wrapTileX(x: number, zoom: number): number {
  const max = 2 ** zoom;
  return ((x % max) + max) % max;
}

function buildTiles({
  latitude,
  longitude,
  width,
  height,
  zoom,
  makeUrl,
}: {
  latitude: number;
  longitude: number;
  width: number;
  height: number;
  zoom: number;
  makeUrl: (x: number, y: number, z: number) => string;
}): Tile[] {
  const centerX = lonToTileX(longitude, zoom);
  const centerY = latToTileY(latitude, zoom);
  const horizontalTiles = Math.ceil(width / BASE_TILE_SIZE / 2) + 1;
  const verticalTiles = Math.ceil(height / BASE_TILE_SIZE / 2) + 1;
  const centerTileX = Math.floor(centerX);
  const centerTileY = Math.floor(centerY);
  const tiles: Tile[] = [];

  for (let dx = -horizontalTiles; dx <= horizontalTiles; dx += 1) {
    for (let dy = -verticalTiles; dy <= verticalTiles; dy += 1) {
      const tileX = centerTileX + dx;
      const tileY = centerTileY + dy;
      const maxTile = 2 ** zoom;

      if (tileY < 0 || tileY >= maxTile) {
        continue;
      }

      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        url: makeUrl(wrapTileX(tileX, zoom), tileY, zoom),
        left: width / 2 + (tileX - centerX) * BASE_TILE_SIZE,
        top: height / 2 + (tileY - centerY) * BASE_TILE_SIZE,
      });
    }
  }

  return tiles;
}

function weatherClasses(condition: WeatherCondition | undefined) {
  switch (condition) {
    case "clear":
      return {
        base: "from-sky-950 via-neutral-950 to-amber-950/60",
        accent: "opacity-30",
        texture:
          "linear-gradient(120deg, rgba(250,204,21,0.18), transparent 42%), linear-gradient(180deg, rgba(14,165,233,0.18), transparent 52%)",
      };
    case "rain":
      return {
        base: "from-slate-950 via-cyan-950/50 to-neutral-950",
        accent: "opacity-45",
        texture:
          "repeating-linear-gradient(115deg, rgba(186,230,253,0.18) 0 1px, transparent 1px 18px)",
      };
    case "storm":
      return {
        base: "from-zinc-950 via-indigo-950/60 to-neutral-950",
        accent: "opacity-45",
        texture:
          "linear-gradient(118deg, transparent 0 45%, rgba(250,204,21,0.28) 46%, transparent 48% 100%)",
      };
    case "fog":
      return {
        base: "from-stone-950 via-slate-900/80 to-neutral-950",
        accent: "opacity-30",
        texture:
          "repeating-linear-gradient(0deg, rgba(255,255,255,0.10) 0 1px, transparent 1px 34px)",
      };
    case "snow":
      return {
        base: "from-slate-950 via-blue-950/50 to-neutral-950",
        accent: "opacity-35",
        texture:
          "repeating-linear-gradient(135deg, rgba(219,234,254,0.16) 0 2px, transparent 2px 24px)",
      };
    case "cloudy":
    default:
      return {
        base: "from-neutral-950 via-slate-950 to-cyan-950/40",
        accent: "opacity-28",
        texture:
          "linear-gradient(140deg, rgba(148,163,184,0.18), transparent 42%), linear-gradient(20deg, transparent, rgba(34,211,238,0.10) 72%)",
      };
  }
}

function WeatherIcon({ condition }: { condition: WeatherCondition | undefined }) {
  const className = "h-4 w-4";

  switch (condition) {
    case "clear":
      return <Sun className={className} aria-hidden="true" />;
    case "rain":
      return <CloudRain className={className} aria-hidden="true" />;
    case "storm":
      return <Zap className={className} aria-hidden="true" />;
    case "fog":
      return <CloudFog className={className} aria-hidden="true" />;
    case "snow":
      return <Snowflake className={className} aria-hidden="true" />;
    case "cloudy":
      return <Cloud className={className} aria-hidden="true" />;
    default:
      return <CloudSun className={className} aria-hidden="true" />;
  }
}

export function WeatherBackdrop({ weather, circuitPhoto, locale }: WeatherBackdropProps) {
  const [viewport, setViewport] = useState({ width: 1280, height: 720 });
  const weatherStyle = weatherClasses(weather?.condition);
  const photoVisible = Boolean(circuitPhoto);
  const hasCoordinates = weather?.latitude !== undefined && weather.longitude !== undefined;
  const googleMapUrl = hasCoordinates
    ? `/api/map/google?lat=${weather.latitude}&lon=${weather.longitude}&zoom=13&maptype=hybrid&lang=${locale}`
    : "";
  const baseTiles = useMemo(() => {
    if (!hasCoordinates) {
      return [];
    }

    return buildTiles({
      latitude: weather.latitude,
      longitude: weather.longitude,
      width: viewport.width,
      height: viewport.height,
      zoom: BASE_ZOOM,
      makeUrl: (x, y, z) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
    });
  }, [hasCoordinates, viewport.height, viewport.width, weather?.latitude, weather?.longitude]);

  useEffect(() => {
    function updateViewport() {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    updateViewport();
    window.addEventListener("resize", updateViewport);

    return () => {
      window.removeEventListener("resize", updateViewport);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className={`absolute inset-0 bg-gradient-to-br ${weatherStyle.base}`} />
      {circuitPhoto ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center opacity-95 brightness-110 saturate-125 contrast-110"
            data-circuit-photo-backdrop
            style={{ backgroundImage: `url("${circuitPhoto.imageUrl}")` }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.26),rgba(0,0,0,0.04)_45%,rgba(0,0,0,0.34)),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.52))]" />
        </>
      ) : null}
      {hasCoordinates ? (
        <div className={`absolute inset-0 saturate-75 ${photoVisible ? "opacity-10" : "opacity-45"}`}>
          {baseTiles.map((tile) => (
            <img
              key={tile.key}
              src={tile.url}
              alt=""
              className="absolute h-64 w-64 select-none object-cover"
              style={{
                left: tile.left,
                top: tile.top,
                filter: "grayscale(0.82) invert(0.9) hue-rotate(168deg) brightness(0.54)",
              }}
              draggable={false}
            />
          ))}
        </div>
      ) : null}
      {googleMapUrl ? (
        <div
          className={`absolute inset-0 bg-cover bg-center mix-blend-screen saturate-125 ${photoVisible ? "opacity-[0.16]" : "opacity-55"}`}
          style={{ backgroundImage: `url("${googleMapUrl}")` }}
        />
      ) : null}
      <div
        className={`absolute inset-0 ${weatherStyle.accent}`}
        style={{ backgroundImage: weatherStyle.texture }}
      />
      <div
        className={
          photoVisible
            ? "absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_24rem),linear-gradient(180deg,rgba(0,0,0,0.06),rgba(0,0,0,0.50))]"
            : "absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.10),transparent_24rem),linear-gradient(180deg,rgba(0,0,0,0.14),rgba(0,0,0,0.72))]"
        }
      />
      {weather ? (
        <div className="absolute right-4 top-4 hidden max-w-[22rem] items-center gap-3 rounded-md border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-white/90 backdrop-blur md:flex">
          <WeatherIcon condition={weather.condition} />
          <span className="truncate">
            {weather.description} · {weatherPlace(locale, weather.locationName, weather.country)}
          </span>
          {weather.temperatureC !== null ? (
            <span className="text-white">{Math.round(weather.temperatureC)}°C</span>
          ) : null}
        </div>
      ) : null}
      {hasCoordinates ? (
        <div className="absolute bottom-3 left-4 hidden rounded bg-black/35 px-2 py-1 text-[10px] font-semibold text-white/70 backdrop-blur md:block">
          {t(locale, "mapsConfigured")}
        </div>
      ) : null}
      {circuitPhoto ? (
        <div className="absolute bottom-3 right-4 hidden max-w-[30rem] truncate rounded bg-black/45 px-2 py-1 text-[10px] font-semibold text-white/75 backdrop-blur md:block">
          {circuitPhoto.imageUrl.includes("/assets/f1-track-background")
            ? t(locale, "generatedBackdrop")
            : circuitPhoto.attribution}
        </div>
      ) : null}
    </div>
  );
}
