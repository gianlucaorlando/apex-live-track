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
import { useEffect, useMemo, useState } from "react";
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
  )} ${driver.gap} | ${t(locale, "markerInterval")} ${driver.interval}${tyre}${status}`;
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
  if (!point.date) {
    return 0;
  }

  const time = new Date(point.date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function getLatestTrackPointByDriver(points: TrackPoint[]): Map<number, TrackPoint> {
  const latest = new Map<number, TrackPoint>();

  for (const point of points) {
    if (typeof point.driverNumber !== "number" || point.driverNumber <= 0) {
      continue;
    }

    const current = latest.get(point.driverNumber);
    if (!current || pointTime(point) >= pointTime(current)) {
      latest.set(point.driverNumber, point);
    }
  }

  return latest;
}

function getInterpolatedTrackPointByDriver(
  points: TrackPoint[],
  targetTimeMs: number,
): Map<number, TrackPoint> {
  const byDriver = new Map<
    number,
    {
      before: TrackPoint | null;
      beforeTime: number;
      after: TrackPoint | null;
      afterTime: number;
    }
  >();

  for (const point of points) {
    if (typeof point.driverNumber !== "number" || point.driverNumber <= 0) {
      continue;
    }

    const time = pointTime(point);
    if (time <= 0) {
      continue;
    }

    const bucket =
      byDriver.get(point.driverNumber) ??
      {
        before: null,
        beforeTime: Number.NEGATIVE_INFINITY,
        after: null,
        afterTime: Number.POSITIVE_INFINITY,
      };

    if (time <= targetTimeMs && time > bucket.beforeTime) {
      bucket.before = point;
      bucket.beforeTime = time;
    }

    if (time >= targetTimeMs && time < bucket.afterTime) {
      bucket.after = point;
      bucket.afterTime = time;
    }

    byDriver.set(point.driverNumber, bucket);
  }

  const result = new Map<number, TrackPoint>();

  for (const [driverNumber, bucket] of byDriver) {
    if (bucket.before && bucket.after && bucket.afterTime !== bucket.beforeTime) {
      const progress =
        (targetTimeMs - bucket.beforeTime) / (bucket.afterTime - bucket.beforeTime);
      const clampedProgress = Math.min(Math.max(progress, 0), 1);

      result.set(driverNumber, {
        driverNumber,
        date: new Date(targetTimeMs).toISOString(),
        x: bucket.before.x + (bucket.after.x - bucket.before.x) * clampedProgress,
        y: bucket.before.y + (bucket.after.y - bucket.before.y) * clampedProgress,
        z:
          bucket.before.z !== undefined &&
          bucket.before.z !== null &&
          bucket.after.z !== undefined &&
          bucket.after.z !== null
            ? bucket.before.z + (bucket.after.z - bucket.before.z) * clampedProgress
            : bucket.before.z,
      });
      continue;
    }

    const fallback = bucket.before ?? bucket.after;
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
  const baseData = useMemo(() => {
    const latestPoints = standings
      .map((row) => row.latestLocation)
      .filter((point): point is NonNullable<typeof point> => point !== null)
      .map(locationToTrackPoint);
    const mapPoints = [...trackPoints, ...latestPoints];
    const allPoints = finishLine ? [...mapPoints, finishLine] : mapPoints;
    const polylineRaw = buildTrackPolyline(trackPoints.length > 0 ? trackPoints : latestPoints);
    const normalizer = createTrackNormalizer(
      [...allPoints, ...polylineRaw],
      SVG_WIDTH,
      SVG_HEIGHT,
      SVG_PADDING,
    );
    const polyline = dedupeNearPoints(polylineRaw, 120)
      .map((point) => normalizer.map(point))
      .filter((point): point is NonNullable<typeof point> => point !== null);
    const normalizedFinishLine = finishLine ? normalizer.map(finishLine) : null;

    return {
      polyline,
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
      hasPoints: mapPoints.length > 0,
      normalizer,
    };
  }, [finishLine, standings, trackPoints]);

  const drivers = useMemo(() => {
    const livePointByDriver =
      motionTimeMs && trackPoints.length > 0
        ? getInterpolatedTrackPointByDriver(trackPoints, motionTimeMs)
        : getLatestTrackPointByDriver(trackPoints);

    return standings
      .map((row) => {
        const markerPoint =
          livePointByDriver.get(row.driverNumber) ??
          (row.latestLocation ? locationToTrackPoint(row.latestLocation) : null);

        if (!markerPoint) {
          return null;
        }

        const normalized = baseData.normalizer.map(markerPoint);
        if (!normalized) {
          return null;
        }

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
          x: normalized.x,
          y: normalized.y,
          rawX: normalized.rawX,
          rawY: normalized.rawY,
        } satisfies NormalizedDriverPosition;
      })
      .filter((driver): driver is NormalizedDriverPosition => driver !== null);
  }, [baseData.normalizer, motionTimeMs, standings, trackPoints]);

  const polylinePoints = baseData.polyline
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

        {drivers.map((driver) => {
          const active =
            hoveredDriver === driver.driverNumber ||
            selectedDriverNumber === driver.driverNumber;
          const radius = active ? 23 : 19;
          const imageRadius = active ? 21 : 17;

          return (
            <g
              key={driver.driverNumber}
              onMouseEnter={() => onHoverDriver(driver.driverNumber)}
              onMouseLeave={() => onHoverDriver(null)}
              onClick={(event) => {
                event.stopPropagation();
                onSelectDriver(
                  selectedDriverNumber === driver.driverNumber ? null : driver.driverNumber,
                );
              }}
              style={{
                transform: `translate(${driver.x}px, ${driver.y}px)`,
                transition: "transform 260ms linear, opacity 160ms ease",
                transformBox: "fill-box",
                transformOrigin: "center",
                willChange: "transform",
                opacity: hoveredDriver && !active ? 0.48 : 1,
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
