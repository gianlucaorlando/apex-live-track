"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleAlert, Loader2, RefreshCcw } from "lucide-react";
import { ChampionsBanner } from "@/components/ChampionsBanner";
import { titleStatus } from "@/lib/f1Points";
import { apiMessage, intlLocale, t, type Locale } from "@/lib/i18n";
import type { F1CalendarApiResponse } from "@/types/calendar";
import type {
  SeasonDriverStanding,
  SeasonStandingsApiResponse,
  SeasonStandingsPayload,
} from "@/types/seasonStandings";

export function teamColor(name: string): string {
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
  if (normalized === "rb f1 team" || normalized.includes("racing bulls")) return "#6c98ff";

  return "#888888";
}

function driverName(driver: SeasonDriverStanding): string {
  return `${driver.givenName} ${driver.familyName.toLocaleUpperCase("it-IT")}`.trim();
}

function formatPoints(points: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(points);
}

function PointsBar({ value, max, colour, width }: { value: number; max: number; colour: string; width: string }) {
  return (
    <div className="h-[5px] rounded-full bg-[#efefec]" style={{ width }}>
      <div className="h-[5px] rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, backgroundColor: colour }} />
    </div>
  );
}

const CELL = "border-b border-[#efefec] px-2 py-1.5";
const HEAD = "border-b border-line px-2 py-1.5 font-semibold";

interface PodiumStat {
  code: string;
  team: string;
  wins: number;
  podiums: number;
}

export function SeasonStandings({ locale }: { locale: Locale }) {
  const [standings, setStandings] = useState<SeasonStandingsPayload | null>(null);
  const [podiumStats, setPodiumStats] = useState<PodiumStat[]>([]);
  const [totalRounds, setTotalRounds] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStandings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ lang: locale });
      const response = await fetch(`/api/f1/season-standings?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as SeasonStandingsApiResponse | null;

      if (!response.ok || !payload?.data) {
        throw new Error(payload?.meta.messages[0] ?? t(locale, "seasonStandingsNotAvailable"));
      }

      setStandings(payload.data);
      if (payload.meta.partial && payload.meta.messages[0]) {
        setError(apiMessage(locale, payload.meta.messages[0]));
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error ? apiMessage(locale, loadError.message) : t(locale, "seasonStandingsNotAvailable"),
      );
    } finally {
      setLoading(false);
    }

    // Vittorie e podi dai risultati del calendario (facoltativi: se mancano il pannello sparisce).
    try {
      const response = await fetch(`/api/f1/calendar?lang=${locale}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as F1CalendarApiResponse | null;
      const races = payload?.data?.races ?? [];
      const stats = new Map<string, PodiumStat>();

      for (const race of races) {
        for (const driver of race.podium) {
          const entry = stats.get(driver.code) ?? { code: driver.code, team: driver.constructorName, wins: 0, podiums: 0 };
          entry.podiums += 1;
          if (driver.position === 1) entry.wins += 1;
          stats.set(driver.code, entry);
        }
      }

      setTotalRounds(races.length || null);
      setPodiumStats([...stats.values()].sort((a, b) => b.wins - a.wins || b.podiums - a.podiums).slice(0, 6));
    } catch {
      setPodiumStats([]);
    }
  }, [locale]);

  useEffect(() => {
    loadStandings();
  }, [loadStandings]);

  const titlesDecided = useMemo(() => {
    if (!standings) return false;
    const [first, second] = standings.drivers;
    const [team, teamSecond] = standings.constructors;
    if (!first || !team) return false;
    const availability = standings.constructorPointsAvailable;
    return (
      titleStatus(first.points, second?.points ?? 0, availability, standings.round, "driver").decided &&
      titleStatus(team.points, teamSecond?.points ?? 0, availability, standings.round, "constructor").decided
    );
  }, [standings]);

  if (loading && !standings) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        <div className="text-center">
          <Loader2 className="mx-auto mb-3 h-7 w-7 animate-spin text-f1red" />
          {t(locale, "seasonStandingsLoading")}
        </div>
      </div>
    );
  }

  if (!standings) {
    return (
      <div className="grid h-full place-items-center text-center">
        <div className="max-w-md">
          <CircleAlert className="mx-auto mb-3 h-7 w-7 text-f1red" />
          <h3 className="text-sm font-bold">{t(locale, "seasonStandingsUnavailable")}</h3>
          <p className="mt-2 text-sm text-muted">{error}</p>
        </div>
      </div>
    );
  }

  const leaderPoints = standings.drivers[0]?.points ?? 0;
  const leaderTeamPoints = standings.constructors[0]?.points ?? 0;
  const maxPodiums = Math.max(...podiumStats.map((entry) => entry.podiums), 1);

  return (
    <section className="flex h-full min-h-0 flex-col gap-3" data-season-standings>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t(locale, "seasonTitle", { season: standings.season })}</h1>
          <div className="text-sm text-muted">
            {totalRounds
              ? t(locale, "afterRoundOf", { round: standings.round, total: totalRounds })
              : t(locale, "afterRound", { round: standings.round })}
            {titlesDecided ? ` · ${t(locale, "titlesDecided")}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={loadStandings}
          disabled={loading}
          title={t(locale, "seasonStandingsRefreshTitle")}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-line bg-white px-3 text-xs font-semibold transition hover:bg-soft disabled:cursor-wait disabled:opacity-60"
        >
          <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          {t(locale, "refresh")}
        </button>
      </div>

      {error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">{error}</div>
      ) : null}

      <ChampionsBanner standings={standings} locale={locale} teamColor={teamColor} />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="panel flex min-h-0 flex-col overflow-hidden rounded-md">
          <PanelHeader title={t(locale, "driverStandingsTitle")} meta={t(locale, "driversCount", { count: standings.drivers.length })} />
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-soft text-left text-[10px] uppercase tracking-[0.06em] text-muted">
                <tr>
                  <th className={HEAD} />
                  <th className={HEAD}>{t(locale, "driverColumn")}</th>
                  <th className={HEAD}>{t(locale, "teamColumn")}</th>
                  <th className={HEAD} />
                  <th className={`${HEAD} text-right`}>{t(locale, "winsColumn")}</th>
                  <th className={`${HEAD} text-right`}>{t(locale, "gapColumn")}</th>
                  <th className={`${HEAD} text-right`}>{t(locale, "pointsColumn")}</th>
                </tr>
              </thead>
              <tbody>
                {standings.drivers.map((row) => (
                  <tr key={row.driverId || row.code} className="hover:bg-soft">
                    <td className={`${CELL} w-7 text-center font-display text-[13px] font-bold`}>{row.position}</td>
                    <td className={CELL}>
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-[3px] rounded-sm" style={{ backgroundColor: teamColor(row.constructorName) }} />
                        {row.wikipediaUrl ? (
                          <a href={row.wikipediaUrl} target="_blank" rel="noreferrer" className="font-display text-[13px] font-bold hover:underline">
                            {driverName(row)}
                          </a>
                        ) : (
                          <span className="font-display text-[13px] font-bold">{driverName(row)}</span>
                        )}
                      </span>
                    </td>
                    <td className={`${CELL} text-[11px] text-muted`}>{row.constructorName}</td>
                    <td className={CELL}>
                      <PointsBar value={row.points} max={leaderPoints} colour={teamColor(row.constructorName)} width="10rem" />
                    </td>
                    <td className={`${CELL} text-right`}>{row.wins}</td>
                    <td className={`${CELL} text-right text-muted`}>
                      {row.position === 1 ? "—" : `-${formatPoints(leaderPoints - row.points, locale)}`}
                    </td>
                    <td className={`${CELL} text-right font-bold`}>{formatPoints(row.points, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex min-h-0 flex-col gap-4">
          <div className="panel flex min-h-0 flex-col overflow-hidden rounded-md">
            <PanelHeader title={t(locale, "constructorStandingsTitle")} meta={t(locale, "teamsCount", { count: standings.constructors.length })} />
            <div className="min-h-0 overflow-auto">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-soft text-left text-[10px] uppercase tracking-[0.06em] text-muted">
                  <tr>
                    <th className={HEAD} />
                    <th className={HEAD}>{t(locale, "teamColumn")}</th>
                    <th className={HEAD} />
                    <th className={`${HEAD} text-right`}>{t(locale, "winsColumn")}</th>
                    <th className={`${HEAD} text-right`}>{t(locale, "gapColumn")}</th>
                    <th className={`${HEAD} text-right`}>{t(locale, "pointsColumn")}</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.constructors.map((row) => (
                    <tr key={row.constructorId || row.name} className="hover:bg-soft">
                      <td className={`${CELL} w-7 text-center font-display text-[13px] font-bold`}>{row.position}</td>
                      <td className={CELL}>
                        <span className="flex items-center gap-2">
                          <span className="h-3.5 w-[3px] rounded-sm" style={{ backgroundColor: teamColor(row.name) }} />
                          <span className="font-display text-[13px] font-bold">{row.name}</span>
                        </span>
                      </td>
                      <td className={CELL}>
                        <PointsBar value={row.points} max={leaderTeamPoints} colour={teamColor(row.name)} width="9rem" />
                      </td>
                      <td className={`${CELL} text-right`}>{row.wins}</td>
                      <td className={`${CELL} text-right text-muted`}>
                        {row.position === 1 ? "—" : `-${formatPoints(leaderTeamPoints - row.points, locale)}`}
                      </td>
                      <td className={`${CELL} text-right font-bold`}>{formatPoints(row.points, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {podiumStats.length > 0 ? (
            <div className="panel rounded-md px-4 py-3">
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="text-[13px] font-bold uppercase tracking-[0.08em]">{t(locale, "winsPodiums")}</h2>
                <span className="text-[10px] text-muted">{t(locale, "winsPodiumsHint")}</span>
              </div>
              {podiumStats.map((entry) => (
                <div key={entry.code} className="grid grid-cols-[2.75rem_1fr_4.5rem] items-center gap-2.5 py-1">
                  <span className="font-display text-[13px] font-bold">{entry.code}</span>
                  <div className="flex h-3 overflow-hidden rounded-sm bg-[#efefec]">
                    <div style={{ width: `${(entry.wins / maxPodiums) * 100}%`, backgroundColor: teamColor(entry.team) }} />
                    <div
                      style={{ width: `${((entry.podiums - entry.wins) / maxPodiums) * 100}%`, backgroundColor: teamColor(entry.team), opacity: 0.35 }}
                    />
                  </div>
                  <span className="text-right text-[10px] text-muted">
                    {entry.wins} V · {entry.podiums} P
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function PanelHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.08em]">{title}</h2>
      <span className="text-[11px] text-muted">{meta}</span>
    </div>
  );
}
