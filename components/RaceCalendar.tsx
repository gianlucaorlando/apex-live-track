"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Loader2 } from "lucide-react";
import {
  apiMessage,
  circuitName,
  intlLocale,
  placeName,
  raceName,
  sessionName,
  t,
  type Locale,
} from "@/lib/i18n";
import type {
  F1CalendarApiResponse,
  F1CalendarPayload,
  F1CalendarRace,
  F1CalendarSessionType,
} from "@/types/calendar";

function constructorColor(name: string): string {
  const normalized = name.toLocaleLowerCase("en-US");

  if (normalized.includes("ferrari")) return "#dc0000";
  if (normalized.includes("mercedes")) return "#00a19c";
  if (normalized.includes("mclaren")) return "#f47600";
  if (normalized.includes("red bull")) return "#1e41ff";
  if (normalized.includes("williams")) return "#1868db";
  if (normalized.includes("aston")) return "#00665e";
  if (normalized.includes("alpine")) return "#0090ff";
  if (normalized.includes("haas")) return "#9c9fa2";
  if (normalized.includes("audi")) return "#bb0a30";
  if (normalized.includes("cadillac")) return "#b59410";
  if (normalized.includes("racing bulls") || normalized === "rb f1 team") return "#6c98ff";

  return "#888888";
}

const SESSION_KEYS: Record<F1CalendarSessionType, string> = {
  "practice-1": "practice 1",
  "practice-2": "practice 2",
  "practice-3": "practice 3",
  qualifying: "qualifying",
  race: "race",
  sprint: "sprint",
  "sprint-qualifying": "sprint qualifying",
  "sprint-shootout": "sprint shootout",
};

function shortRaceName(name: string): string {
  return name.replace(/^Gran Premio /, "GP ").replace(/^Grand Prix of /, "GP ").replace(/ Grand Prix$/, " GP");
}

function formatDay(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { day: "numeric", month: "short" }).format(new Date(iso));
}

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);

  return now;
}

function NextRace({ race, locale }: { race: F1CalendarRace; locale: Locale }) {
  const now = useNow(30000);
  const left = Math.max(new Date(race.startsAt).getTime() - now, 0);
  const days = Math.floor(left / 86400000);
  const hours = Math.floor((left % 86400000) / 3600000);
  const minutes = Math.floor((left % 3600000) / 60000);
  const weekday = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", day: "numeric" });
  const time = new Intl.DateTimeFormat(intlLocale(locale), { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="panel rounded-md border-t-[3px] border-t-f1red px-4 py-4">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-[0.14em]">
        <span className="text-f1red">{t(locale, "nextRaceLabel", { round: race.round })}</span>
        <span className="font-medium normal-case tracking-normal text-muted">{formatDay(race.startsAt, locale)}</span>
      </div>
      <h2 className="mt-1 text-2xl font-bold leading-tight">{raceName(locale, race.raceName, race.country)}</h2>
      <div className="text-[11px] text-muted">
        {circuitName(locale, race.circuitName)} · {placeName(locale, race.locality)}
      </div>

      <div className="my-3 flex justify-around border-y border-line py-3">
        {[
          [days, t(locale, "countdownDays")],
          [hours, t(locale, "countdownHours")],
          [minutes, t(locale, "countdownMinutes")],
        ].map(([value, label]) => (
          <div key={String(label)} className="min-w-16 text-center">
            <div className="font-display text-[34px] font-bold leading-none">{String(value).padStart(2, "0")}</div>
            <div className="text-[10px] text-muted">{label}</div>
          </div>
        ))}
      </div>

      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">{t(locale, "weekendSchedule")}</div>
      {race.sessions.map((session) => (
        <div
          key={`${session.type}-${session.startsAt}`}
          className={`grid grid-cols-[3.5rem_1fr_auto] gap-2.5 border-t border-[#efefec] py-1.5 text-[13px] ${
            session.type === "race" ? "font-bold" : ""
          }`}
        >
          <span className="capitalize text-muted">{weekday.format(new Date(session.startsAt))}</span>
          <span>{sessionName(locale, SESSION_KEYS[session.type])}</span>
          <span>{time.format(new Date(session.startsAt))}</span>
        </div>
      ))}
    </div>
  );
}

export function RaceCalendar({ locale }: { locale: Locale }) {
  const [calendar, setCalendar] = useState<F1CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ lang: locale });
      const response = await fetch(`/api/f1/calendar?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as F1CalendarApiResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.meta.messages[0] ?? t(locale, "calendarNotAvailable"));
      }

      setCalendar(payload.data);
      if (payload.meta.partial && payload.meta.messages[0]) {
        setError(apiMessage(locale, payload.meta.messages[0]));
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? apiMessage(locale, loadError.message) : t(locale, "calendarNotAvailable"),
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  const view = useMemo(() => {
    const races = calendar?.races ?? [];
    const done = races.filter((race) => race.status === "past");
    const upcoming = races.filter((race) => race.status !== "past");
    const winsByDriver = new Map<string, number>();
    const winsByTeam = new Map<string, number>();

    for (const race of done) {
      const winner = race.podium.find((driver) => driver.position === 1);
      if (!winner) continue;
      winsByDriver.set(winner.code, (winsByDriver.get(winner.code) ?? 0) + 1);
      winsByTeam.set(winner.constructorName, (winsByTeam.get(winner.constructorName) ?? 0) + 1);
    }

    const byCount = (map: Map<string, number>) => [...map].sort((a, b) => b[1] - a[1]);

    return {
      races,
      done,
      upcoming,
      winners: winsByDriver.size,
      racesWithWinner: [...winsByDriver.values()].reduce((sum, value) => sum + value, 0),
      teams: byCount(winsByTeam),
      topDriver: byCount(winsByDriver)[0] ?? null,
    };
  }, [calendar]);

  if (loading && !calendar) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-f1red" />
          {t(locale, "calendarLoading")}
        </div>
      </div>
    );
  }

  if (!calendar) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div className="max-w-md">
          <CircleAlert className="mx-auto mb-3 h-7 w-7 text-f1red" />
          <p className="text-sm text-muted">{error}</p>
        </div>
      </div>
    );
  }

  const progress = view.races.length > 0 ? view.done.length / view.races.length : 0;
  const nextRace = view.upcoming[0] ?? null;

  return (
    <section className="flex h-full min-h-0 flex-col gap-3" data-f1-calendar>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "calendarTitle", { season: calendar.season })}</h1>
          <div className="text-sm text-muted">
            {t(locale, "racesCompletedOf", { done: view.done.length, total: view.races.length })}
          </div>
        </div>
        <div className="w-full max-w-md">
          <div className="h-1.5 rounded-full bg-line">
            <div className="h-1.5 rounded-full bg-ink" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div className="mt-1 text-right text-[10px] text-muted">
            {t(locale, "seasonProgress", { percent: Math.round(progress * 100) })}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[25rem_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col gap-4 overflow-auto">
          {nextRace ? <NextRace race={nextRace} locale={locale} /> : null}

          <div className="panel rounded-md px-4 py-3">
            {view.upcoming.length > 1 ? (
              <>
                <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
                  {t(locale, "stillOnCalendar")}
                </div>
                {view.upcoming.slice(1).map((race) => (
                  <div key={race.round} className="grid grid-cols-[2.2rem_1fr_auto] gap-2.5 border-t border-[#efefec] py-2">
                    <span className="text-muted">R{race.round}</span>
                    <span>
                      <span className="block font-display text-sm font-bold">
                        {shortRaceName(raceName(locale, race.raceName, race.country))}
                      </span>
                      <span className="text-[11px] text-muted">{circuitName(locale, race.circuitName)}</span>
                    </span>
                    <span className="text-muted">{formatDay(race.startsAt, locale)}</span>
                  </div>
                ))}
              </>
            ) : null}

            <div className="mb-2 mt-4 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted first:mt-0">
              {t(locale, "seasonInNumbers")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label={t(locale, "statDifferentWinners")} value={view.winners} foot={t(locale, "statOfRaces", { count: view.racesWithWinner })} />
              <Stat label={t(locale, "statWinningTeams")} value={view.teams.length} foot={view.teams.map(([team]) => team).join(", ")} />
              <Stat
                label={t(locale, "statMostWins")}
                value={view.topDriver ? `${view.topDriver[0]} · ${view.topDriver[1]}` : "—"}
                foot={t(locale, "driverColumn")}
              />
              <Stat label={t(locale, "statTopTeam")} value={view.teams[0]?.[1] ?? "—"} foot={view.teams[0]?.[0] ?? ""} />
            </div>
          </div>
        </div>

        <div className="panel flex min-h-0 flex-col overflow-hidden rounded-md">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.08em]">{t(locale, "resultsTitle")}</h2>
            <span className="text-[11px] text-muted">{t(locale, "resultsHint")}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-soft text-left text-[10px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  {[t(locale, "roundShort"), t(locale, "grandPrixColumn"), t(locale, "circuitColumn"), t(locale, "dateColumn"), t(locale, "winnerColumn"), "2°", "3°"].map(
                    (label) => (
                      <th key={label} className="border-b border-line px-2 py-1.5 font-semibold">
                        {label}
                      </th>
                    ),
                  )}
                  <th className="border-b border-line px-2 py-1.5 text-right font-semibold">{t(locale, "lapsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {view.done.map((race) => {
                  const podium = [...race.podium].sort((a, b) => a.position - b.position);

                  return (
                    <tr key={race.round} className="hover:bg-soft">
                      <td className="border-b border-[#efefec] px-2 py-2 text-muted">{race.round}</td>
                      <td className="border-b border-[#efefec] px-2 py-2 font-display text-[13px] font-bold">
                        {race.wikipediaUrl ? (
                          <a href={race.wikipediaUrl} target="_blank" rel="noreferrer" className="hover:underline">
                            {shortRaceName(raceName(locale, race.raceName, race.country))}
                          </a>
                        ) : (
                          shortRaceName(raceName(locale, race.raceName, race.country))
                        )}
                      </td>
                      <td className="border-b border-[#efefec] px-2 py-2 text-[11px] text-muted">{circuitName(locale, race.circuitName)}</td>
                      <td className="border-b border-[#efefec] px-2 py-2 text-muted">{formatDay(race.startsAt, locale)}</td>
                      {podium.length > 0 ? (
                        podium.map((driver) => (
                          <td key={driver.position} className="border-b border-[#efefec] px-2 py-2" title={`${driver.givenName} ${driver.familyName}`}>
                            <span className="flex items-center gap-1.5">
                              <span className="h-4 w-[3px] rounded-sm" style={{ backgroundColor: constructorColor(driver.constructorName) }} />
                              <span className="font-display text-[13px] font-bold">{driver.code}</span>
                              <span className="text-[11px] text-muted">{driver.constructorName}</span>
                            </span>
                          </td>
                        ))
                      ) : (
                        <td colSpan={3} className="border-b border-[#efefec] px-2 py-2 text-muted">
                          —
                        </td>
                      )}
                      <td className="border-b border-[#efefec] px-2 py-2 text-right text-muted">{race.laps ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value, foot }: { label: string; value: string | number; foot: string }) {
  return (
    <div className="rounded-md border border-line px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">{label}</div>
      <div className="mt-0.5 font-display text-[22px] font-bold leading-tight">{value}</div>
      <div className="truncate text-[10px] text-muted">{foot}</div>
    </div>
  );
}
