"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_REPLAY_OFFSET_SECONDS } from "@/lib/f1Constants";
import { apiMessage, t, type Locale } from "@/lib/i18n";
import { locationToTrackPoint } from "@/lib/track";
import type {
  F1ApiMeta,
  F1ApiResponse,
  F1Driver,
  FinishLinePoint,
  F1LocationPoint,
  F1Meeting,
  F1Session,
  LiveStandingRow,
  RaceControlMessage,
  StandingsPayload,
  TrackPoint,
} from "@/types/f1";

interface ApiErrorPayload {
  error?: {
    message?: string;
    rateLimited?: boolean;
  };
  meta?: F1ApiMeta;
}

class ClientApiError extends Error {
  status: number;
  rateLimited: boolean;
  meta: F1ApiMeta | null;

  constructor(message: string, status: number, rateLimited: boolean, meta?: F1ApiMeta) {
    super(message);
    this.name = "ClientApiError";
    this.status = status;
    this.rateLimited = rateLimited;
    this.meta = meta ?? null;
  }
}

export interface UseF1LiveDataResult {
  session: F1Session | null;
  meeting: F1Meeting | null;
  drivers: F1Driver[];
  standings: LiveStandingRow[];
  raceControlMessages: RaceControlMessage[];
  trackPoints: TrackPoint[];
  finishLine: FinishLinePoint | null;
  loading: boolean;
  error: string | null;
  isLive: boolean;
  rateLimited: boolean;
  tokenConfigured: boolean;
  partial: boolean;
  messages: string[];
  lastUpdated: string | null;
  motionTimeMs: number | null;
  refresh: () => void;
}

function replayMillisecondsFor(
  session: F1Session,
  demo: boolean,
  replayStartedAt: number,
): number {
  const elapsed = Date.now() - replayStartedAt;

  if (demo) {
    return DEMO_REPLAY_OFFSET_SECONDS * 1000 + (elapsed % 600000);
  }

  const start = new Date(session.dateStart).getTime();
  const end = new Date(session.dateEnd).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return DEMO_REPLAY_OFFSET_SECONDS * 1000 + (elapsed % 600000);
  }

  const duration = Math.max(Math.floor((end - start) / 1000), 300);
  const minimumOffset = Math.min(600, Math.max(0, duration - 180));
  const span = Math.max(duration - minimumOffset - 120, 60);

  return minimumOffset * 1000 + (elapsed % (span * 1000));
}

function replaySecondsFor(session: F1Session, demo: boolean, replayStartedAt: number): number {
  return Math.floor(replayMillisecondsFor(session, demo, replayStartedAt) / 1000);
}

function buildParams(
  demo: boolean,
  session: F1Session | null,
  replayStartedAt: number,
  locale: Locale,
  windowSeconds = 45,
) {
  const params = new URLSearchParams();
  params.set("lang", locale);

  if (demo) {
    params.set("demo", "true");
  }

  if (session) {
    params.set("session_key", String(session.sessionKey));
    params.set("window_seconds", String(windowSeconds));

    if (!session.isLive) {
      params.set("replay_seconds", String(replaySecondsFor(session, demo, replayStartedAt)));
    }
  }

  return params;
}

async function fetchApi<T>(
  path: string,
  params: URLSearchParams,
  signal?: AbortSignal,
): Promise<F1ApiResponse<T>> {
  const query = params.toString();
  const response = await fetch(`${path}${query ? `?${query}` : ""}`, {
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as
    | (F1ApiResponse<T> & ApiErrorPayload)
    | null;

  if (!response.ok) {
    throw new ClientApiError(
      payload?.error?.message ?? `Richiesta non riuscita: ${response.status}`,
      response.status,
      payload?.error?.rateLimited ?? response.status === 429,
      payload?.meta,
    );
  }

  if (!payload || !("data" in payload)) {
    throw new ClientApiError("Risposta API non valida", 502, false);
  }

  return payload;
}

function mergeMessages(
  previous: string[],
  meta: F1ApiMeta | undefined,
  locale: Locale,
): string[] {
  const next = new Set(previous);

  for (const message of meta?.messages ?? []) {
    next.add(apiMessage(locale, message));
  }

  return [...next].slice(-6);
}

function mergeTrackPoints(existing: TrackPoint[], incoming: F1LocationPoint[]): TrackPoint[] {
  if (incoming.length === 0) {
    return existing;
  }

  const byKey = new Map<string, TrackPoint>();
  const incomingTrackPoints = incoming.map(locationToTrackPoint);

  for (const point of [...existing, ...incomingTrackPoints]) {
    const key = `${point.driverNumber ?? "x"}-${point.date ?? "t"}-${point.x}-${point.y}`;
    byKey.set(key, point);
  }

  return [...byKey.values()]
    .sort((a, b) => {
      const aTime = a.date ? new Date(a.date).getTime() : 0;
      const bTime = b.date ? new Date(b.date).getTime() : 0;
      return aTime - bTime;
    })
    .slice(-18000);
}

export function useF1LiveData(demo: boolean, locale: Locale): UseF1LiveDataResult {
  const [session, setSession] = useState<F1Session | null>(null);
  const [meeting, setMeeting] = useState<F1Meeting | null>(null);
  const [drivers, setDrivers] = useState<F1Driver[]>([]);
  const [standings, setStandings] = useState<LiveStandingRow[]>([]);
  const [raceControlMessages, setRaceControlMessages] = useState<RaceControlMessage[]>([]);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [finishLine, setFinishLine] = useState<FinishLinePoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [partial, setPartial] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [motionTimeMs, setMotionTimeMs] = useState<number | null>(null);
  const [loadedDemo, setLoadedDemo] = useState<boolean | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const replayStartedAt = useRef(Date.now());

  const refresh = useCallback(() => {
    replayStartedAt.current = Date.now();
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    replayStartedAt.current = Date.now();
    setSession(null);
    setMeeting(null);
    setDrivers([]);
    setStandings([]);
    setTrackPoints([]);
    setRaceControlMessages([]);
    setFinishLine(null);
    setMotionTimeMs(null);
    setLastUpdated(null);
  }, [demo]);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;

    async function loadBase() {
      setLoading(true);
      setError(null);
      setRateLimited(false);
      setMessages([]);
      setPartial(false);
      setFinishLine(null);
      setRaceControlMessages([]);

      try {
        const params = buildParams(demo, null, replayStartedAt.current, locale);
        const sessionResponse = await fetchApi<F1Session>(
          "/api/f1/session",
          params,
          controller.signal,
        );
        const sessionParams = buildParams(
          demo,
          sessionResponse.data,
          replayStartedAt.current,
          locale,
        );
        const [meetingResponse, driverResponse] = await Promise.all([
          fetchApi<F1Meeting>("/api/f1/meeting", sessionParams, controller.signal),
          fetchApi<F1Driver[]>("/api/f1/drivers", sessionParams, controller.signal),
        ]);

        if (disposed) {
          return;
        }

        setSession(sessionResponse.data);
        setMeeting(meetingResponse.data);
        setDrivers(driverResponse.data);
        setLoadedDemo(demo);
        setTokenConfigured(sessionResponse.meta.tokenConfigured);
        setPartial(
          sessionResponse.meta.partial ||
            meetingResponse.meta.partial ||
            driverResponse.meta.partial,
        );
        setMessages((current) =>
          mergeMessages(
            mergeMessages(
              mergeMessages(current, sessionResponse.meta, locale),
              meetingResponse.meta,
              locale,
            ),
            driverResponse.meta,
            locale,
          ),
        );
      } catch (fetchError) {
        if (disposed || controller.signal.aborted) {
          return;
        }

        const clientError =
          fetchError instanceof ClientApiError
            ? fetchError
            : new ClientApiError(
                fetchError instanceof Error ? fetchError.message : "Impossibile caricare i dati F1",
                500,
                false,
              );

        setError(apiMessage(locale, clientError.message));
        setSession(null);
        setMeeting(null);
        setDrivers([]);
        setStandings([]);
        setTrackPoints([]);
        setLoadedDemo(demo);
        setRateLimited(clientError.rateLimited);
        setTokenConfigured(clientError.meta?.tokenConfigured ?? false);
        setPartial(true);
        setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
      } finally {
        if (!disposed) {
          setLoading(false);
        }
      }
    }

    loadBase();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [demo, locale, refreshNonce]);

  useEffect(() => {
    if (!session || loadedDemo !== demo) {
      setFinishLine(null);
      return;
    }

    const controller = new AbortController();
    let disposed = false;

    async function loadFinishLine() {
      try {
        const params = buildParams(demo, session, replayStartedAt.current, locale);
        const response = await fetchApi<FinishLinePoint | null>(
          "/api/f1/finish-line",
          params,
          controller.signal,
        );

        if (disposed) {
          return;
        }

        setFinishLine(response.data);
        setTokenConfigured(response.meta.tokenConfigured);
        setPartial((current) => current || response.meta.partial);
        setMessages((current) => mergeMessages(current, response.meta, locale));
      } catch (fetchError) {
        if (disposed || controller.signal.aborted) {
          return;
        }

        const clientError =
          fetchError instanceof ClientApiError
            ? fetchError
            : new ClientApiError(
                fetchError instanceof Error
                  ? fetchError.message
                  : t(locale, "trackUnavailable"),
                500,
                false,
              );

        setRateLimited((current) => current || clientError.rateLimited);
        setPartial(true);
        setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
      }
    }

    loadFinishLine();

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [demo, locale, loadedDemo, session, refreshNonce]);

  useEffect(() => {
    if (!session || loadedDemo !== demo) {
      setMotionTimeMs(null);
      return;
    }

    const activeSession = session;
    const motionLagMs = activeSession.isLive ? 3500 : 6000;

    function updateMotionTime() {
      if (activeSession.isLive) {
        setMotionTimeMs(Date.now() - motionLagMs);
        return;
      }

      const start = new Date(activeSession.dateStart).getTime();
      if (!Number.isFinite(start)) {
        setMotionTimeMs(null);
        return;
      }

      setMotionTimeMs(
        start + replayMillisecondsFor(activeSession, demo, replayStartedAt.current) - motionLagMs,
      );
    }

    updateMotionTime();
    const motionInterval = window.setInterval(updateMotionTime, 250);

    return () => {
      window.clearInterval(motionInterval);
    };
  }, [demo, loadedDemo, session]);

  useEffect(() => {
    if (!session || loadedDemo !== demo) {
      return;
    }

    const activeSession = session;
    let disposed = false;
    const controllers = new Set<AbortController>();

    async function withController<T>(task: (signal: AbortSignal) => Promise<T>) {
      const controller = new AbortController();
      controllers.add(controller);

      try {
        return await task(controller.signal);
      } finally {
        controllers.delete(controller);
      }
    }

    async function loadLocation(windowSeconds = 45) {
      await withController(async (signal) => {
        const params = buildParams(
          demo,
          activeSession,
          replayStartedAt.current,
          locale,
          windowSeconds,
        );
        const response = await fetchApi<F1LocationPoint[]>(
          "/api/f1/location",
          params,
          signal,
        );

        if (disposed) {
          return;
        }

        setTrackPoints((current) => mergeTrackPoints(current, response.data));
        setError(null);
        setRateLimited(false);
        setTokenConfigured(response.meta.tokenConfigured);
        setPartial((current) => current || response.meta.partial);
        setMessages((current) => mergeMessages(current, response.meta, locale));
        setLastUpdated(response.meta.generatedAt);
      }).catch((fetchError) => {
        if (disposed) {
          return;
        }

        const clientError =
          fetchError instanceof ClientApiError
            ? fetchError
            : new ClientApiError(
                fetchError instanceof Error ? fetchError.message : "Aggiornamento posizioni non riuscito",
                500,
                false,
              );

        setRateLimited(clientError.rateLimited);
        setPartial(true);
        setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
      });
    }

    async function loadStandings() {
      await withController(async (signal) => {
        const params = buildParams(demo, activeSession, replayStartedAt.current, locale);
        const response = await fetchApi<StandingsPayload>(
          "/api/f1/standings",
          params,
          signal,
        );

        if (disposed) {
          return;
        }

        setStandings(response.data.rows);
        setError(null);
        setRateLimited(false);
        setTrackPoints((current) =>
          mergeTrackPoints(
            current,
            response.data.trackPoints.map((point) => ({
              date: point.date ?? response.meta.generatedAt,
              sessionKey: activeSession.sessionKey,
              meetingKey: activeSession.meetingKey,
              driverNumber: point.driverNumber ?? 0,
              x: point.x,
              y: point.y,
              z: point.z ?? null,
            })),
          ),
        );
        setTokenConfigured(response.meta.tokenConfigured);
        setPartial((current) => current || response.meta.partial);
        setMessages((current) => mergeMessages(current, response.meta, locale));
        setLastUpdated(response.meta.generatedAt);
      }).catch((fetchError) => {
        if (disposed) {
          return;
        }

        const clientError =
          fetchError instanceof ClientApiError
            ? fetchError
            : new ClientApiError(
                fetchError instanceof Error ? fetchError.message : "Aggiornamento classifica non riuscito",
                500,
                false,
              );

        setError((current) => current ?? apiMessage(locale, clientError.message));
        setRateLimited(clientError.rateLimited);
        setPartial(true);
        setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
      });
    }

    async function loadRaceControl() {
      await withController(async (signal) => {
        const params = buildParams(
          demo,
          activeSession,
          replayStartedAt.current,
          locale,
          180,
        );
        const response = await fetchApi<RaceControlMessage[]>(
          "/api/f1/race-control",
          params,
          signal,
        );

        if (disposed) {
          return;
        }

        setRaceControlMessages(response.data);
        setTokenConfigured(response.meta.tokenConfigured);
        setPartial((current) => current || response.meta.partial);
        setMessages((current) => mergeMessages(current, response.meta, locale));
      }).catch((fetchError) => {
        if (disposed) {
          return;
        }

        const clientError =
          fetchError instanceof ClientApiError
            ? fetchError
            : new ClientApiError(
                fetchError instanceof Error ? fetchError.message : "Cronaca gara non disponibile",
                500,
                false,
              );

        setRateLimited((current) => current || clientError.rateLimited);
        setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
      });
    }

    let standingsStartupTimeout: number | undefined;
    let raceControlStartupTimeout: number | undefined;
    const startupTimeout = window.setTimeout(() => {
      loadLocation(activeSession.isLive ? 120 : 180);
      standingsStartupTimeout = window.setTimeout(loadStandings, 700);
      raceControlStartupTimeout = window.setTimeout(loadRaceControl, 1100);
    }, 1300);
    const fastLivePolling = activeSession.isLive && tokenConfigured;

    const locationInterval = window.setInterval(
      loadLocation,
      fastLivePolling ? 2800 : 5000,
    );
    const standingsInterval = window.setInterval(
      loadStandings,
      fastLivePolling ? 5000 : 9000,
    );
    const raceControlInterval = window.setInterval(
      loadRaceControl,
      fastLivePolling ? 7000 : 12000,
    );

    return () => {
      disposed = true;
      window.clearTimeout(startupTimeout);
      if (standingsStartupTimeout !== undefined) {
        window.clearTimeout(standingsStartupTimeout);
      }
      if (raceControlStartupTimeout !== undefined) {
        window.clearTimeout(raceControlStartupTimeout);
      }
      window.clearInterval(locationInterval);
      window.clearInterval(standingsInterval);
      window.clearInterval(raceControlInterval);
      for (const controller of controllers) {
        controller.abort();
      }
    };
  }, [demo, locale, loadedDemo, session, refreshNonce, tokenConfigured]);

  const hasCurrentModeData = loadedDemo === demo;
  const currentLoading = loading || !hasCurrentModeData;

  return {
    session: hasCurrentModeData ? session : null,
    meeting: hasCurrentModeData ? meeting : null,
    drivers: hasCurrentModeData ? drivers : [],
    standings: hasCurrentModeData ? standings : [],
    raceControlMessages: hasCurrentModeData ? raceControlMessages : [],
    trackPoints: hasCurrentModeData ? trackPoints : [],
    finishLine: hasCurrentModeData ? finishLine : null,
    loading: currentLoading,
    error: hasCurrentModeData ? error : null,
    isLive: hasCurrentModeData ? session?.isLive ?? false : false,
    rateLimited: hasCurrentModeData ? rateLimited : false,
    tokenConfigured: hasCurrentModeData ? tokenConfigured : false,
    partial: hasCurrentModeData ? partial : false,
    messages: hasCurrentModeData ? messages : [],
    lastUpdated: hasCurrentModeData ? lastUpdated : null,
    motionTimeMs: hasCurrentModeData ? motionTimeMs : null,
    refresh,
  };
}
