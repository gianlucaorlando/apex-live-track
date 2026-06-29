"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  ExternalLink,
  Flag,
  Loader2,
  Medal,
  RefreshCcw,
  Shield,
  Trophy,
  UsersRound,
} from "lucide-react";
import { apiMessage, intlLocale, t, type Locale } from "@/lib/i18n";
import type {
  SeasonConstructorStanding,
  SeasonConstructorPointsAvailability,
  SeasonDriverStanding,
  SeasonStandingsApiResponse,
  SeasonStandingsPayload,
} from "@/types/seasonStandings";

function teamColor(name: string): string {
  const normalized = name.toLocaleLowerCase("en-US");

  if (normalized.includes("ferrari")) return "#ef4444";
  if (normalized.includes("mercedes")) return "#2dd4bf";
  if (normalized.includes("mclaren")) return "#f97316";
  if (normalized.includes("red bull")) return "#3b82f6";
  if (normalized.includes("williams")) return "#60a5fa";
  if (normalized.includes("aston")) return "#10b981";
  if (normalized.includes("alpine")) return "#38bdf8";
  if (normalized.includes("haas")) return "#e5e7eb";
  if (normalized.includes("audi")) return "#f43f5e";
  if (normalized.includes("cadillac")) return "#facc15";
  if (normalized === "rb f1 team" || normalized.includes("racing bulls")) return "#a78bfa";

  return "#a3a3a3";
}

function formatUpdatedAt(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function driverName(driver: SeasonDriverStanding): string {
  return [driver.givenName, driver.familyName].filter(Boolean).join(" ");
}

function pointsLabel(points: number, locale: Locale): string {
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    maximumFractionDigits: 1,
  }).format(points);

  return `${formatted} ${t(locale, "pointsShort")}`;
}

function barWidth(points: number, maxPoints: number): string {
  if (maxPoints <= 0) {
    return "0%";
  }

  return `${Math.max(4, Math.min(100, (points / maxPoints) * 100))}%`;
}

function positionTone(position: number): string {
  if (position === 1) return "border-amber-300/35 bg-amber-300/10 text-amber-100";
  if (position === 2) return "border-neutral-200/30 bg-white/10 text-neutral-100";
  if (position === 3) return "border-orange-300/30 bg-orange-300/10 text-orange-100";

  return "border-white/10 bg-white/[0.035] text-neutral-300";
}

function StandingMeta({
  points,
  wins,
  locale,
}: {
  points: number;
  wins: number;
  locale: Locale;
}) {
  return (
    <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
      <span>{pointsLabel(points, locale)}</span>
      <span className="h-1 w-1 rounded-full bg-white/30" />
      <span>
        {wins} {t(locale, "wins")}
      </span>
    </div>
  );
}

function DriverRow({
  row,
  maxPoints,
  locale,
}: {
  row: SeasonDriverStanding;
  maxPoints: number;
  locale: Locale;
}) {
  const color = teamColor(row.constructorName);

  return (
    <article
      className={`relative overflow-hidden rounded-lg border ${positionTone(
        row.position,
      )} px-3 py-3`}
      data-season-driver-row
    >
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <div className="relative flex items-start gap-3">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-md border border-white/10 bg-neutral-950/55 text-sm font-black text-white">
          P{row.position}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-base font-black text-white">{row.code}</span>
                {row.position === 1 ? (
                  <span className="rounded bg-amber-300/18 px-1.5 py-0.5 text-[0.66rem] font-black uppercase tracking-[0.12em] text-amber-100">
                    {t(locale, "championshipLeader")}
                  </span>
                ) : null}
              </div>
              <h3 className="mt-0.5 truncate text-sm font-bold text-white">
                {driverName(row)}
              </h3>
            </div>

            {row.wikipediaUrl ? (
              <a
                href={row.wikipediaUrl}
                target="_blank"
                rel="noreferrer"
                title={driverName(row)}
                className="grid h-8 w-8 flex-none place-items-center rounded-md border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/12 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-neutral-400">
            <span>{row.constructorName}</span>
            {row.permanentNumber ? (
              <span>
                {t(locale, "driverNumberLabel")} {row.permanentNumber}
              </span>
            ) : null}
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <StandingMeta points={row.points} wins={row.wins} locale={locale} />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{ width: barWidth(row.points, maxPoints), backgroundColor: color }}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ConstructorRow({
  row,
  maxPoints,
  seasonMaxPoints,
  locale,
}: {
  row: SeasonConstructorStanding;
  maxPoints: number;
  seasonMaxPoints: number | null;
  locale: Locale;
}) {
  const color = teamColor(row.name);

  return (
    <article
      className={`relative overflow-hidden rounded-lg border ${positionTone(
        row.position,
      )} px-3 py-3`}
      data-season-constructor-row
    >
      <div className="relative flex items-start gap-3">
        <div
          className="grid h-11 w-11 flex-none place-items-center rounded-md text-sm font-black text-neutral-950"
          style={{ backgroundColor: color }}
        >
          P{row.position}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-base font-black text-white">{row.name}</h3>
              {row.position === 1 ? (
                <div className="mt-1 text-[0.66rem] font-black uppercase tracking-[0.12em] text-amber-100">
                  {t(locale, "championshipLeader")}
                </div>
              ) : null}
            </div>

            {row.wikipediaUrl ? (
              <a
                href={row.wikipediaUrl}
                target="_blank"
                rel="noreferrer"
                title={row.name}
                className="grid h-8 w-8 flex-none place-items-center rounded-md border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/12 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>

          <div className="mt-3">
            <div className="mb-1">
              <StandingMeta points={row.points} wins={row.wins} locale={locale} />
              {seasonMaxPoints ? (
                <div className="mt-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-neutral-500">
                  {t(locale, "constructorPointsOfMax", {
                    current: pointsLabel(row.points, locale),
                    max: pointsLabel(seasonMaxPoints, locale),
                  })}
                </div>
              ) : null}
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{ width: barWidth(row.points, maxPoints), backgroundColor: color }}
              />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ConstructorPointsSummary({
  points,
  locale,
}: {
  points: SeasonConstructorPointsAvailability;
  locale: Locale;
}) {
  return (
    <article
      className="rounded-lg border border-amber-300/20 bg-amber-300/[0.075] p-3"
      data-constructor-points-available
    >
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 flex-none place-items-center rounded-md border border-amber-200/25 bg-amber-200/12 text-amber-100">
          <Flag className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-100/85">
            {t(locale, "constructorAvailablePointsTitle")}
          </div>
          <div className="mt-1 text-[0.68rem] font-semibold text-amber-50/58">
            {t(locale, "constructorAvailablePointsBreakdown", {
              races: points.raceCount,
              sprints: points.sprintCount,
            })}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md border border-white/10 bg-neutral-950/35 px-2.5 py-2">
              <div className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-neutral-400">
                {t(locale, "constructorTotalPool")}
              </div>
              <div className="mt-1 text-base font-black text-white">
                {pointsLabel(points.totalPointsPool, locale)}
              </div>
            </div>
            <div className="rounded-md border border-white/10 bg-neutral-950/35 px-2.5 py-2">
              <div className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-neutral-400">
                {t(locale, "constructorMaxTeam")}
              </div>
              <div className="mt-1 text-base font-black text-white">
                {pointsLabel(points.maxSingleConstructorPoints, locale)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function StandingsPanel({
  title,
  icon,
  children,
  count,
}: {
  title: string;
  icon: "drivers" | "constructors";
  children: React.ReactNode;
  count: number;
}) {
  const Icon = icon === "drivers" ? UsersRound : Shield;

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-950/72">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-red-300" aria-hidden="true" />
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">
            {title}
          </h2>
        </div>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-neutral-300">
          {count}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <div className="grid gap-2">{children}</div>
      </div>
    </section>
  );
}

export function SeasonStandings({ locale }: { locale: Locale }) {
  const [standings, setStandings] = useState<SeasonStandingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStandings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ lang: locale });
      const response = await fetch(`/api/f1/season-standings?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | SeasonStandingsApiResponse
        | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.meta.messages[0] ?? t(locale, "seasonStandingsNotAvailable"),
        );
      }

      setStandings(payload.data);
      if (payload.meta.partial && payload.meta.messages[0]) {
        setError(apiMessage(locale, payload.meta.messages[0]));
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? apiMessage(locale, loadError.message)
          : t(locale, "seasonStandingsNotAvailable"),
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadStandings();
  }, [loadStandings]);

  const summary = useMemo(() => {
    const drivers = standings?.drivers ?? [];
    const constructors = standings?.constructors ?? [];
    const maxDriverPoints = Math.max(...drivers.map((row) => row.points), 0);
    const maxConstructorPoints = Math.max(...constructors.map((row) => row.points), 0);
    const maxConstructorSeasonPoints =
      standings?.constructorPointsAvailable?.maxSingleConstructorPoints ?? null;

    return {
      maxDriverPoints,
      maxConstructorPoints,
      maxConstructorSeasonPoints,
      drivers: drivers.length,
      constructors: constructors.length,
    };
  }, [standings]);

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-neutral-950/74 backdrop-blur-sm"
      data-season-standings
    >
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-200" aria-hidden="true" />
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">
              {t(locale, "seasonStandingsTitle", { season: standings?.season ?? "" })}
            </h2>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs sm:flex sm:flex-wrap">
            <div className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-2">
              <div className="text-base font-black text-white">
                {standings?.round ? standings.round : "-"}
              </div>
              <div className="font-semibold text-neutral-400">
                {t(locale, "afterRound", { round: standings?.round ?? "-" })}
              </div>
            </div>
            <div className="rounded-md border border-cyan-300/18 bg-cyan-300/8 px-2.5 py-2">
              <div className="text-base font-black text-cyan-100">{summary.drivers}</div>
              <div className="font-semibold text-cyan-100/65">{t(locale, "driverShort")}</div>
            </div>
            <div className="rounded-md border border-amber-300/18 bg-amber-300/8 px-2.5 py-2">
              <div className="text-base font-black text-amber-100">{summary.constructors}</div>
              <div className="font-semibold text-amber-100/65">
                {t(locale, "constructorStandingsTitle")}
              </div>
            </div>
            {standings ? (
              <div className="col-span-3 self-end text-[0.68rem] font-semibold text-neutral-500 sm:col-span-1">
                {t(locale, "updated")} {formatUpdatedAt(standings.generatedAt, locale)}
              </div>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={loadStandings}
          disabled={loading}
          title={t(locale, "seasonStandingsRefreshTitle")}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {t(locale, "refresh")}
        </button>
      </div>

      {loading && !standings ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center text-sm text-neutral-300">
          <div>
            <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-red-300" />
            {t(locale, "seasonStandingsLoading")}
          </div>
        </div>
      ) : error && !standings ? (
        <div className="grid min-h-0 flex-1 place-items-center px-6 text-center">
          <div className="max-w-md">
            <CircleAlert className="mx-auto mb-3 h-7 w-7 text-red-300" />
            <h3 className="text-sm font-bold text-white">
              {t(locale, "seasonStandingsUnavailable")}
            </h3>
            <p className="mt-2 text-sm text-neutral-400">{error}</p>
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          {error ? (
            <div className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-2 text-sm text-amber-50">
              {error}
            </div>
          ) : null}

          <div className="grid h-full min-h-[34rem] gap-3 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <StandingsPanel
              title={t(locale, "driverStandingsTitle")}
              icon="drivers"
              count={standings?.drivers.length ?? 0}
            >
              {(standings?.drivers ?? []).map((row) => (
                <DriverRow
                  key={row.driverId || row.code}
                  row={row}
                  maxPoints={summary.maxDriverPoints}
                  locale={locale}
                />
              ))}
            </StandingsPanel>

            <StandingsPanel
              title={t(locale, "constructorStandingsTitle")}
              icon="constructors"
              count={standings?.constructors.length ?? 0}
            >
              {standings?.constructorPointsAvailable ? (
                <ConstructorPointsSummary
                  points={standings.constructorPointsAvailable}
                  locale={locale}
                />
              ) : null}
              {(standings?.constructors ?? []).map((row) => (
                <ConstructorRow
                  key={row.constructorId || row.name}
                  row={row}
                  maxPoints={
                    summary.maxConstructorSeasonPoints ?? summary.maxConstructorPoints
                  }
                  seasonMaxPoints={summary.maxConstructorSeasonPoints}
                  locale={locale}
                />
              ))}
            </StandingsPanel>
          </div>
        </div>
      )}
    </section>
  );
}
