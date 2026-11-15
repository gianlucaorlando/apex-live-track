"use client";

import { useEffect, useRef, useState } from "react";
import type { F1ApiResponse } from "@/types/f1";
import type { CarTelemetrySample, SessionInsights } from "@/types/f1Insights";

const INSIGHTS_LIVE_MS = 8000;
const INSIGHTS_REPLAY_MS = 10000;
const TELEMETRY_MS = 1200;

async function fetchData<T>(path: string, params: URLSearchParams, signal: AbortSignal): Promise<T | null> {
  try {
    const response = await fetch(`${path}?${params.toString()}`, { cache: "no-store", signal });
    if (!response.ok) return null;
    const payload = (await response.json()) as F1ApiResponse<T>;
    return payload.data ?? null;
  } catch {
    return null;
  }
}

/**
 * Dati OpenF1 aggiuntivi (radio, pit, settori, meteo pista, mondiale) in polling,
 * piu' la telemetria del pilota selezionato. `buildParams` arriva da useF1LiveData
 * cosi' sessione e cursore del replay restano allineati al resto della dashboard.
 */
export function useSessionInsights(
  sessionKey: number | null,
  isLive: boolean,
  buildParams: () => URLSearchParams,
  telemetryDriver: number | null,
): { insights: SessionInsights | null; telemetry: CarTelemetrySample[] } {
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [telemetry, setTelemetry] = useState<CarTelemetrySample[]>([]);
  // buildParams cambia identita' ad ogni render: lo si legge da ref.
  const buildParamsRef = useRef(buildParams);
  buildParamsRef.current = buildParams;

  useEffect(() => {
    setInsights(null);

    if (sessionKey === null) {
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      const data = await fetchData<SessionInsights>("/api/f1/insights", buildParamsRef.current(), controller.signal);
      if (data && !controller.signal.aborted) {
        setInsights(data);
      }
    };

    load();
    const timer = window.setInterval(load, isLive ? INSIGHTS_LIVE_MS : INSIGHTS_REPLAY_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [isLive, sessionKey]);

  useEffect(() => {
    setTelemetry([]);

    if (sessionKey === null || telemetryDriver === null) {
      return;
    }

    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      const params = buildParamsRef.current();
      params.set("driver_number", String(telemetryDriver));
      const data = await fetchData<CarTelemetrySample[]>("/api/f1/car-data", params, controller.signal);
      busy = false;
      if (data && !controller.signal.aborted) {
        setTelemetry(data);
      }
    };

    load();
    const timer = window.setInterval(load, TELEMETRY_MS);

    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [sessionKey, telemetryDriver]);

  return { insights, telemetry };
}
