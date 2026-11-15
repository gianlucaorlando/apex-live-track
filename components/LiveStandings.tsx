"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, ListOrdered, Timer } from "lucide-react";
import { formatLapTime } from "@/components/SessionDataPanel";
import { driverStatus, t, tyreCompound, type Locale } from "@/lib/i18n";
import { tyreCompoundColor, tyreCompoundShort } from "@/lib/tyres";
import type { LiveStandingRow } from "@/types/f1";
import type { SectorColour, SessionInsights } from "@/types/f1Insights";

interface LiveStandingsProps {
  rows: LiveStandingRow[];
  hoveredDriver: number | null;
  selectedDriverNumber: number | null;
  locale: Locale;
  onHoverDriver: (driverNumber: number | null) => void;
  onSelectDriver: (driverNumber: number | null) => void;
  insights: SessionInsights | null;
}

// Colori timing ufficiali F1.
const TIMING_COLOURS: Record<SectorColour, string> = {
  purple: "#c026d3",
  green: "#22c55e",
  yellow: "#facc15",
};

// Colori podio per il numero di posizione.
const PODIUM_COLOURS: Record<number, string> = {
  1: "#facc15",
  2: "#e5e7eb",
  3: "#f59e0b",
};

// Per quanto resta visibile l'indicatore di posizioni guadagnate/perse.
const POSITION_CHANGE_MS = 8000;

export function LiveStandings({
  rows,
  hoveredDriver,
  selectedDriverNumber,
  locale,
  onHoverDriver,
  onSelectDriver,
  insights,
}: LiveStandingsProps) {
  // Variazione di posizione recente per pilota (+ = guadagnate), con scadenza.
  const previousPositionsRef = useRef<Map<number, number> | null>(null);
  const [changes, setChanges] = useState<Map<number, { delta: number; at: number }>>(new Map());

  useEffect(() => {
    const positions = new Map<number, number>();
    for (const row of rows) {
      if (row.position !== null) {
        positions.set(row.driverNumber, row.position);
      }
    }

    const previous = previousPositionsRef.current;
    previousPositionsRef.current = positions;

    if (!previous) {
      return;
    }

    const now = Date.now();
    setChanges((current) => {
      const next = new Map(
        [...current].filter(([, change]) => now - change.at < POSITION_CHANGE_MS),
      );

      for (const [driverNumber, position] of positions) {
        const before = previous.get(driverNumber);
        if (before !== undefined && before !== position) {
          next.set(driverNumber, { delta: before - position, at: now });
        }
      }

      return next;
    });
  }, [rows]);

  useEffect(() => {
    if (changes.size === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const now = Date.now();
      setChanges(
        (current) =>
          new Map([...current].filter(([, change]) => now - change.at < POSITION_CHANGE_MS)),
      );
    }, POSITION_CHANGE_MS);

    return () => window.clearTimeout(timer);
  }, [changes]);

  return (
    <aside className="panel-neon flex h-full min-h-0 flex-col overflow-hidden rounded-xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-cyan-300" aria-hidden="true" />
          <h2 className="panel-neon-title text-sm font-black uppercase italic tracking-[0.18em]">
            {t(locale, "standings")}
          </h2>
        </div>
        <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-0.5 font-mono text-xs font-bold text-fuchsia-100">
          {rows.length || 0}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {rows.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-neutral-400">
            {t(locale, "standingsEmpty")}
          </div>
        ) : (
          <div className="flex flex-col gap-1" role="list">
            {rows.map((row, index) => {
              const selected = selectedDriverNumber === row.driverNumber;
              const active = hoveredDriver === row.driverNumber || selected;
              const tyreColor = tyreCompoundColor(row.tyre?.compound);
              const change = changes.get(row.driverNumber);
              const podiumColour = row.position ? PODIUM_COLOURS[row.position] : undefined;
              const gridPosition = insights?.startingGrid[row.driverNumber];
              const gridDelta =
                gridPosition !== undefined && row.position !== null ? gridPosition - row.position : null;
              const lapInfo = insights?.lapsByDriver[row.driverNumber];
              const hasFastestLap = insights?.fastestLap?.driverNumber === row.driverNumber;

              return (
                <button
                  key={row.driverNumber}
                  type="button"
                  role="listitem"
                  title={t(locale, "openDriverProfile", { name: row.fullName })}
                  aria-pressed={selected}
                  onClick={() => onSelectDriver(selected ? null : row.driverNumber)}
                  onMouseEnter={() => onHoverDriver(row.driverNumber)}
                  onMouseLeave={() => onHoverDriver(null)}
                  className={`animate-row-in group relative grid w-full cursor-pointer grid-cols-[2.4rem_2.25rem_minmax(0,1fr)_auto] items-center gap-2.5 overflow-hidden rounded-lg py-1.5 pl-2 pr-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60 ${
                    active ? "bg-white/[0.10]" : "bg-white/[0.025] hover:bg-white/[0.06]"
                  } ${
                    change ? (change.delta > 0 ? "animate-position-gain" : "animate-position-loss") : ""
                  }`}
                  style={{
                    animationDelay: change ? undefined : `${Math.min(index, 20) * 25}ms`,
                    boxShadow: active ? `inset 3px 0 0 ${row.teamColour}, 0 0 20px -8px ${row.teamColour}` : `inset 3px 0 0 ${row.teamColour}`,
                  }}
                >
                  {/* Riflesso colore team */}
                  <span
                    className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-[0.14] transition-opacity group-hover:opacity-25"
                    style={{ background: `linear-gradient(90deg, ${row.teamColour}, transparent)` }}
                  />

                  <span
                    className="relative text-center text-xl font-black italic leading-none tabular-nums"
                    style={{
                      color: podiumColour ?? "rgba(255,255,255,0.85)",
                      textShadow: podiumColour ? `0 0 12px ${podiumColour}88` : undefined,
                    }}
                  >
                    {row.position ?? "—"}
                  </span>

                  <span
                    className="relative h-9 w-9 overflow-hidden rounded-full border-2 bg-neutral-900"
                    style={{ borderColor: row.teamColour }}
                  >
                    {row.headshotUrl ? (
                      <img
                        src={row.headshotUrl}
                        alt=""
                        className="h-full w-full object-cover object-top"
                        loading="lazy"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center text-[10px] font-black text-white/70">
                        {row.driverNumber}
                      </span>
                    )}
                  </span>

                  <span className="relative min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="text-sm font-black tracking-wide text-white">{row.acronym}</span>
                      {change ? (
                        <span
                          className={`flex items-center text-[10px] font-black ${
                            change.delta > 0 ? "text-emerald-300" : "text-red-300"
                          }`}
                        >
                          {change.delta > 0 ? (
                            <ChevronUp className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <ChevronDown className="h-3 w-3" aria-hidden="true" />
                          )}
                          {Math.abs(change.delta)}
                        </span>
                      ) : null}
                      {gridDelta !== null && gridDelta !== 0 && !change ? (
                        <span
                          className={`text-[9px] font-black ${gridDelta > 0 ? "text-emerald-300/80" : "text-red-300/80"}`}
                          title={t(locale, "vsGrid", { position: gridPosition ?? "-" })}
                        >
                          {gridDelta > 0 ? "▲" : "▼"}
                          {Math.abs(gridDelta)}
                        </span>
                      ) : null}
                      {hasFastestLap ? (
                        <span
                          className="flex items-center gap-0.5 rounded bg-fuchsia-600 px-1 text-[9px] font-black text-white shadow-[0_0_10px_rgba(192,38,211,0.7)]"
                          title={t(locale, "fastestLap")}
                        >
                          <Timer className="h-2.5 w-2.5" aria-hidden="true" />
                        </span>
                      ) : null}
                      {row.status ? (
                        <span className="rounded bg-amber-300/15 px-1.5 text-[9px] font-black uppercase text-amber-100">
                          {driverStatus(locale, row.status)}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] text-white/50">
                      <span className="truncate">{row.teamName}</span>
                      {row.tyre ? (
                        <span
                          className="inline-flex flex-none items-center gap-1 font-bold text-white/80"
                          title={`${t(locale, "tyre")}: ${tyreCompound(locale, row.tyre.compound)}`}
                        >
                          <span
                            className="grid h-3.5 w-3.5 place-items-center rounded-full border-2 text-[7px] font-black"
                            style={{ borderColor: tyreColor }}
                          >
                            {tyreCompoundShort(row.tyre.compound)}
                          </span>
                          {row.tyre.ageLaps !== null ? `${row.tyre.ageLaps}g` : ""}
                        </span>
                      ) : null}
                    </span>
                  </span>

                  <span className="relative text-right font-mono tabular-nums">
                    <span className="block text-xs font-bold text-white">
                      {row.position === 1 ? t(locale, "lapProgress") + " " + (row.currentLap ?? "-") : row.gap}
                    </span>
                    <span className="block text-[10px] text-cyan-200/60">
                      {row.position === 1 ? `/${row.totalLaps ?? "-"}` : row.interval}
                    </span>
                    {lapInfo ? (
                      <span className="mt-0.5 flex items-center justify-end gap-1">
                        {lapInfo.sectorColours.map((colour, sectorIndex) => (
                          <span
                            key={sectorIndex}
                            className="h-1 w-2.5 rounded-full"
                            style={{ backgroundColor: colour ? TIMING_COLOURS[colour] : "rgba(255,255,255,0.12)" }}
                          />
                        ))}
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: lapInfo.lapColour ? TIMING_COLOURS[lapInfo.lapColour] : "rgba(255,255,255,0.5)" }}
                        >
                          {formatLapTime(lapInfo.lapDuration)}
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
