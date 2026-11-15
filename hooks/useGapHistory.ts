"use client";

import { useEffect, useRef, useState } from "react";
import type { GapHistory } from "@/components/GapHistoryChart";
import type { LiveStandingRow } from "@/types/f1";

/**
 * Distacco dal leader per giro e pilota, accumulato lato client. Vive nella
 * Dashboard cosi' sopravvive ai cambi di vista (Distacchi / Grafico / Neon).
 * `version` cambia ad ogni nuovo dato per far ridisegnare chi lo legge.
 */
export function useGapHistory(
  standings: LiveStandingRow[],
  sessionKey: number | null,
): { history: GapHistory; version: number } {
  const historyRef = useRef<GapHistory>(new Map());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    historyRef.current = new Map();
    setVersion((value) => value + 1);
  }, [sessionKey]);

  useEffect(() => {
    let changed = false;

    for (const row of standings) {
      if (
        row.status === "OUT" ||
        row.lappedCount !== null ||
        row.currentLap === null ||
        row.gapSeconds === null
      ) {
        continue;
      }

      let laps = historyRef.current.get(row.driverNumber);
      if (!laps) {
        laps = new Map();
        historyRef.current.set(row.driverNumber, laps);
      }

      if (laps.get(row.currentLap) !== row.gapSeconds) {
        laps.set(row.currentLap, row.gapSeconds);
        changed = true;
      }
    }

    if (changed) {
      setVersion((value) => value + 1);
    }
  }, [standings]);

  return { history: historyRef.current, version };
}
