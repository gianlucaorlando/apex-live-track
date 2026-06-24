"use client";

import { ListOrdered } from "lucide-react";
import { driverStatus, t, tyreCompound, type Locale } from "@/lib/i18n";
import { tyreCompoundColor, tyreCompoundShort } from "@/lib/tyres";
import type { LiveStandingRow } from "@/types/f1";

interface LiveStandingsProps {
  rows: LiveStandingRow[];
  hoveredDriver: number | null;
  selectedDriverNumber: number | null;
  locale: Locale;
  onHoverDriver: (driverNumber: number | null) => void;
  onSelectDriver: (driverNumber: number | null) => void;
}

export function LiveStandings({
  rows,
  hoveredDriver,
  selectedDriverNumber,
  locale,
  onHoverDriver,
  onSelectDriver,
}: LiveStandingsProps) {
  return (
    <aside className="flex h-full min-h-0 flex-col rounded-lg border border-white/10 bg-neutral-950/74 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-red-300" aria-hidden="true" />
          <h2 className="text-sm font-black uppercase tracking-[0.16em] text-white">
            {t(locale, "standings")}
          </h2>
        </div>
        <span className="rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-neutral-300">
          {rows.length || 0}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="grid h-full min-h-0 place-items-center px-6 text-center text-sm text-neutral-400">
            {t(locale, "standingsEmpty")}
          </div>
        ) : (
          <div className="divide-y divide-white/5" role="list">
            {rows.map((row) => {
              const selected = selectedDriverNumber === row.driverNumber;
              const active = hoveredDriver === row.driverNumber || selected;
              const tyreColor = tyreCompoundColor(row.tyre?.compound);

              return (
                <button
                  key={row.driverNumber}
                  type="button"
                  role="listitem"
                  title={t(locale, "openDriverProfile", { name: row.fullName })}
                  aria-pressed={selected}
                  onClick={() =>
                    onSelectDriver(selected ? null : row.driverNumber)
                  }
                  onMouseEnter={() => onHoverDriver(row.driverNumber)}
                  onMouseLeave={() => onHoverDriver(null)}
                  className={`grid w-full cursor-pointer grid-cols-[3.3rem_minmax(0,1fr)_4.5rem] gap-3 border-l-4 px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-white/35 ${
                    active
                      ? "bg-white/[0.12] text-white"
                      : "bg-transparent text-neutral-200 hover:bg-white/[0.07]"
                  }`}
                  style={{ borderLeftColor: row.teamColour }}
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-neutral-500">
                      {row.position ? `P${row.position}` : "P\u2014"}
                    </span>
                    <span className="text-sm font-black text-white">{row.acronym}</span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 flex-none rounded-full"
                        style={{ backgroundColor: row.teamColour }}
                      />
                      <span className="truncate text-sm font-semibold text-white">
                        {row.teamName}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
                      <span>#{row.driverNumber}</span>
                      {row.status ? (
                        <span className="rounded bg-amber-300/15 px-1.5 py-0.5 font-bold text-amber-100">
                          {driverStatus(locale, row.status)}
                        </span>
                      ) : null}
                      {row.tyre ? (
                        <span
                          className="inline-flex items-center gap-1 rounded bg-white/8 px-1.5 py-0.5 font-bold text-white"
                          title={`${t(locale, "tyre")}: ${tyreCompound(
                            locale,
                            row.tyre.compound,
                          )}`}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: tyreColor }}
                          />
                          {tyreCompoundShort(row.tyre.compound)}
                          {row.tyre.ageLaps !== null ? ` · ${row.tyre.ageLaps}g` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="text-right text-xs">
                    <div className="font-bold text-white">{row.gap}</div>
                    <div className="mt-1 text-neutral-400">{row.interval}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
