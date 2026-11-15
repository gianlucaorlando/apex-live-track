"use client";

import { useEffect, useState } from "react";
import { Gauge, Newspaper, Thermometer, Timer, Trophy, Wrench } from "lucide-react";
import { MotorsportNews } from "@/components/MotorsportNews";
import { t, type Locale } from "@/lib/i18n";
import type { LiveStandingRow } from "@/types/f1";
import type { SessionInsights } from "@/types/f1Insights";

interface SessionDataPanelProps {
  insights: SessionInsights | null;
  standings: LiveStandingRow[];
  locale: Locale;
  onSelectDriver: (driverNumber: number) => void;
}

type PanelTab = "timing" | "pit" | "championship" | "weather" | "news";

const STORAGE_KEY = "f1-live-track-data-tab";

export function formatLapTime(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds - minutes * 60;
  return minutes > 0 ? `${minutes}:${rest.toFixed(3).padStart(6, "0")}` : rest.toFixed(3);
}

function DriverChip({ row, fallback }: { row: LiveStandingRow | undefined; fallback: number }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="h-3 w-1 flex-none rounded-sm" style={{ backgroundColor: row?.teamColour ?? "#737373" }} />
      <span className="truncate text-xs font-black text-ink">{row?.acronym ?? `#${fallback}`}</span>
    </span>
  );
}

export function SessionDataPanel({ insights, standings, locale, onSelectDriver }: SessionDataPanelProps) {
  const [tab, setTab] = useState<PanelTab>("timing");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) as PanelTab | null;
      if (stored) setTab(stored);
    } catch {
      // storage non disponibile
    }
  }, []);
  const byNumber = new Map(standings.map((row) => [row.driverNumber, row]));

  const tabs: { id: PanelTab; label: string; icon: typeof Timer }[] = [
    { id: "timing", label: t(locale, "dataTabTiming"), icon: Timer },
    { id: "pit", label: t(locale, "dataTabPit"), icon: Wrench },
    { id: "championship", label: t(locale, "dataTabChampionship"), icon: Trophy },
    { id: "weather", label: t(locale, "dataTabWeather"), icon: Thermometer },
    { id: "news", label: t(locale, "dataTabNews"), icon: Newspaper },
  ];

  const selectTab = (next: PanelTab) => {
    setTab(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage non disponibile: la scelta vale solo per questa visita
    }
  };

  return (
    <section className="panel flex h-full min-h-0 flex-col overflow-hidden rounded-md">
      <div className="flex flex-none items-center gap-0.5 overflow-x-auto border-b border-line px-2.5" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => selectTab(id)}
            className={`-mb-px flex flex-none items-center gap-1.5 border-b-2 px-3 py-2.5 font-display text-xs font-bold uppercase tracking-[0.05em] transition ${
              tab === id ? "border-f1red text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "news" ? (
          <MotorsportNews locale={locale} embedded />
        ) : !insights ? (
          <Empty text={t(locale, "dataLoading")} />
        ) : tab === "timing" ? (
          <div className="grid gap-3 p-3 md:grid-cols-2">
            <div className="rounded-md border border-line border-l-[3px] border-l-timing-purple bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
                <Timer className="h-3.5 w-3.5" /> {t(locale, "fastestLap")}
              </div>
              {insights.fastestLap ? (
                <button type="button" onClick={() => onSelectDriver(insights.fastestLap!.driverNumber)} className="mt-2 flex w-full items-end justify-between text-left">
                  <DriverChip row={byNumber.get(insights.fastestLap.driverNumber)} fallback={insights.fastestLap.driverNumber} />
                  <span className="font-display text-2xl font-bold text-timing-purple">
                    {formatLapTime(insights.fastestLap.duration)}
                  </span>
                </button>
              ) : (
                <div className="mt-2 text-xs text-muted">—</div>
              )}
              {insights.fastestLap ? (
                <div className="mt-1 text-right text-[10px] font-semibold text-muted">
                  {t(locale, "lapShort")}
                  {insights.fastestLap.lapNumber}
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {insights.bestSectors.map((sector, index) => (
                  <div key={index} className="rounded-md border border-line px-2 py-1.5">
                    <div className="text-[9px] font-semibold uppercase text-muted">S{index + 1}</div>
                    {sector ? (
                      <>
                        <div className="text-xs font-bold tabular-nums text-ink">{sector.duration.toFixed(3)}</div>
                        <div className="text-[10px] font-black text-muted">
                          {byNumber.get(sector.driverNumber)?.acronym ?? `#${sector.driverNumber}`}
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-muted">—</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-md border border-line bg-white p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted">
                <Gauge className="h-3.5 w-3.5" /> {t(locale, "speedTrap")}
              </div>
              <div className="mt-2 flex flex-col gap-1">
                {insights.speedTrap.length === 0 ? <div className="text-xs text-muted">—</div> : null}
                {insights.speedTrap.map((entry, index) => {
                  const max = insights.speedTrap[0].speed;
                  const min = insights.speedTrap.at(-1)!.speed - 5;
                  const row = byNumber.get(entry.driverNumber);
                  return (
                    <button key={entry.driverNumber} type="button" onClick={() => onSelectDriver(entry.driverNumber)} className="grid grid-cols-[1rem_3.2rem_1fr_3rem] items-center gap-2 text-left">
                      <span className="text-[10px] text-muted">{index + 1}</span>
                      <DriverChip row={row} fallback={entry.driverNumber} />
                      <span className="h-1.5 overflow-hidden rounded-full bg-soft">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${((entry.speed - min) / Math.max(max - min, 1)) * 100}%`, backgroundColor: row?.teamColour ?? "#22d3ee" }}
                        />
                      </span>
                      <span className="text-right text-xs font-bold tabular-nums text-ink">{entry.speed}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : tab === "pit" ? (
          insights.pitStops.length === 0 ? (
            <Empty text={t(locale, "pitEmpty")} />
          ) : (
            <div className="grid gap-3 p-3 md:grid-cols-[1fr_1fr]">
              <PitList title={t(locale, "pitFastest")} stops={[...insights.pitStops].filter((stop) => stop.stopDuration !== null).sort((a, b) => a.stopDuration! - b.stopDuration!).slice(0, 8)} byNumber={byNumber} highlightFirst locale={locale} onSelectDriver={onSelectDriver} />
              <PitList title={t(locale, "pitLatest")} stops={insights.pitStops.slice(0, 8)} byNumber={byNumber} locale={locale} onSelectDriver={onSelectDriver} />
            </div>
          )
        ) : tab === "championship" ? (
          insights.championshipDrivers.length === 0 ? (
            <Empty text={t(locale, "championshipEmpty")} />
          ) : (
            <div className="grid gap-3 p-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                {insights.championshipDrivers.slice(0, 10).map((row) => {
                  const delta = (row.positionStart ?? 0) - (row.positionCurrent ?? 0);
                  return (
                    <button key={row.driverNumber} type="button" onClick={() => onSelectDriver(row.driverNumber)} className="grid grid-cols-[1.4rem_1fr_auto_3.5rem] items-center gap-2 rounded-md bg-soft px-2 py-1 text-left hover:bg-soft">
                      <span className="text-sm font-black text-ink">{row.positionCurrent}</span>
                      <DriverChip row={byNumber.get(row.driverNumber)} fallback={row.driverNumber} />
                      <Delta delta={delta} />
                      <span className="text-right text-xs font-bold tabular-nums text-ink">
                        {row.pointsCurrent}
                        {row.pointsCurrent > row.pointsStart ? (
                          <span className="ml-1 text-[9px] text-emerald-600">+{row.pointsCurrent - row.pointsStart}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-1">
                {insights.championshipTeams.map((row) => (
                  <div key={row.teamName} className="grid grid-cols-[1.4rem_1fr_auto_3.5rem] items-center gap-2 rounded-md bg-soft px-2 py-1">
                    <span className="text-sm font-black text-ink">{row.positionCurrent}</span>
                    <span className="truncate text-xs font-bold text-ink">{row.teamName}</span>
                    <Delta delta={(row.positionStart ?? 0) - (row.positionCurrent ?? 0)} />
                    <span className="text-right text-xs font-bold tabular-nums text-ink">{row.pointsCurrent}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : insights.weather ? (
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label={t(locale, "trackTemp")} value={insights.weather.trackTemperature} unit="°C" accent="#f97316" />
            <Stat label={t(locale, "airTemp")} value={insights.weather.airTemperature} unit="°C" accent="#22d3ee" />
            <Stat label={t(locale, "humidity")} value={insights.weather.humidity} unit="%" accent="#a78bfa" />
            <Stat label={t(locale, "wind")} value={insights.weather.windSpeed} unit="m/s" accent="#e5e7eb">
              {insights.weather.windDirection !== null ? (
                <span className="ml-1 inline-block text-base" style={{ transform: `rotate(${insights.weather.windDirection + 180}deg)` }}>↑</span>
              ) : null}
            </Stat>
            <div className="col-span-2 flex items-center justify-center rounded-md border border-line bg-white p-3">
              <span className={`text-sm font-black uppercase tracking-wider ${insights.weather.rainfall ? "text-sky-600" : "text-ink"}`}>
                {insights.weather.rainfall ? t(locale, "rainYes") : t(locale, "rainNo")}
              </span>
            </div>
          </div>
        ) : (
          <Empty text={t(locale, "dataLoading")} />
        )}
      </div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="grid h-full min-h-24 place-items-center px-6 text-center text-xs text-muted">{text}</div>;
}

function Delta({ delta }: { delta: number }) {
  if (delta === 0) return <span className="w-6 text-center text-[10px] text-muted">–</span>;
  return (
    <span className={`w-6 text-center text-[10px] font-black ${delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
      {delta > 0 ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

function Stat({ label, value, unit, accent, children }: { label: string; value: number | null; unit: string; accent: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-white p-3" style={{ borderTop: `2px solid ${accent}` }}>
      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="mt-1 flex items-baseline text-xl font-black tabular-nums text-ink">
        {value === null ? "—" : Math.round(value * 10) / 10}
        <span className="ml-1 text-[10px] font-bold text-muted">{unit}</span>
        {children}
      </div>
    </div>
  );
}

function PitList({
  title,
  stops,
  byNumber,
  highlightFirst,
  locale,
  onSelectDriver,
}: {
  title: string;
  stops: SessionInsights["pitStops"];
  byNumber: Map<number, LiveStandingRow>;
  highlightFirst?: boolean;
  locale: Locale;
  onSelectDriver: (driverNumber: number) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-muted">{title}</div>
      <div className="flex flex-col gap-1">
        {stops.map((stop, index) => (
          <button
            key={`${stop.driverNumber}-${stop.date}`}
            type="button"
            onClick={() => onSelectDriver(stop.driverNumber)}
            className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-md px-2 py-1 text-left ${
              highlightFirst && index === 0 ? "bg-fuchsia-600/20 ring-1 ring-fuchsia-400/50" : "bg-soft hover:bg-soft"
            }`}
          >
            <DriverChip row={byNumber.get(stop.driverNumber)} fallback={stop.driverNumber} />
            <span className="text-[10px] text-muted">
              {stop.lapNumber !== null ? `${t(locale, "lapShort")}${stop.lapNumber}` : ""}
            </span>
            <span className="text-xs font-bold tabular-nums text-ink">
              {stop.stopDuration !== null ? `${stop.stopDuration.toFixed(1)}s` : "—"}
              {stop.laneDuration !== null ? <span className="ml-1.5 text-[10px] text-muted">{stop.laneDuration.toFixed(1)}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
