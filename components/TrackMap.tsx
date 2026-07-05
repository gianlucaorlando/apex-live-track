"use client";

import {
  Cloud,
  CloudRain,
  CloudSun,
  Droplets,
  ExternalLink,
  MapIcon,
  MousePointer2,
  Thermometer,
  Trophy,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatTime } from "@/lib/format";
import {
  circuitName,
  driverStatus,
  t,
  tyreCompound,
  weatherPlace,
  type Locale,
} from "@/lib/i18n";
import {
  buildTrackPolyline,
  createTrackNormalizer,
  dedupeNearPoints,
  locationToTrackPoint,
  normalizeTrackPoints,
} from "@/lib/track";
import { tyreCompoundColor } from "@/lib/tyres";
import type {
  F1Meeting,
  FinishLinePoint,
  LiveStandingRow,
  NormalizedDriverPosition,
  NormalizedTrackPoint,
  TrackPoint,
} from "@/types/f1";
import type { DriverProfile, DriverProfileApiResponse } from "@/types/driver";
import type { RaceWeather, WeatherCondition } from "@/types/weather";

interface TrackMapProps {
  meeting: F1Meeting | null;
  standings: LiveStandingRow[];
  trackPoints: TrackPoint[];
  currentTrackPoints: TrackPoint[];
  finishLine: FinishLinePoint | null;
  weather: RaceWeather | null;
  motionTimeMs: number | null;
  hoveredDriver: number | null;
  selectedDriverNumber: number | null;
  locale: Locale;
  onHoverDriver: (driverNumber: number | null) => void;
  onSelectDriver: (driverNumber: number | null) => void;
}

const SVG_WIDTH = 1000;
const SVG_HEIGHT = 680;
const SVG_PADDING = 54;
// Keeps avatars moving briefly when OpenF1 serves stale data without inventing a corner exit.
const COAST_MAX_ELAPSED_MS = 6000;
const COAST_DECAY_MS = 2500;
const COAST_SAMPLE_MIN_MS = 1200;
const COAST_SAMPLE_MAX_MS = 8000;
const COAST_MAX_PROGRESS = 0.9;
// Marker transition duration is derived from the real gap between telemetry updates (see
// markerTransitionMs) so it never stalls-then-snaps when updates arrive irregularly - a car
// that hasn't reported for 5 real seconds glides there over 5 seconds, not an arbitrary one.
const MARKER_TRANSITION_MIN_MS = 60;
const MARKER_TRANSITION_MAX_MS = 6000;
// A direct transform between two on-track points is a straight line, which cuts across the
// infield whenever the two points are far apart along a curve. Large jumps are instead broken
// into a short chain of intermediate on-path waypoints so the marker visibly follows the curve.
const WAYPOINT_SPACING_PX = 70;
const MAX_WAYPOINTS_PER_TRANSITION = 8;
const MIN_WAYPOINT_STEP_MS = 45;
const STABLE_TRACK_MIN_POINTS = 80;
const STABLE_TRACK_REPLACE_RATIO = 1.25;
const TRACK_LOOP_MIN_POINTS = 96;
const TRACK_LOOP_MIN_TRAVEL_RATIO = 1.75;
const TRACK_LOOP_RETURN_RATIO = 0.08;
const TRACK_LOOP_MIN_RETURN_PX = 34;
const TRACK_LOOP_MAX_RETURN_PX = 78;
const PATH_CLOSE_RATIO = 0.1;
const PATH_CLOSE_MAX_PX = 90;
const PATH_CONTINUITY_RAW_LIMIT_PX = 44;
const PATH_CONTINUITY_WEIGHT = 0.04;
const POSITION_ORDER_GAP_PX = 26;
const POSITION_ORDER_MAX_CORRECTION_RATIO = 0.08;
const POSITION_ORDER_MIN_CORRECTION_PX = 96;
const POSITION_ORDER_MAX_CORRECTION_PX = 260;
const MAX_PROJECTION_DISTANCE_RATIO = 0.055;
const MAX_PROJECTION_DISTANCE_MIN_PX = 52;
const MAX_PROJECTION_DISTANCE_MAX_PX = 120;

function weatherNumber(value: number | null | undefined, digits = 0): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(digits);
}

function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(maxLength - 3, 0))}...`;
}

function rainAmount(weather: RaceWeather | null): number {
  if (!weather) {
    return 0;
  }

  return Math.max(weather.rainMm ?? 0, weather.precipitationMm ?? 0);
}

function rainState(weather: RaceWeather | null, locale: Locale): {
  label: string;
  detail: string;
  level: number;
  panelClass: string;
  barClass: string;
  trackClass: string;
} {
  const amount = rainAmount(weather);
  const storm = weather?.condition === "storm";

  if (storm || amount >= 5) {
    return {
      label: storm ? t(locale, "storm") : t(locale, "heavyRain"),
      detail: `${weatherNumber(amount, 1)} mm`,
      level: 1,
      panelClass: "border-cyan-200/55 bg-cyan-950/80 text-cyan-50 shadow-cyan-950/40",
      barClass: "bg-cyan-200",
      trackClass: "border-cyan-200/45 shadow-cyan-950/40",
    };
  }

  if (amount >= 1.5) {
    return {
      label: t(locale, "mediumRain"),
      detail: `${weatherNumber(amount, 1)} mm`,
      level: 0.72,
      panelClass: "border-sky-200/45 bg-sky-950/75 text-sky-50 shadow-sky-950/35",
      barClass: "bg-sky-200",
      trackClass: "border-sky-200/35 shadow-sky-950/35",
    };
  }

  if (amount > 0 || weather?.condition === "rain") {
    return {
      label: t(locale, "lightRain"),
      detail: `${weatherNumber(amount, 1)} mm`,
      level: 0.38,
      panelClass: "border-teal-200/40 bg-teal-950/70 text-teal-50 shadow-teal-950/30",
      barClass: "bg-teal-200",
      trackClass: "border-teal-200/30 shadow-teal-950/30",
    };
  }

  return {
    label: t(locale, "dryTrack"),
    detail: weather?.description ?? t(locale, "weatherWaiting"),
    level: 0.04,
    panelClass: "border-white/15 bg-neutral-950/70 text-neutral-100 shadow-black/20",
    barClass: "bg-emerald-300",
    trackClass: "border-white/15 shadow-black/20",
  };
}

function weatherIcon(condition: WeatherCondition | undefined) {
  const className = "h-4 w-4";

  switch (condition) {
    case "rain":
      return <CloudRain className={className} aria-hidden="true" />;
    case "storm":
      return <Zap className={className} aria-hidden="true" />;
    case "cloudy":
    case "fog":
      return <Cloud className={className} aria-hidden="true" />;
    default:
      return <CloudSun className={className} aria-hidden="true" />;
  }
}

function WeatherMiniBar({
  weather,
  locale,
}: {
  weather: RaceWeather | null;
  locale: Locale;
}) {
  const state = rainState(weather, locale);
  const rain = rainAmount(weather);
  const rainPercent = `${Math.round(state.level * 100)}%`;

  return (
    <div
      className={`max-w-[44rem] min-w-0 flex-1 rounded-lg border px-3 py-2 text-xs font-semibold shadow-2xl backdrop-blur-md sm:flex-none ${state.panelClass}`}
      data-weather-mini-bar
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 items-center gap-2 border-r border-white/15 pr-3">
          <span className="grid h-8 w-8 flex-none place-items-center rounded-md bg-white/12">
            {weatherIcon(weather?.condition)}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-black text-white">{state.label}</span>
              <span className="hidden text-white/70 sm:inline">{state.detail}</span>
              <span className="rounded bg-white/12 px-1.5 py-0.5 text-[10px] uppercase text-white/75">
                {weather ? formatTime(weather.observedAt, locale) : "--"}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div
                className={`h-full rounded-full ${state.barClass}`}
                style={{ width: rainPercent }}
              />
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-5">
          <div className="flex items-center gap-1.5">
            <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{weatherNumber(weather?.rainMm, 1)} mm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{weatherNumber(weather?.precipitationMm, 1)} mm</span>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{weatherNumber(weather?.humidityPercent)}%</span>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            <Wind className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{weatherNumber(weather?.windSpeedKmh)} km/h</span>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            <Thermometer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{weatherNumber(weather?.temperatureC)}°C</span>
          </div>
        </div>
      </div>

      {weather ? (
        <div className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-white/55">
          {weatherPlace(locale, weather.locationName, weather.country)} · {t(locale, "rainFocus")}{" "}
          {weatherNumber(rain, 1)} mm
        </div>
      ) : null}
    </div>
  );
}

function WeatherTrackLayer({ weather }: { weather: RaceWeather | null }) {
  const amount = rainAmount(weather);
  const wet = amount > 0 || weather?.condition === "rain" || weather?.condition === "storm";
  const cloudy = weather?.condition === "cloudy" || weather?.condition === "fog";

  if (!weather) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      data-weather-track-layer
      aria-hidden="true"
    >
      <div
        className={`absolute inset-0 ${
          wet
            ? "bg-cyan-400/12 mix-blend-screen"
            : cloudy
              ? "bg-slate-300/8 mix-blend-screen"
              : "bg-amber-200/5 mix-blend-screen"
        }`}
      />
      {wet ? (
        <>
          <div className="absolute inset-0 opacity-55 mix-blend-screen [background-image:repeating-linear-gradient(112deg,rgba(186,230,253,0.42)_0_1px,transparent_1px_18px)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cyan-200/18 to-transparent" />
        </>
      ) : null}
    </div>
  );
}

function shortExtract(profile: DriverProfile | null): string {
  if (!profile?.extract) {
    return "";
  }

  const sentences = profile.extract
    .split(/(?<=\.)\s+/)
    .filter((sentence) => sentence.length > 0)
    .slice(0, 2)
    .join(" ");

  return truncateText(sentences || profile.extract, 260);
}

function DriverProfileCard({
  driver,
  profile,
  loading,
  error,
  locale,
  onClose,
}: {
  driver: NormalizedDriverPosition;
  profile: DriverProfile | null;
  loading: boolean;
  error: string | null;
  locale: Locale;
  onClose: () => void;
}) {
  const tyreColor = tyreCompoundColor(driver.tyre?.compound);
  const lapValue = t(locale, "lapProgressValue", {
    current: driver.currentLap ? String(driver.currentLap) : "-",
    total: driver.totalLaps ? String(driver.totalLaps) : "-",
  });

  return (
    <aside
      className="absolute bottom-4 right-4 top-24 z-40 flex w-[22rem] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-white/15 bg-slate-950/92 shadow-2xl shadow-black/45 backdrop-blur-xl"
      data-driver-profile-card
    >
      <div className="h-1.5 flex-none" style={{ backgroundColor: driver.teamColour }} />
      <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4">
        <div className="flex items-start gap-3">
          <div
            className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-lg border-2 bg-neutral-900"
            style={{ borderColor: driver.teamColour }}
          >
            {driver.headshotUrl ? (
              <img
                src={driver.headshotUrl}
                alt={driver.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-lg font-black text-white">{driver.acronym}</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-black text-white">{driver.fullName}</h3>
                <div className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-white/55">
                  #{driver.driverNumber} · {driver.acronym}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                title={t(locale, "closeDriverCard")}
                className="grid h-8 w-8 flex-none place-items-center rounded-md border border-white/10 bg-white/5 text-white transition hover:bg-white/12"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "position")}</div>
            <div className="mt-1 text-lg font-black text-white">
              {driver.position ? `P${driver.position}` : "P-"}
            </div>
            <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-cyan-100/70">
              {t(locale, "lapProgress")} {lapValue}
            </div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="flex items-center justify-between gap-2 text-white/45">
              <span>{t(locale, "tyre")}</span>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: tyreColor }}
              />
            </div>
            <div className="mt-1 text-lg font-black text-white">
              {driver.tyre ? tyreCompound(locale, driver.tyre.compound) : "n.d."}
            </div>
            {driver.tyre ? (
              <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-white/45">
                {t(locale, "tyreAge")} {driver.tyre.ageLaps ?? "-"} ·{" "}
                {t(locale, "tyreStint")} {driver.tyre.stintNumber}
              </div>
            ) : null}
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "f1Wins")}</div>
            <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-white">
              <Trophy className="h-4 w-4 text-amber-300" aria-hidden="true" />
              {loading ? "..." : profile?.wins ?? "n.d."}
            </div>
          </div>
          {!loading && profile?.worldChampionships && profile.worldChampionships > 0 ? (
            <div className="rounded-md border border-amber-300/20 bg-amber-300/10 p-2">
              <div className="text-amber-100/60">{t(locale, "f1WorldTitles")}</div>
              <div className="mt-1 flex items-center gap-1.5 text-lg font-black text-amber-50">
                <Trophy className="h-4 w-4 text-amber-300" aria-hidden="true" />
                {profile.worldChampionships}
              </div>
            </div>
          ) : null}
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "team")}</div>
            <div className="mt-1 truncate font-bold text-white">{driver.teamName}</div>
          </div>
          <div className="rounded-md border border-white/10 bg-white/[0.06] p-2">
            <div className="text-white/45">{t(locale, "gapInterval")}</div>
            <div className="mt-1 truncate font-bold text-white">
              {driver.gap} / {driver.interval}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-white/10 bg-black/22 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-white/60">
              {t(locale, "wikipedia")}
            </div>
            {profile?.pageUrl ? (
              <a
                href={profile.pageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs font-bold text-white transition hover:bg-white/12"
              >
                {t(locale, "open")}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>

          {loading ? (
            <div className="mt-3 text-sm font-semibold text-white/70">
              {t(locale, "profileLoading")}
            </div>
          ) : error ? (
            <div className="mt-3 text-sm font-semibold text-amber-100">{error}</div>
          ) : profile ? (
            <div className="mt-3 flex gap-3">
              {profile.thumbnailUrl ? (
                <img
                  src={profile.thumbnailUrl}
                  alt={profile.title}
                  className="h-20 w-16 flex-none rounded-md object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <div className="text-sm font-black text-white">{profile.title}</div>
                {profile.description ? (
                  <div className="mt-0.5 text-xs font-semibold text-white/48">
                    {profile.description}
                  </div>
                ) : null}
                <p className="mt-2 text-xs leading-relaxed text-white/72">
                  {shortExtract(profile)}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm font-semibold text-white/70">
              {t(locale, "profileMissing")}
            </div>
          )}
        </div>

        <div className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/38">
          {profile?.attribution ?? t(locale, "wikiAttribution")}
        </div>
      </div>
    </aside>
  );
}

function markerTitle(driver: NormalizedDriverPosition, locale: Locale): string {
  const position = driver.position ? `P${driver.position}` : "P-";
  const laps =
    driver.currentLap || driver.totalLaps
      ? ` | ${t(locale, "lapProgress")} ${t(locale, "lapProgressValue", {
          current: driver.currentLap ? String(driver.currentLap) : "-",
          total: driver.totalLaps ? String(driver.totalLaps) : "-",
        })}`
      : "";
  const status = driver.status
    ? ` | ${t(locale, "markerStatus")} ${driverStatus(locale, driver.status)}`
    : "";
  const tyre = driver.tyre
    ? ` | ${t(locale, "tyre")} ${tyreCompound(locale, driver.tyre.compound)} ${
        driver.tyre.ageLaps !== null ? `${driver.tyre.ageLaps}g` : ""
      }`
    : "";
  return `${driver.acronym} - ${driver.fullName} | ${position} | ${driver.teamName} | ${t(
    locale,
    "markerGap",
  )} ${driver.gap} | ${t(locale, "markerInterval")} ${driver.interval}${laps}${tyre}${status}`;
}

function finishLineTitle(finishLine: FinishLinePoint, locale: Locale): string {
  const source = finishLine.lapNumber
    ? t(locale, "lap", { lap: finishLine.lapNumber })
    : t(locale, "lapData");
  const confidence =
    finishLine.confidence === "high"
      ? t(locale, "confidenceHigh")
      : finishLine.confidence === "medium"
        ? t(locale, "confidenceMedium")
        : t(locale, "confidenceLow");
  return t(locale, "finishLineTitle", { source, confidence });
}

function avatarClipId(driverNumber: number): string {
  return `driver-avatar-${driverNumber}`;
}

function pointTime(point: TrackPoint): number {
  if (typeof point.timeMs === "number" && Number.isFinite(point.timeMs)) {
    return point.timeMs;
  }

  if (!point.date) {
    return 0;
  }

  const time = new Date(point.date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function trackShapeScore(points: TrackPoint[]): number {
  if (points.length < 2) {
    return 0;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const rangeX = Math.max(...xs) - Math.min(...xs);
  const rangeY = Math.max(...ys) - Math.min(...ys);

  return Math.hypot(rangeX, rangeY) + points.length * 0.05;
}

function normalizedDistance(
  first: Pick<NormalizedTrackPoint, "x" | "y">,
  second: Pick<NormalizedTrackPoint, "x" | "y">,
): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function normalizedBoundsDiagonal(points: NormalizedTrackPoint[]): number {
  if (points.length === 0) {
    return 0;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);

  return Math.hypot(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
}

function extractSingleTrackLoop(points: NormalizedTrackPoint[]): NormalizedTrackPoint[] {
  if (points.length < TRACK_LOOP_MIN_POINTS) {
    return points;
  }

  const diagonal = normalizedBoundsDiagonal(points);
  const minTravel = diagonal * TRACK_LOOP_MIN_TRAVEL_RATIO;
  const returnTolerance = Math.min(
    Math.max(diagonal * TRACK_LOOP_RETURN_RATIO, TRACK_LOOP_MIN_RETURN_PX),
    TRACK_LOOP_MAX_RETURN_PX,
  );
  const start = points[0];
  let travelled = 0;
  let bestEndIndex = -1;
  let bestTravelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    travelled += normalizedDistance(points[index - 1], points[index]);

    if (index < TRACK_LOOP_MIN_POINTS || travelled < minTravel) {
      continue;
    }

    // A concatenated multi-lap trace can pass close to its own starting point more than
    // once (e.g. a pit-lane entry near the start/finish straight) before actually
    // completing a full lap. Keep scanning and take the largest valid loop found instead
    // of stopping at the first candidate, so a coincidental early "near return" doesn't
    // truncate the track and cut out a whole section of the circuit.
    if (normalizedDistance(start, points[index]) <= returnTolerance && travelled > bestTravelled) {
      bestEndIndex = index;
      bestTravelled = travelled;
    }
  }

  return bestEndIndex >= 0 ? points.slice(0, bestEndIndex + 1) : points;
}

type TrackPathSegment = {
  start: NormalizedTrackPoint;
  end: NormalizedTrackPoint;
  startDistance: number;
  length: number;
};

type TrackPath = {
  segments: TrackPathSegment[];
  totalLength: number;
  closed: boolean;
};

type ProjectedTrackPoint = NormalizedTrackPoint & {
  trackDistance: number;
  projectionDistance: number;
};

type NormalizedDriverTrackPosition = NormalizedDriverPosition & {
  trackDistance: number | null;
  projectionDistance: number | null;
};

function buildTrackPath(polyline: NormalizedTrackPoint[]): TrackPath {
  const segments: TrackPathSegment[] = [];
  let totalLength = 0;

  for (let index = 1; index < polyline.length; index += 1) {
    const start = polyline[index - 1];
    const end = polyline[index];
    const length = normalizedDistance(start, end);

    if (length <= 0) {
      continue;
    }

    segments.push({ start, end, startDistance: totalLength, length });
    totalLength += length;
  }

  const first = polyline[0];
  const last = polyline.at(-1);
  const diagonal = normalizedBoundsDiagonal(polyline);
  const closeTolerance = Math.min(
    Math.max(diagonal * PATH_CLOSE_RATIO, TRACK_LOOP_MIN_RETURN_PX),
    PATH_CLOSE_MAX_PX,
  );
  const closeDistance = first && last
    ? normalizedDistance(first, last)
    : Number.POSITIVE_INFINITY;
  const closed = polyline.length >= 3 && closeDistance > 0 && closeDistance <= closeTolerance;

  if (closed && first && last) {
    segments.push({
      start: last,
      end: first,
      startDistance: totalLength,
      length: closeDistance,
    });
    totalLength += closeDistance;
  }

  return { closed, segments, totalLength };
}

function circularPathDelta(first: number, second: number, totalLength: number): number {
  if (totalLength <= 0) {
    return Math.abs(first - second);
  }

  const direct = Math.abs(first - second);
  return Math.min(direct, Math.max(totalLength - direct, 0));
}

function normalizePathDistance(distance: number, path: TrackPath): number {
  if (path.totalLength <= 0) {
    return 0;
  }

  if (!path.closed) {
    return Math.min(Math.max(distance, 0), path.totalLength);
  }

  return ((distance % path.totalLength) + path.totalLength) % path.totalLength;
}

function projectPointToTrackPath(
  point: NormalizedTrackPoint,
  path: TrackPath,
  previousDistance?: number,
): ProjectedTrackPoint | null {
  if (path.segments.length === 0 || path.totalLength <= 0) {
    return null;
  }

  const candidates: ProjectedTrackPoint[] = [];

  for (const segment of path.segments) {
    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared <= 0) {
      continue;
    }

    const progress = Math.min(
      Math.max(
        ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) /
          lengthSquared,
        0,
      ),
      1,
    );
    const x = segment.start.x + dx * progress;
    const y = segment.start.y + dy * progress;
    const projectionDistance = Math.hypot(point.x - x, point.y - y);

    candidates.push({
      ...point,
      x,
      y,
      trackDistance: normalizePathDistance(
        segment.startDistance + segment.length * progress,
        path,
      ),
      projectionDistance,
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  const nearest = candidates.reduce((best, candidate) =>
    candidate.projectionDistance < best.projectionDistance ? candidate : best,
  );

  if (previousDistance === undefined || path.totalLength <= 0) {
    return nearest;
  }

  const rawLimit = Math.max(
    nearest.projectionDistance + PATH_CONTINUITY_RAW_LIMIT_PX,
    PATH_CONTINUITY_RAW_LIMIT_PX,
  );
  const plausible = candidates.filter(
    (candidate) => candidate.projectionDistance <= rawLimit,
  );

  return plausible.reduce((best, candidate) => {
    const bestContinuity = circularPathDelta(
      best.trackDistance,
      previousDistance,
      path.totalLength,
    );
    const candidateContinuity = circularPathDelta(
      candidate.trackDistance,
      previousDistance,
      path.totalLength,
    );
    const bestScore =
      best.projectionDistance ** 2 + bestContinuity ** 2 * PATH_CONTINUITY_WEIGHT;
    const candidateScore =
      candidate.projectionDistance ** 2 + candidateContinuity ** 2 * PATH_CONTINUITY_WEIGHT;

    return candidateScore < bestScore ? candidate : best;
  }, nearest);
}

function pointAtTrackDistance(path: TrackPath, distance: number): NormalizedTrackPoint | null {
  if (path.segments.length === 0 || path.totalLength <= 0) {
    return null;
  }

  const target = normalizePathDistance(distance, path);
  const segment =
    path.segments.find(
      (item) =>
        target >= item.startDistance &&
        target <= item.startDistance + item.length,
    ) ?? path.segments.at(-1);

  if (!segment) {
    return null;
  }

  const progress =
    segment.length > 0
      ? Math.min(Math.max((target - segment.startDistance) / segment.length, 0), 1)
      : 0;

  return {
    ...segment.start,
    x: segment.start.x + (segment.end.x - segment.start.x) * progress,
    y: segment.start.y + (segment.end.y - segment.start.y) * progress,
  };
}

type MarkerWaypoint = {
  x: number;
  y: number;
  durationMs: number;
};

// Splits the move from `fromDistance` to `toDistance` (both cumulative, toDistance >=
// fromDistance) into a short chain of on-path points so a CSS transition between consecutive
// waypoints stays close to the track curve, instead of drawing one straight chord across the
// infield when the two distances are far apart (e.g. after a multi-second telemetry gap).
function buildTrackWaypoints(
  fromDistance: number,
  toDistance: number,
  path: TrackPath,
  totalDurationMs: number,
  fallbackPoint: { x: number; y: number },
): MarkerWaypoint[] {
  const gap = toDistance - fromDistance;

  if (path.totalLength <= 0 || gap <= 0) {
    return [{ x: fallbackPoint.x, y: fallbackPoint.y, durationMs: totalDurationMs }];
  }

  const steps = Math.min(
    Math.max(Math.ceil(gap / WAYPOINT_SPACING_PX), 1),
    MAX_WAYPOINTS_PER_TRANSITION,
  );
  const stepDurationMs = Math.max(totalDurationMs / steps, MIN_WAYPOINT_STEP_MS);
  const waypoints: MarkerWaypoint[] = [];

  for (let index = 1; index <= steps; index += 1) {
    const distance = fromDistance + (gap * index) / steps;
    const point = pointAtTrackDistance(path, distance);

    if (point) {
      waypoints.push({ x: point.x, y: point.y, durationMs: stepDurationMs });
    }
  }

  return waypoints.length > 0
    ? waypoints
    : [{ x: fallbackPoint.x, y: fallbackPoint.y, durationMs: totalDurationMs }];
}

// `driverPathRef` stores a CUMULATIVE track distance per driver: unlike a value wrapped into
// [0, totalLength), this one keeps growing lap after lap. That single property is what makes
// the rest of the pipeline simple - a later sample always has a larger (or equal) distance
// than an earlier one, so "how far did the car move" is a plain subtraction, no lap-aware
// modulo arithmetic needed, and a lap-crossing update never looks like a huge jump backward.
function accumulateTrackDistance(
  candidateWrappedDistance: number,
  path: TrackPath,
  previousCumulativeDistance?: number,
): number {
  if (previousCumulativeDistance === undefined || path.totalLength <= 0) {
    return candidateWrappedDistance;
  }

  if (!path.closed) {
    // Cars never reverse on an open (not-yet-looped) path; treat backward GPS noise as
    // "hold position" instead of animating the marker backwards.
    return Math.max(candidateWrappedDistance, previousCumulativeDistance);
  }

  const previousWrapped = normalizePathDistance(previousCumulativeDistance, path);
  const forwardDelta = normalizePathDistance(candidateWrappedDistance - previousWrapped, path);
  const backwardDelta = normalizePathDistance(previousWrapped - candidateWrappedDistance, path);

  if (backwardDelta > 0 && backwardDelta < forwardDelta) {
    return previousCumulativeDistance;
  }

  return previousCumulativeDistance + forwardDelta;
}

function relativeTrackDistance(
  distance: number,
  zeroDistance: number,
  path: TrackPath,
): number {
  if (path.totalLength <= 0) {
    return distance;
  }

  if (!path.closed) {
    return distance - zeroDistance;
  }

  return normalizePathDistance(distance - zeroDistance, path);
}

function applyStandingOrderGuard(
  drivers: NormalizedDriverTrackPosition[],
  path: TrackPath,
  finishLineDistance: number | null,
  previousDistances: Map<number, number>,
): NormalizedDriverTrackPosition[] {
  if (path.totalLength <= 0 || finishLineDistance === null) {
    return drivers;
  }

  const corrected = new Map<number, NormalizedDriverTrackPosition>();
  const previousProgressByLap = new Map<number, number>();
  const maxCorrection = Math.min(
    Math.max(
      path.totalLength * POSITION_ORDER_MAX_CORRECTION_RATIO,
      POSITION_ORDER_MIN_CORRECTION_PX,
    ),
    POSITION_ORDER_MAX_CORRECTION_PX,
  );
  const ordered = drivers
    .filter(
      (driver) =>
        driver.position !== null &&
        driver.currentLap !== null &&
        driver.trackDistance !== null,
    )
    .sort((first, second) => (first.position ?? 0) - (second.position ?? 0));

  for (const driver of ordered) {
    const lap = driver.currentLap;
    const trackDistance = driver.trackDistance;

    if (lap === null || trackDistance === null) {
      continue;
    }

    const relative = relativeTrackDistance(trackDistance, finishLineDistance, path);
    const previousProgress = previousProgressByLap.get(lap);
    let correctedRelative = relative;

    if (
      previousProgress !== undefined &&
      relative >= previousProgress - POSITION_ORDER_GAP_PX &&
      relative - (previousProgress - POSITION_ORDER_GAP_PX) <= maxCorrection
    ) {
      correctedRelative = Math.max(previousProgress - POSITION_ORDER_GAP_PX, 0);

      // Apply the correction as a small delta on top of the driver's own cumulative
      // distance, instead of rebuilding an absolute (wrapped-into-one-lap) value - this
      // keeps the lap count embedded in `trackDistance` intact so the marker never appears
      // to jump backward across most of the lap right after crossing the finish line.
      let relativeDelta = correctedRelative - relative;
      if (Math.abs(relativeDelta) > path.totalLength / 2) {
        relativeDelta += relativeDelta > 0 ? -path.totalLength : path.totalLength;
      }
      const correctedDistance = trackDistance + relativeDelta;
      const previousDistance = previousDistances.get(driver.driverNumber);

      if (previousDistance !== undefined) {
        if (!path.closed && correctedDistance < previousDistance) {
          previousProgressByLap.set(lap, relative);
          continue;
        }

        const forwardFromPrevious = normalizePathDistance(
          correctedDistance - previousDistance,
          path,
        );
        const backwardFromPrevious = normalizePathDistance(
          previousDistance - correctedDistance,
          path,
        );

        if (backwardFromPrevious > 0 && backwardFromPrevious < forwardFromPrevious) {
          previousProgressByLap.set(lap, relative);
          continue;
        }
      }

      const point = pointAtTrackDistance(path, correctedDistance);

      if (point) {
        corrected.set(driver.driverNumber, {
          ...driver,
          x: point.x,
          y: point.y,
          trackDistance: correctedDistance,
        });
      }
    }

    previousProgressByLap.set(lap, correctedRelative);
  }

  if (corrected.size === 0) {
    return drivers;
  }

  return drivers.map((driver) => corrected.get(driver.driverNumber) ?? driver);
}

function groupTrackPointsByDriver(points: TrackPoint[]): Map<number, TrackPoint[]> {
  const grouped = new Map<number, TrackPoint[]>();

  for (const point of points) {
    if (typeof point.driverNumber !== "number" || point.driverNumber <= 0) {
      continue;
    }

    const bucket = grouped.get(point.driverNumber);
    if (bucket) {
      bucket.push(point);
    } else {
      grouped.set(point.driverNumber, [point]);
    }
  }

  return grouped;
}

// `points` is assumed sorted ascending by time (true for every grouped source array here,
// since grouping preserves the relative order of the already time-sorted merged arrays).
// Returns the first index whose time is strictly greater than `targetTimeMs`.
function upperBoundIndex(points: TrackPoint[], targetTimeMs: number): number {
  let low = 0;
  let high = points.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    if (pointTime(points[mid]) <= targetTimeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

// Returns the first index whose time is greater than or equal to `targetTimeMs`.
function lowerBoundIndex(points: TrackPoint[], targetTimeMs: number): number {
  let low = 0;
  let high = points.length;

  while (low < high) {
    const mid = (low + high) >>> 1;
    if (pointTime(points[mid]) < targetTimeMs) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function getLatestTrackPointByDriver(
  pointsByDriver: Map<number, TrackPoint[]>,
): Map<number, TrackPoint> {
  const latest = new Map<number, TrackPoint>();

  for (const [driverNumber, points] of pointsByDriver) {
    const lastPoint = points.at(-1);
    if (lastPoint) {
      latest.set(driverNumber, lastPoint);
    }
  }

  return latest;
}

type MotionTrackPoint = TrackPoint & {
  coasted?: boolean;
};

function interpolatePoint(
  driverNumber: number,
  before: TrackPoint,
  after: TrackPoint,
  beforeTime: number,
  afterTime: number,
  targetTimeMs: number,
): TrackPoint {
  const progress = (targetTimeMs - beforeTime) / (afterTime - beforeTime);
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  return {
    driverNumber,
    date: new Date(targetTimeMs).toISOString(),
    timeMs: targetTimeMs,
    x: before.x + (after.x - before.x) * clampedProgress,
    y: before.y + (after.y - before.y) * clampedProgress,
    z:
      before.z !== undefined && before.z !== null && after.z !== undefined && after.z !== null
        ? before.z + (after.z - before.z) * clampedProgress
        : before.z,
  };
}

function coastPoint(
  driverNumber: number,
  latest: TrackPoint,
  latestTime: number,
  reference: TrackPoint,
  referenceTime: number,
  targetTimeMs: number,
): MotionTrackPoint | null {
  const sampleDuration = latestTime - referenceTime;
  const elapsed = targetTimeMs - latestTime;

  if (sampleDuration <= 0 || elapsed <= 0) {
    return null;
  }

  const cappedElapsed = Math.min(elapsed, COAST_MAX_ELAPSED_MS);
  const easedElapsed =
    COAST_MAX_ELAPSED_MS * (1 - Math.exp(-cappedElapsed / COAST_DECAY_MS));
  const progress = Math.min(easedElapsed / sampleDuration, COAST_MAX_PROGRESS);
  const xVelocity = latest.x - reference.x;
  const yVelocity = latest.y - reference.y;
  const referenceZ = reference.z;
  const latestZ = latest.z;

  return {
    driverNumber,
    date: new Date(targetTimeMs).toISOString(),
    timeMs: targetTimeMs,
    x: latest.x + xVelocity * progress,
    y: latest.y + yVelocity * progress,
    coasted: true,
    z:
      typeof latestZ === "number" &&
      Number.isFinite(latestZ) &&
      typeof referenceZ === "number" &&
      Number.isFinite(referenceZ)
        ? latestZ + (latestZ - referenceZ) * progress
        : latestZ,
  };
}

function getInterpolatedTrackPointByDriver(
  pointsByDriver: Map<number, TrackPoint[]>,
  targetTimeMs: number,
): Map<number, TrackPoint> {
  const result = new Map<number, TrackPoint>();

  for (const [driverNumber, points] of pointsByDriver) {
    if (points.length === 0) {
      continue;
    }

    const splitIndex = upperBoundIndex(points, targetTimeMs);
    const before = splitIndex > 0 ? points[splitIndex - 1] : null;
    const after = splitIndex < points.length ? points[splitIndex] : null;
    const beforeTime = before ? pointTime(before) : 0;
    const afterTime = after ? pointTime(after) : 0;

    if (before && after && beforeTime > 0 && afterTime > 0 && afterTime !== beforeTime) {
      result.set(
        driverNumber,
        interpolatePoint(driverNumber, before, after, beforeTime, afterTime, targetTimeMs),
      );
      continue;
    }

    if (before && beforeTime > 0 && targetTimeMs > beforeTime) {
      const referenceIndex = lowerBoundIndex(points, beforeTime - COAST_SAMPLE_MAX_MS);
      const referenceCandidate =
        referenceIndex < splitIndex - 1 ? points[referenceIndex] : null;
      const referenceCandidateTime = referenceCandidate ? pointTime(referenceCandidate) : 0;
      const reference =
        referenceCandidate &&
        referenceCandidateTime > 0 &&
        beforeTime - referenceCandidateTime >= COAST_SAMPLE_MIN_MS
          ? referenceCandidate
          : splitIndex >= 2
            ? points[splitIndex - 2]
            : null;
      const referenceTime = reference ? pointTime(reference) : 0;

      const coastedPoint = reference
        ? coastPoint(driverNumber, before, beforeTime, reference, referenceTime, targetTimeMs)
        : null;

      if (coastedPoint) {
        result.set(driverNumber, coastedPoint);
        continue;
      }
    }

    const fallback = before ?? after;
    if (fallback) {
      result.set(driverNumber, fallback);
    }
  }

  return result;
}

function nearestSegmentAngle(
  point: NormalizedTrackPoint,
  polyline: NormalizedTrackPoint[],
): number {
  if (polyline.length < 2) {
    return 0;
  }

  let bestAngle = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let index = 1; index < polyline.length; index += 1) {
    const start = polyline[index - 1];
    const end = polyline[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared <= 0) {
      continue;
    }

    const progress = Math.min(
      Math.max(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0),
      1,
    );
    const projectedX = start.x + dx * progress;
    const projectedY = start.y + dy * progress;
    const distance = (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2;

    if (distance < bestDistance) {
      bestDistance = distance;
      bestAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    }
  }

  return bestAngle;
}

export function TrackMap({
  meeting,
  standings,
  trackPoints,
  currentTrackPoints,
  finishLine,
  weather,
  motionTimeMs,
  hoveredDriver,
  selectedDriverNumber,
  locale,
  onHoverDriver,
  onSelectDriver,
}: TrackMapProps) {
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [driverProfileLoading, setDriverProfileLoading] = useState(false);
  const [driverProfileError, setDriverProfileError] = useState<string | null>(null);
  const [staticTrackPoints, setStaticTrackPoints] = useState<TrackPoint[] | null>(null);
  const stableTrackRef = useRef<{
    meetingKey: number | null;
    points: TrackPoint[];
    score: number;
    closed: boolean;
  } | null>(null);
  const driverPathRef = useRef<Map<number, number>>(new Map());
  const previousMotionTimeRef = useRef<number | null>(null);
  // Timestamp of the motion tick used for the *previous* `drivers` recompute (distinct from
  // previousMotionTimeRef, which only tracks backward-jump detection). The gap against this
  // is the real elapsed time used to size the transition duration of the next update.
  const lastDriversMotionTimeRef = useRef<number | null>(null);
  // Imperative animation state for driver markers: DOM node per driver, the position/track
  // distance currently displayed (as opposed to the latest computed target), and any
  // in-flight waypoint-stepping timer. Positioning is driven entirely outside of React's
  // render cycle (see the layout effect below) so a multi-second real-world gap can be
  // animated as a chain of short, curve-following steps instead of one straight-line jump.
  const markerNodeRefs = useRef<Map<number, SVGGElement>>(new Map());
  const displayedMarkerRef = useRef<
    Map<number, { x: number; y: number; trackDistance: number | null }>
  >(new Map());
  const markerAnimationTimersRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    driverPathRef.current.clear();
    previousMotionTimeRef.current = null;
    lastDriversMotionTimeRef.current = null;
    displayedMarkerRef.current.clear();

    for (const timerId of markerAnimationTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    markerAnimationTimersRef.current.clear();
  }, [meeting?.meetingKey]);

  useEffect(() => {
    const timers = markerAnimationTimersRef.current;

    return () => {
      for (const timerId of timers.values()) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  // Load pre-built static circuit geometry. The JSON files are generated by
  // scripts/generate_tracks.py and live at public/tracks/{circuitKey}.json.
  // They use the same OpenF1 coordinate system as live telemetry, so driver
  // markers overlay the static path with zero extra calibration.
  useEffect(() => {
    const circuitKey = meeting?.circuitKey;
    if (!circuitKey) {
      setStaticTrackPoints(null);
      return;
    }

    let cancelled = false;
    fetch(`/tracks/${circuitKey}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { points?: Array<{ x: number; y: number }> } | null) => {
        if (cancelled) return;
        if (data?.points && data.points.length > 0) {
          setStaticTrackPoints(
            data.points.map((p) => ({ driverNumber: 0, date: "", x: p.x, y: p.y })),
          );
        } else {
          setStaticTrackPoints(null);
        }
      })
      .catch(() => {
        if (!cancelled) setStaticTrackPoints(null);
      });

    return () => {
      cancelled = true;
    };
  }, [meeting?.circuitKey]);

  useEffect(() => {
    if (motionTimeMs === null) {
      previousMotionTimeRef.current = null;
      return;
    }

    const previousMotionTime = previousMotionTimeRef.current;

    if (previousMotionTime !== null && motionTimeMs + 1000 < previousMotionTime) {
      driverPathRef.current.clear();
    }

    previousMotionTimeRef.current = motionTimeMs;
  }, [motionTimeMs]);

  const standingTrackPoints = useMemo(
    () =>
      standings
        .map((row) => row.latestLocation)
        .filter((point): point is NonNullable<typeof point> => point !== null)
        .map(locationToTrackPoint),
    [standings],
  );

  // Grouping by driver is the expensive part of resolving a position at the current motion
  // time; hoisting it into its own memo means it only reruns when new telemetry actually
  // arrives, instead of on every ~40ms motion tick.
  const currentPointsByDriver = useMemo(
    () => groupTrackPointsByDriver(currentTrackPoints),
    [currentTrackPoints],
  );
  const standingPointsByDriver = useMemo(
    () => groupTrackPointsByDriver(standingTrackPoints),
    [standingTrackPoints],
  );
  const livePointsByDriver = useMemo(
    () => groupTrackPointsByDriver(trackPoints),
    [trackPoints],
  );

  const baseData = useMemo(() => {
    const liveWindowPoints = [...currentTrackPoints, ...standingTrackPoints];
    const geometryPoints = trackPoints.length >= 16 ? trackPoints : liveWindowPoints;
    const mapPoints = [...geometryPoints, ...liveWindowPoints];
    const candidatePolylineRaw = buildTrackPolyline(
      geometryPoints.length > 0 ? geometryPoints : liveWindowPoints,
    );
    const meetingKey = meeting?.meetingKey ?? null;
    const candidateScore = trackShapeScore(candidatePolylineRaw);
    const stableTrack = stableTrackRef.current;

    if (stableTrack?.meetingKey !== meetingKey) {
      stableTrackRef.current = null;
    }

    // A driver's raw trace over the session can concatenate multiple partial laps (out-lap,
    // pit stop, in-lap...), so the very first candidate that clears STABLE_TRACK_MIN_POINTS
    // may not actually form a closed loop yet - just a big arc. Check for that explicitly:
    // a candidate that closes the loop always wins over one that doesn't, no matter the
    // score, otherwise an early partial arc can get stuck forever (missing a chunk of the
    // circuit) since a merely-more-complete-but-still-partial arc rarely clears the
    // STABLE_TRACK_REPLACE_RATIO bar.
    const candidateClosed =
      candidatePolylineRaw.length >= TRACK_LOOP_MIN_POINTS &&
      buildTrackPath(
        extractSingleTrackLoop(
          normalizeTrackPoints(candidatePolylineRaw, SVG_WIDTH, SVG_HEIGHT, SVG_PADDING),
        ),
      ).closed;

    if (
      candidatePolylineRaw.length >= STABLE_TRACK_MIN_POINTS &&
      (!stableTrackRef.current ||
        (candidateClosed && !stableTrackRef.current.closed) ||
        candidateScore > stableTrackRef.current.score * STABLE_TRACK_REPLACE_RATIO)
    ) {
      stableTrackRef.current = {
        meetingKey,
        points: candidatePolylineRaw,
        score: candidateScore,
        closed: candidateClosed,
      };
    }

    // When a pre-built static circuit geometry file is available, use it
    // directly instead of the telemetry-derived reconstruction. The file uses
    // the same coordinate system, so the normalizer and driver positions work
    // unchanged.
    const polylineRaw =
      staticTrackPoints && staticTrackPoints.length >= 50
        ? staticTrackPoints
        : stableTrackRef.current?.points ?? candidatePolylineRaw;
    const normalizerSource = polylineRaw.length >= 32 ? polylineRaw : mapPoints;
    const allPoints = finishLine ? [...normalizerSource, finishLine] : normalizerSource;
    const normalizer = createTrackNormalizer(
      allPoints,
      SVG_WIDTH,
      SVG_HEIGHT,
      SVG_PADDING,
    );
    const normalizedPolyline = dedupeNearPoints(polylineRaw, 120)
      .map((point) => normalizer.map(point))
      .filter((point): point is NonNullable<typeof point> => point !== null);
    const polyline = extractSingleTrackLoop(normalizedPolyline);
    const path = buildTrackPath(polyline);
    const maxProjectionDistance = Math.min(
      Math.max(
        normalizedBoundsDiagonal(polyline) * MAX_PROJECTION_DISTANCE_RATIO,
        MAX_PROJECTION_DISTANCE_MIN_PX,
      ),
      MAX_PROJECTION_DISTANCE_MAX_PX,
    );
    const normalizedFinishLine = finishLine ? normalizer.map(finishLine) : null;
    const finishLineProjection =
      normalizedFinishLine && path.totalLength > 0
        ? projectPointToTrackPath(normalizedFinishLine, path)
        : null;

    return {
      polyline,
      path,
      finishLineTrackDistance: finishLineProjection?.trackDistance ?? null,
      maxProjectionDistance,
      finishLine:
        finishLine && normalizedFinishLine
          ? {
              ...normalizedFinishLine,
              angle: nearestSegmentAngle(normalizedFinishLine, polyline),
              confidence: finishLine.confidence,
              lapNumber: finishLine.lapNumber,
              source: finishLine.source,
            }
          : null,
      hasPoints: mapPoints.length > 0 || (staticTrackPoints !== null && staticTrackPoints.length > 0),
      normalizer,
    };
  }, [currentTrackPoints, finishLine, meeting?.meetingKey, standingTrackPoints, staticTrackPoints, trackPoints]);

  // Recomputed only when telemetry actually changes (see the dependency array below), not on
  // a ~40ms clock tick - `motionTimeMs` is read fresh from the closure for that purpose only,
  // deliberately left out of the dependency list so an unrelated re-render (hover, selection)
  // doesn't re-run this and reset the "time since last update" bookkeeping below.
  const { list: drivers, transitionMs: markerTransitionMs } = useMemo(() => {
    const currentMotionTimeMs = motionTimeMs;
    const previousDriversMotionTimeMs = lastDriversMotionTimeRef.current;
    const rawElapsedMs =
      currentMotionTimeMs !== null &&
      previousDriversMotionTimeMs !== null &&
      currentMotionTimeMs > previousDriversMotionTimeMs
        ? currentMotionTimeMs - previousDriversMotionTimeMs
        : MARKER_TRANSITION_MIN_MS;
    const transitionMs = Math.min(
      Math.max(rawElapsedMs, MARKER_TRANSITION_MIN_MS),
      MARKER_TRANSITION_MAX_MS,
    );
    lastDriversMotionTimeRef.current = currentMotionTimeMs;

    const currentPointByDriver =
      currentMotionTimeMs && currentPointsByDriver.size > 0
        ? getInterpolatedTrackPointByDriver(currentPointsByDriver, currentMotionTimeMs)
        : getLatestTrackPointByDriver(currentPointsByDriver);
    const standingPointByDriver =
      currentMotionTimeMs && standingPointsByDriver.size > 0
        ? getInterpolatedTrackPointByDriver(standingPointsByDriver, currentMotionTimeMs)
        : getLatestTrackPointByDriver(standingPointsByDriver);
    const livePointByDriver =
      currentMotionTimeMs && livePointsByDriver.size > 0
        ? getInterpolatedTrackPointByDriver(livePointsByDriver, currentMotionTimeMs)
        : getLatestTrackPointByDriver(livePointsByDriver);

    const mappedDrivers = standings
      .map((row) => {
        const markerPoint =
          currentPointByDriver.get(row.driverNumber) ??
          livePointByDriver.get(row.driverNumber) ??
          standingPointByDriver.get(row.driverNumber) ??
          null;

        if (!markerPoint) {
          return null;
        }

        const normalized = baseData.normalizer.map(markerPoint);
        if (!normalized) {
          return null;
        }

        const previousDistance = driverPathRef.current.get(row.driverNumber);
        const previousWrappedDistance =
          previousDistance !== undefined && baseData.path.totalLength > 0
            ? normalizePathDistance(previousDistance, baseData.path)
            : undefined;
        const projected =
          baseData.path.totalLength > 0
            ? projectPointToTrackPath(normalized, baseData.path, previousWrappedDistance)
            : null;
        const projectedTooFar =
          projected !== null &&
          projected.projectionDistance > baseData.maxProjectionDistance;
        const trackDistance =
          projected && baseData.path.totalLength > 0
            ? projectedTooFar && previousDistance !== undefined
              ? previousDistance
              : accumulateTrackDistance(projected.trackDistance, baseData.path, previousDistance)
            : null;
        const displayPoint =
          trackDistance !== null
            ? (pointAtTrackDistance(baseData.path, trackDistance) ?? normalized)
            : normalized;

        return {
          driverNumber: row.driverNumber,
          acronym: row.acronym,
          fullName: row.fullName,
          headshotUrl: row.headshotUrl,
          teamName: row.teamName,
          teamColour: row.teamColour,
          position: row.position,
          gap: row.gap,
          interval: row.interval,
          status: row.status,
          tyre: row.tyre,
          currentLap: row.currentLap,
          totalLaps: row.totalLaps,
          x: displayPoint.x,
          y: displayPoint.y,
          rawX: normalized.rawX,
          rawY: normalized.rawY,
          trackDistance,
          projectionDistance: projected?.projectionDistance ?? null,
        } satisfies NormalizedDriverTrackPosition;
      })
      .filter((driver): driver is NormalizedDriverTrackPosition => driver !== null);

    const list = applyStandingOrderGuard(
      mappedDrivers,
      baseData.path,
      baseData.finishLineTrackDistance,
      driverPathRef.current,
    );

    return { list, transitionMs };
  }, [
    baseData.normalizer,
    baseData.path,
    baseData.finishLineTrackDistance,
    baseData.maxProjectionDistance,
    currentPointsByDriver,
    livePointsByDriver,
    standingPointsByDriver,
    standings,
  ]);

  useEffect(() => {
    const nextDistances = new Map<number, number>();

    for (const driver of drivers) {
      if (driver.trackDistance !== null) {
        nextDistances.set(driver.driverNumber, driver.trackDistance);
      }
    }

    driverPathRef.current = nextDistances;
  }, [drivers]);

  // Owns every driver marker's `transform` imperatively (it is never part of the React style
  // prop - see the marker JSX below) so a new target can be broken into a chain of short,
  // curve-following transitions via plain setTimeout, without React re-rendering mid-chain and
  // fighting the in-flight animation. useLayoutEffect (not useEffect) so a brand-new marker's
  // first position is committed before paint, avoiding a flash at the SVG origin.
  useLayoutEffect(() => {
    const nodes = markerNodeRefs.current;
    const displayed = displayedMarkerRef.current;
    const timers = markerAnimationTimersRef.current;
    const liveDriverNumbers = new Set(drivers.map((driver) => driver.driverNumber));

    for (const [driverNumber, timerId] of timers) {
      if (!liveDriverNumbers.has(driverNumber)) {
        window.clearTimeout(timerId);
        timers.delete(driverNumber);
      }
    }
    for (const driverNumber of displayed.keys()) {
      if (!liveDriverNumbers.has(driverNumber)) {
        displayed.delete(driverNumber);
      }
    }

    for (const driver of drivers) {
      const node = nodes.get(driver.driverNumber);
      if (!node) {
        continue;
      }

      const existingTimer = timers.get(driver.driverNumber);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
        timers.delete(driver.driverNumber);
      }

      const previous = displayed.get(driver.driverNumber);
      const target = {
        x: driver.x,
        y: driver.y,
        trackDistance: driver.trackDistance,
      };

      if (!previous) {
        node.style.transition = "none";
        node.style.transform = `translate(${target.x}px, ${target.y}px)`;
        displayed.set(driver.driverNumber, target);
        continue;
      }

      const canFollowPath =
        baseData.path.totalLength > 0 &&
        previous.trackDistance !== null &&
        target.trackDistance !== null;
      const waypoints = canFollowPath
        ? buildTrackWaypoints(
            previous.trackDistance as number,
            target.trackDistance as number,
            baseData.path,
            markerTransitionMs,
            target,
          )
        : [{ x: target.x, y: target.y, durationMs: markerTransitionMs }];

      const runStep = (stepIndex: number) => {
        const step = waypoints[stepIndex];
        if (!step) {
          return;
        }

        node.style.transition = `transform ${step.durationMs}ms linear`;
        node.style.transform = `translate(${step.x}px, ${step.y}px)`;

        if (stepIndex + 1 < waypoints.length) {
          const timerId = window.setTimeout(() => runStep(stepIndex + 1), step.durationMs);
          timers.set(driver.driverNumber, timerId);
        } else {
          timers.delete(driver.driverNumber);
        }
      };

      runStep(0);
      displayed.set(driver.driverNumber, target);
    }
  }, [drivers, baseData.path, markerTransitionMs]);

  const renderedDrivers = useMemo(
    () =>
      [...drivers].sort((first, second) => {
        const firstActive =
          hoveredDriver === first.driverNumber ||
          selectedDriverNumber === first.driverNumber;
        const secondActive =
          hoveredDriver === second.driverNumber ||
          selectedDriverNumber === second.driverNumber;

        if (firstActive !== secondActive) {
          return firstActive ? 1 : -1;
        }

        const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER;
        const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER;

        return secondPosition - firstPosition;
      }),
    [drivers, hoveredDriver, selectedDriverNumber],
  );

  // A `<polyline>` never closes itself, so when the reconstructed lap is a closed loop
  // (baseData.path.closed), the drawn line needs its first point repeated at the end -
  // otherwise the gap between the last and first sampled point (typically right on the
  // start/finish straight) renders as a visible break in the track.
  const polylineRenderPoints =
    baseData.path.closed && baseData.polyline.length > 0
      ? [...baseData.polyline, baseData.polyline[0]]
      : baseData.polyline;
  const polylinePoints = polylineRenderPoints
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const hasTrack = baseData.polyline.length >= 3;
  const weatherState = rainState(weather, locale);
  const selectedStandingRow =
    standings.find((row) => row.driverNumber === selectedDriverNumber) ?? null;
  const selectedDriver =
    drivers.find((driver) => driver.driverNumber === selectedDriverNumber) ??
    (selectedStandingRow
      ? ({
          driverNumber: selectedStandingRow.driverNumber,
          acronym: selectedStandingRow.acronym,
          fullName: selectedStandingRow.fullName,
          headshotUrl: selectedStandingRow.headshotUrl,
          teamName: selectedStandingRow.teamName,
          teamColour: selectedStandingRow.teamColour,
          position: selectedStandingRow.position,
          gap: selectedStandingRow.gap,
          interval: selectedStandingRow.interval,
          status: selectedStandingRow.status,
          tyre: selectedStandingRow.tyre,
          currentLap: selectedStandingRow.currentLap,
          totalLaps: selectedStandingRow.totalLaps,
          x: 0,
          y: 0,
          rawX: 0,
          rawY: 0,
        } satisfies NormalizedDriverPosition)
      : null);

  useEffect(() => {
    if (!selectedDriver) {
      setDriverProfile(null);
      setDriverProfileLoading(false);
      setDriverProfileError(null);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ name: selectedDriver.fullName, lang: locale });

    async function loadDriverProfile() {
      setDriverProfileLoading(true);
      setDriverProfileError(null);

      try {
        const response = await fetch(`/api/driver-profile?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as
          | DriverProfileApiResponse
          | null;

        if (controller.signal.aborted) {
          return;
        }

        if (!response.ok || !payload?.data) {
          setDriverProfile(null);
          setDriverProfileError(t(locale, "profileNotFound"));
          return;
        }

        setDriverProfile(payload.data);
      } catch {
        if (!controller.signal.aborted) {
          setDriverProfile(null);
          setDriverProfileError(t(locale, "profileUnavailable"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setDriverProfileLoading(false);
        }
      }
    }

    loadDriverProfile();

    return () => {
      controller.abort();
    };
  }, [locale, selectedDriver?.fullName, selectedDriverNumber]);

  return (
    <section
      className={`relative h-full min-h-0 overflow-hidden rounded-lg border bg-black/18 shadow-2xl backdrop-blur-[2px] ${weatherState.trackClass}`}
    >
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.06),transparent_34rem),linear-gradient(180deg,rgba(0,0,0,0.20),rgba(0,0,0,0.42))]" />
      <div className="absolute left-4 right-4 top-4 z-30 flex items-start justify-between gap-3">
        <div className="flex flex-none items-center gap-2 rounded-md border border-white/10 bg-neutral-950/70 px-3 py-2 text-xs font-semibold text-neutral-200 backdrop-blur">
          <MapIcon className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          {circuitName(locale, meeting?.circuitShortName)}
        </div>
        <WeatherMiniBar weather={weather} locale={locale} />
      </div>

      {meeting?.circuitImage && !baseData.hasPoints ? (
        <img
          src={meeting.circuitImage}
          alt={meeting.circuitShortName}
          className="absolute inset-10 z-10 h-[calc(100%-5rem)] w-[calc(100%-5rem)] object-contain opacity-80"
        />
      ) : null}

      <svg
        role="img"
        aria-label={t(locale, "mapAria")}
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="relative z-10 h-full min-h-0 w-full"
        onClick={() => onSelectDriver(null)}
        onMouseLeave={() => onHoverDriver(null)}
      >
        <defs>
          <filter id="marker-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f8fafc" floodOpacity="0.35" />
          </filter>
          {drivers.map((driver) => (
            <clipPath key={avatarClipId(driver.driverNumber)} id={avatarClipId(driver.driverNumber)}>
              <circle r="21" cx="0" cy="0" />
            </clipPath>
          ))}
        </defs>
        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill="rgba(0,0,0,0.18)" />
        <g opacity="0.13">
          {Array.from({ length: 12 }).map((_, index) => (
            <line
              key={`grid-x-${index}`}
              x1={(SVG_WIDTH / 12) * index}
              y1="0"
              x2={(SVG_WIDTH / 12) * index}
              y2={SVG_HEIGHT}
              stroke="#ffffff"
              strokeWidth="1"
            />
          ))}
          {Array.from({ length: 8 }).map((_, index) => (
            <line
              key={`grid-y-${index}`}
              x1="0"
              y1={(SVG_HEIGHT / 8) * index}
              x2={SVG_WIDTH}
              y2={(SVG_HEIGHT / 8) * index}
              stroke="#ffffff"
              strokeWidth="1"
            />
          ))}
        </g>

        {hasTrack ? (
          <g>
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#000000"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="28"
              opacity="0.55"
            />
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#f4f4f5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="13"
            />
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#ef4444"
              strokeDasharray="18 20"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              opacity="0.9"
            />
          </g>
        ) : null}

        {baseData.finishLine && hasTrack ? (
          <g pointerEvents="none">
            <title>
              {finishLine ? finishLineTitle(finishLine, locale) : t(locale, "finishLineFallback")}
            </title>
            <g
              transform={`translate(${baseData.finishLine.x.toFixed(1)} ${baseData.finishLine.y.toFixed(1)}) rotate(${baseData.finishLine.angle.toFixed(1)})`}
            >
              <line
                x1="-35"
                y1="0"
                x2="35"
                y2="0"
                stroke="#020617"
                strokeLinecap="round"
                strokeWidth="20"
                opacity="0.82"
              />
              <rect
                x="-29"
                y="-7"
                width="58"
                height="14"
                rx="2"
                fill="#f8fafc"
                stroke="#020617"
                strokeWidth="2"
              />
              {Array.from({ length: 8 }).map((_, index) => (
                <g key={`finish-check-${index}`}>
                  <rect
                    x={-29 + index * 7.25}
                    y="-7"
                    width="7.25"
                    height="7"
                    fill={index % 2 === 0 ? "#020617" : "#f8fafc"}
                  />
                  <rect
                    x={-29 + index * 7.25}
                    y="0"
                    width="7.25"
                    height="7"
                    fill={index % 2 === 0 ? "#f8fafc" : "#020617"}
                  />
                </g>
              ))}
            </g>
            <text
              x={baseData.finishLine.x}
              y={baseData.finishLine.y - 28}
              textAnchor="middle"
              className="select-none text-[15px] font-black"
              fill="#ffffff"
              stroke="#020617"
              strokeWidth="4"
              paintOrder="stroke"
            >
              {t(locale, "finishLine")}
            </text>
          </g>
        ) : null}

        {renderedDrivers.map((driver) => {
          const active =
            hoveredDriver === driver.driverNumber ||
            selectedDriverNumber === driver.driverNumber;
          const radius = active ? 23 : 19;
          const imageRadius = active ? 21 : 17;
          const positionLabel = driver.position ? `P${driver.position}` : null;
          const positionBadgeWidth = positionLabel && positionLabel.length > 2 ? 30 : 24;

          return (
            <g
              key={driver.driverNumber}
              ref={(node) => {
                if (node) {
                  markerNodeRefs.current.set(driver.driverNumber, node);
                } else {
                  markerNodeRefs.current.delete(driver.driverNumber);
                }
              }}
              onMouseEnter={() => onHoverDriver(driver.driverNumber)}
              onMouseLeave={() => onHoverDriver(null)}
              onClick={(event) => {
                event.stopPropagation();
                onSelectDriver(
                  selectedDriverNumber === driver.driverNumber ? null : driver.driverNumber,
                );
              }}
              style={{
                // `transform` is intentionally never set here - it is owned imperatively by
                // the layout effect above so a multi-waypoint animation can run without React
                // re-rendering over it mid-chain.
                transformBox: "fill-box",
                transformOrigin: "center",
                willChange: "transform",
                opacity: hoveredDriver && !active ? 0.48 : 1,
                transition: "opacity 160ms ease",
                cursor: "pointer",
              }}
              filter={active ? "url(#marker-glow)" : undefined}
            >
              <title>{markerTitle(driver, locale)}</title>
              <circle
                r={radius}
                fill={driver.teamColour}
                stroke="#ffffff"
                strokeWidth={active ? 4 : 3}
              />
              {driver.headshotUrl ? (
                <image
                  href={driver.headshotUrl}
                  x={-imageRadius}
                  y={-imageRadius}
                  width={imageRadius * 2}
                  height={imageRadius * 2}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${avatarClipId(driver.driverNumber)})`}
                />
              ) : (
                <circle r={imageRadius} fill="#111827" stroke="rgba(255,255,255,0.25)" />
              )}
              <circle
                r={imageRadius}
                fill="none"
                stroke="rgba(0,0,0,0.55)"
                strokeWidth="1.5"
              />
              <text
                x="0"
                y={active ? -31 : -27}
                textAnchor="middle"
                className="select-none text-[18px] font-black"
                fill="#ffffff"
                stroke="#050505"
                strokeWidth="4"
                paintOrder="stroke"
              >
                {driver.acronym}
              </text>
              {positionLabel ? (
                <g transform={`translate(${active ? 17 : 15} ${active ? 18 : 16})`}>
                  <rect
                    x={-positionBadgeWidth / 2}
                    y="-9"
                    width={positionBadgeWidth}
                    height="18"
                    rx="5"
                    fill="#020617"
                    stroke="#ffffff"
                    strokeWidth="1.6"
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    className="select-none text-[11px] font-black"
                    fill="#ffffff"
                  >
                    {positionLabel}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}

      </svg>
      <WeatherTrackLayer weather={weather} />

      {selectedDriver ? (
        <DriverProfileCard
          driver={selectedDriver}
          profile={driverProfile}
          loading={driverProfileLoading}
          error={driverProfileError}
          locale={locale}
          onClose={() => onSelectDriver(null)}
        />
      ) : null}

      {!baseData.hasPoints ? (
        <div className="absolute inset-x-4 bottom-4 z-30 rounded-lg border border-white/10 bg-neutral-950/74 p-4 text-sm text-neutral-300 backdrop-blur">
          <div className="flex items-center gap-2 font-semibold text-white">
            <MousePointer2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            {t(locale, "trackUnavailable")}
          </div>
        </div>
      ) : !hasTrack ? (
        <div className="absolute bottom-4 left-4 z-30 rounded-md border border-amber-300/30 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-50">
          {t(locale, "trackReconstructed")}
        </div>
      ) : (
        <div className="absolute bottom-4 left-4 z-30 rounded-md border border-emerald-300/25 bg-emerald-950/25 px-3 py-2 text-xs font-semibold text-emerald-50">
          {t(locale, "trackReconstructed")}
        </div>
      )}
    </section>
  );
}
