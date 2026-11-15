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
  purple: "#7a3fd1",
  green: "#1f9d55",
  yellow: "#c79a00",
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
    <aside className="panel flex h-full min-h-0 flex-col overflow-hidden rounded-md">
      <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-muted" aria-hidden="true" />
          <h2 className="panel-title text-[13px] font-bold uppercase tracking-[0.08em]">
            {t(locale, "standings")}
          </h2>
        </div>
        <span className="text-[11px] text-muted">
          {t(locale, "driversCount", { count: rows.length || 0 })}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-muted">
            {t(locale, "standingsEmpty")}
          </div>
        ) : (
          <div role="list" className="text-xs">
            <div className="sticky top-0 z-10 grid grid-cols-[1.75rem_minmax(0,1fr)_3rem_6.5rem_4.25rem] items-center gap-2 border-b border-line bg-soft px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
              <span />
              <span>{t(locale, "driverColumn")}</span>
              <span>{t(locale, "tyre")}</span>
              <span className="text-right">{t(locale, "lastLapColumn")}</span>
              <span className="text-right">{t(locale, "gapColumn")}</span>
            </div>
            {rows.map((row) => {
              const selected = selectedDriverNumber === row.driverNumber;
              const active = hoveredDriver === row.driverNumber || selected;
              const tyreColor = tyreCompoundColor(row.tyre?.compound);
              const change = changes.get(row.driverNumber);
              const gridPosition = insights?.startingGrid[row.driverNumber];
              const gridDelta =
                gridPosition !== undefined && row.position !== null ? gridPosition - row.position : null;
              const lapInfo = insights?.lapsByDriver[row.driverNumber];
              const hasFastestLap = insights?.fastestLap?.driverNumber === row.driverNumber;
              // Posizioni recenti (lampo) hanno priorita' sul confronto con la griglia.
              const delta = change ? change.delta : gridDelta;

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
                  className={`grid w-full cursor-pointer grid-cols-[1.75rem_minmax(0,1fr)_3rem_6.5rem_4.25rem] items-center gap-2 border-b border-[#efefec] px-2 py-1.5 text-left transition focus:outline-none focus-visible:bg-soft ${
                    active ? "bg-soft" : "hover:bg-soft"
                  } ${change ? (change.delta > 0 ? "animate-position-gain" : "animate-position-loss") : ""}`}
                >
                  <span className="text-center font-display text-sm font-bold">{row.position ?? "\u2014"}</span>

                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="h-4 w-[3px] flex-none rounded-sm" style={{ backgroundColor: row.teamColour }} />
                    <span className="font-display text-[13px] font-bold tracking-[0.03em]">{row.acronym}</span>
                    {delta ? (
                      <span
                        className={`flex items-center text-[10px] font-bold ${delta > 0 ? "text-timing-green" : "text-red-700"}`}
                        title={gridDelta !== null && !change ? t(locale, "vsGrid", { position: gridPosition ?? "-" }) : undefined}
                      >
                        {delta > 0 ? <ChevronUp className="h-3 w-3" aria-hidden="true" /> : <ChevronDown className="h-3 w-3" aria-hidden="true" />}
                        {Math.abs(delta)}
                      </span>
                    ) : null}
                    {hasFastestLap ? (
                      <span className="flex items-center gap-0.5 rounded-sm bg-timing-purple px-1 text-[9px] font-bold text-white" title={t(locale, "fastestLap")}>
                        <Timer className="h-2.5 w-2.5" aria-hidden="true" />
                      </span>
                    ) : null}
                    {row.status ? (
                      <span className="rounded-sm bg-amber-100 px-1 text-[9px] font-bold uppercase text-amber-900">
                        {driverStatus(locale, row.status)}
                      </span>
                    ) : null}
                    <span className="truncate text-[11px] text-muted">{row.teamName}</span>
                  </span>

                  <span className="flex items-center gap-1" title={row.tyre ? `${t(locale, "tyre")}: ${tyreCompound(locale, row.tyre.compound)}` : undefined}>
                    {row.tyre ? (
                      <>
                        <span className="grid h-[17px] w-[17px] place-items-center rounded-full border-2 text-[9px] font-bold" style={{ borderColor: tyreColor }}>
                          {tyreCompoundShort(row.tyre.compound)}
                        </span>
                        <span className="text-[11px] text-muted">{row.tyre.ageLaps ?? ""}</span>
                      </>
                    ) : null}
                  </span>

                  <span className="flex items-center justify-end gap-1">
                    {lapInfo ? (
                      <>
                        {lapInfo.sectorColours.map((colour, sectorIndex) => (
                          <span
                            key={sectorIndex}
                            className="h-1 w-2.5 rounded-full"
                            style={{ backgroundColor: colour ? TIMING_COLOURS[colour] : "#e4e4e0" }}
                          />
                        ))}
                        <span className="font-semibold" style={{ color: lapInfo.lapColour ? TIMING_COLOURS[lapInfo.lapColour] : undefined }}>
                          {formatLapTime(lapInfo.lapDuration)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">\u2014</span>
                    )}
                  </span>

                  <span className="text-right">
                    <span className="block font-medium">{row.position === 1 ? t(locale, "leaderLabel") : row.gap}</span>
                    {row.position !== 1 ? <span className="block text-[10px] text-muted">{row.interval}</span> : null}
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
