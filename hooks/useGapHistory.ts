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
  seed: Record<number, Record<number, number>> | null = null,
): { history: GapHistory; version: number } {
  const historyRef = useRef<GapHistory>(new Map());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    historyRef.current = new Map();
    setVersion((value) => value + 1);
  }, [sessionKey]);

  // Storico ricostruito dal server (giri gia' corsi): riempie i giri mancanti,
  // senza sovrascrivere i valori raccolti dal vivo.
  useEffect(() => {
    if (!seed) return;
    let changed = false;

    for (const [driver, laps] of Object.entries(seed)) {
      const driverNumber = Number(driver);
      let history = historyRef.current.get(driverNumber);
      if (!history) {
        history = new Map();
        historyRef.current.set(driverNumber, history);
      }
      for (const [lap, gap] of Object.entries(laps)) {
        if (!history.has(Number(lap))) {
          history.set(Number(lap), gap);
          changed = true;
        }
      }
    }

    if (changed) {
      setVersion((value) => value + 1);
    }
  }, [seed]);

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
