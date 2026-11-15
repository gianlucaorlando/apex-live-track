"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { t, type Locale } from "@/lib/i18n";
import type { LiveStandingRow } from "@/types/f1";

export type GapHistory = Map<number, Map<number, number>>;

interface GapHistoryChartProps {
  history: GapHistory;
  /** Cambia quando `history` (mutata in place) riceve nuovi dati. */
  version: number;
  standings: LiveStandingRow[];
  hoveredDriver: number | null;
  selectedDriverNumber: number | null;
  locale: Locale;
}

// Larghezza in pixel di ogni giro: con tanti giri il grafico scorre in orizzontale.
const PX_PER_LAP = 28;
const AXIS_WIDTH = 40;
const PAD_RIGHT = 16;
const PAD_TOP = 8;
const PAD_BOTTOM = 18;
const MAX_LINES = 10;
const Y_TICKS = [0, 0.1, 0.4, 1];

/**
 * Andamento del distacco dal leader giro per giro, scorrevole in orizzontale.
 * Il leader sta in alto: una linea che sale e' un pilota che recupera.
 */
export function GapHistoryChart({
  history,
  version,
  standings,
  hoveredDriver,
  selectedDriverNumber,
  locale,
}: GapHistoryChartProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickToEndRef = useRef(true);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setSize({ width: node.clientWidth, height: node.clientHeight });
    });
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  const focus = hoveredDriver ?? selectedDriverNumber;
  const drivers = standings
    .filter((row) => row.position !== null && history.has(row.driverNumber))
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .filter((row, index) => index < MAX_LINES || row.driverNumber === focus);

  const laps = new Set<number>();
  let maxGap = 1;
  for (const row of drivers) {
    for (const [lap, gap] of history.get(row.driverNumber)!) {
      laps.add(lap);
      maxGap = Math.max(maxGap, gap);
    }
  }

  const sortedLaps = [...laps].sort((a, b) => a - b);
  const firstLap = sortedLaps[0] ?? 0;
  const lastLap = sortedLaps.at(-1) ?? 0;
  const plotWidth = Math.max(
    (lastLap - firstLap) * PX_PER_LAP,
    size.width - AXIS_WIDTH - PAD_RIGHT,
  );
  const svgWidth = AXIS_WIDTH + plotWidth + PAD_RIGHT;
  const height = Math.max(size.height, 60);

  // Resta agganciato all'ultimo giro finche' l'utente non scorre indietro.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node && stickToEndRef.current) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [svgWidth, version]);

  const xOf = (lap: number) =>
    AXIS_WIDTH + ((lap - firstLap) / Math.max(lastLap - firstLap, 1)) * plotWidth;
  // Scala a radice quadrata (come la corsia): allarga la zona dei distacchi piccoli.
  const yOf = (gap: number) =>
    PAD_TOP + Math.sqrt(Math.max(gap, 0) / maxGap) * (height - PAD_TOP - PAD_BOTTOM);
  const lapLabelEvery = Math.max(1, Math.ceil(40 / PX_PER_LAP));

  return (
    <div className="relative h-full">
      <div
        ref={scrollRef}
        className="h-full overflow-x-auto overflow-y-hidden [scrollbar-color:rgba(217,70,239,0.4)_transparent] [scrollbar-width:thin]"
        onScroll={(event) => {
          const node = event.currentTarget;
          stickToEndRef.current = node.scrollLeft + node.clientWidth >= node.scrollWidth - 8;
        }}
      >
        {sortedLaps.length < 2 ? (
          <div className="flex h-full items-center justify-center text-[11px] font-semibold text-muted">
            {t(locale, "gapChartEmpty")}
          </div>
        ) : (
          <svg width={svgWidth} height={height} className="block">
            {Y_TICKS.map((fraction) => (
              <line
                key={fraction}
                x1={AXIS_WIDTH}
                x2={svgWidth - PAD_RIGHT}
                y1={yOf(maxGap * fraction)}
                y2={yOf(maxGap * fraction)}
                stroke="#e4e4e0"
                strokeOpacity="0.18"
              />
            ))}
            {sortedLaps
              .filter((lap) => (lap - firstLap) % lapLabelEvery === 0 || lap === lastLap)
              .map((lap) => (
                <text
                  key={lap}
                  x={xOf(lap)}
                  y={height - 4}
                  textAnchor="middle"
                  className="fill-muted text-[9px]"
                >
                  {lap}
                </text>
              ))}
            {drivers.map((row) => {
              const points = [...history.get(row.driverNumber)!]
                .sort(([a], [b]) => a - b)
                .map(([lap, gap]) => `${xOf(lap).toFixed(1)},${yOf(gap).toFixed(1)}`)
                .join(" ");
              const highlighted = focus === row.driverNumber;

              return (
                <polyline
                  key={row.driverNumber}
                  points={points}
                  fill="none"
                  stroke={row.teamColour}
                  strokeWidth={highlighted ? 3 : 1.4}
                  strokeOpacity={focus === null || highlighted ? 0.95 : 0.25}
                  strokeLinejoin="round"
                  
                >
                  <title>{row.acronym}</title>
                </polyline>
              );
            })}
          </svg>
        )}
      </div>

      {/* Asse Y fisso: resta visibile mentre il grafico scorre */}
      {sortedLaps.length >= 2 ? (
        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-gradient-to-r from-white via-white/90 to-transparent"
          style={{ width: AXIS_WIDTH }}
        >
          {Y_TICKS.map((fraction) => (
            <span
              key={fraction}
              className="absolute right-1.5 -translate-y-1/2 text-[9px] text-muted"
              style={{ top: yOf(maxGap * fraction) }}
            >
              {fraction === 0 ? "0s" : `+${Math.round(maxGap * fraction)}s`}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
