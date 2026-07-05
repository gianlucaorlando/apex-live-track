"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_REPLAY_OFFSET_SECONDS } from "@/lib/f1Constants";
import { formatGap, formatInterval } from "@/lib/format";
import { apiMessage, t, type Locale } from "@/lib/i18n";
import { locationToTrackPoint } from "@/lib/track";
import type {
  F1ApiMeta,
  F1ApiResponse,
  F1Driver,
  F1Interval,
  F1LiveStreamEvent,
  FinishLinePoint,
  F1LocationPoint,
  F1Meeting,
  F1Position,
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

const LIVE_MOTION_LAG_MS = 6000;
const REPLAY_MOTION_LAG_MS = 7000;
const STREAM_LOCATION_FLUSH_MS = 80;
const CURRENT_TRACK_WINDOW_MS = 70 * 1000;
const STREAM_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;
const STREAM_LOCATION_FUTURE_TOLERANCE_MS = 5000;

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
  currentTrackPoints: TrackPoint[];
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

// The "current" timestamp the track map should render, lagged behind live/replay time so a
// real sample from *after* it is almost always already fetched (see position_lag_ms). This is
// deliberately a plain derived value, not ticking state: TrackMap only needs a fresh read of
// it when telemetry actually changes, not 25 times a second, so there is no rAF loop driving
// it - it is simply recomputed on whichever render happens to need it.
function computeMotionTimeMs(
  session: F1Session | null,
  demo: boolean,
  loadedDemo: boolean | null,
  replayStartedAt: number,
): number | null {
  if (!session || loadedDemo !== demo) {
    return null;
  }

  if (session.isLive) {
    return Date.now() - LIVE_MOTION_LAG_MS;
  }

  const start = new Date(session.dateStart).getTime();
  if (!Number.isFinite(start)) {
    return null;
  }

  return start + replayMillisecondsFor(session, demo, replayStartedAt) - REPLAY_MOTION_LAG_MS;
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
    params.set(
      "position_lag_ms",
      String(session.isLive ? LIVE_MOTION_LAG_MS : REPLAY_MOTION_LAG_MS),
    );

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
    .sort((a, b) => trackPointTime(a) - trackPointTime(b))
    .slice(-18000);
}

function trackPointTime(point: TrackPoint): number {
  if (typeof point.timeMs === "number" && Number.isFinite(point.timeMs)) {
    return point.timeMs;
  }

  if (!point.date) {
    return 0;
  }

  const time = new Date(point.date).getTime();
  return Number.isFinite(time) ? time : 0;
}

function mergeCurrentTrackPoints(
  existing: TrackPoint[],
  incoming: F1LocationPoint[],
): TrackPoint[] {
  const merged = mergeTrackPoints(existing, incoming);
  const latestTime = Math.max(...merged.map(trackPointTime), 0);

  if (latestTime <= 0) {
    return merged.slice(-1200);
  }

  const cutoff = latestTime - CURRENT_TRACK_WINDOW_MS;

  return merged.filter((point) => trackPointTime(point) >= cutoff).slice(-2400);
}

function filterLiveStreamLocations(locations: F1LocationPoint[]): F1LocationPoint[] {
  const locationTimes = locations.map((location) => new Date(location.date).getTime());
  const latestTime = Math.max(
    ...locationTimes.filter((time) => Number.isFinite(time)),
    0,
  );

  if (latestTime <= 0) {
    return [];
  }

  return locations.filter((location) => {
    const time = new Date(location.date).getTime();

    if (!Number.isFinite(time)) {
      return false;
    }

    return (
      time >= latestTime - STREAM_LOCATION_MAX_AGE_MS &&
      time <= latestTime + STREAM_LOCATION_FUTURE_TOLERANCE_MS
    );
  });
}

function sortStandings(rows: LiveStandingRow[]): LiveStandingRow[] {
  return [...rows].sort((a, b) => {
    if (a.position === null && b.position === null) {
      return a.driverNumber - b.driverNumber;
    }

    if (a.position === null) {
      return 1;
    }

    if (b.position === null) {
      return -1;
    }

    return a.position - b.position;
  });
}

function applyStreamPosition(
  rows: LiveStandingRow[],
  position: F1Position,
  locale: Locale,
): LiveStandingRow[] {
  let changed = false;
  const nextRows = rows.map((row) => {
    if (row.driverNumber !== position.driverNumber) {
      return row;
    }

    changed = true;
    return {
      ...row,
      position: position.position,
      gap: position.position === 1 ? formatGap(null, position.position, locale) : row.gap,
      interval:
        position.position === 1 ? formatInterval(null, position.position, locale) : row.interval,
      updatedAt: position.date || row.updatedAt,
    };
  });

  return changed ? sortStandings(nextRows) : rows;
}

function applyStreamInterval(
  rows: LiveStandingRow[],
  interval: F1Interval,
  locale: Locale,
): LiveStandingRow[] {
  let changed = false;
  const nextRows = rows.map((row) => {
    if (row.driverNumber !== interval.driverNumber) {
      return row;
    }

    changed = true;
    return {
      ...row,
      gap: formatGap(interval.gapToLeader, row.position, locale),
      interval: formatInterval(interval.interval, row.position, locale),
      updatedAt: interval.date || row.updatedAt,
    };
  });

  return changed ? nextRows : rows;
}

function mergeRaceControlMessage(
  messages: RaceControlMessage[],
  incoming: RaceControlMessage,
): RaceControlMessage[] {
  const key = `${incoming.date}-${incoming.category}-${incoming.message}-${incoming.driverNumber ?? "x"}`;
  const exists = messages.some(
    (message) =>
      `${message.date}-${message.category}-${message.message}-${message.driverNumber ?? "x"}` ===
      key,
  );

  if (exists) {
    return messages;
  }

  return [incoming, ...messages]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 80);
}

export function useF1LiveData(demo: boolean, locale: Locale): UseF1LiveDataResult {
  const [session, setSession] = useState<F1Session | null>(null);
  const [meeting, setMeeting] = useState<F1Meeting | null>(null);
  const [drivers, setDrivers] = useState<F1Driver[]>([]);
  const [standings, setStandings] = useState<LiveStandingRow[]>([]);
  const [raceControlMessages, setRaceControlMessages] = useState<RaceControlMessage[]>([]);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [currentTrackPoints, setCurrentTrackPoints] = useState<TrackPoint[]>([]);
  const [finishLine, setFinishLine] = useState<FinishLinePoint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [pollingBackoff, setPollingBackoff] = useState(false);
  const [streamActive, setStreamActive] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [partial, setPartial] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadedDemo, setLoadedDemo] = useState<boolean | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const replayStartedAt = useRef(Date.now());
  const hasUsableDataRef = useRef(false);

  const refresh = useCallback(() => {
    replayStartedAt.current = Date.now();
    setRefreshNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    hasUsableDataRef.current = Boolean(
      session || standings.length > 0 || trackPoints.length > 0 || raceControlMessages.length > 0,
    );
  }, [raceControlMessages.length, session, standings.length, trackPoints.length]);

  useEffect(() => {
    replayStartedAt.current = Date.now();
    setSession(null);
    setMeeting(null);
    setDrivers([]);
    setStandings([]);
    setTrackPoints([]);
    setCurrentTrackPoints([]);
    setRaceControlMessages([]);
    setFinishLine(null);
    setLastUpdated(null);
    setStreamActive(false);
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
        setPollingBackoff(false);
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

        if (clientError.rateLimited && hasUsableDataRef.current) {
          setError(null);
          setLoadedDemo(demo);
          setPollingBackoff(true);
          setRateLimited(false);
          setTokenConfigured((current) => clientError.meta?.tokenConfigured ?? current);
          setPartial(true);
          setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
          return;
        }

        setError(apiMessage(locale, clientError.message));
        setSession(null);
        setMeeting(null);
        setDrivers([]);
        setStandings([]);
        setTrackPoints([]);
        setCurrentTrackPoints([]);
        setLoadedDemo(demo);
        setRateLimited(clientError.rateLimited);
        setPollingBackoff(clientError.rateLimited);
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
        setPollingBackoff(false);
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

        setPollingBackoff((current) => current || clientError.rateLimited);
        setRateLimited((current) =>
          current || (clientError.rateLimited && !hasUsableDataRef.current),
        );
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
    if (!session || loadedDemo !== demo || demo || !session.isLive || !tokenConfigured) {
      setStreamActive(false);
      return;
    }

    let disposed = false;
    let pendingLocations: F1LocationPoint[] = [];
    let flushTimeout: number | undefined;
    const params = new URLSearchParams({
      session_key: String(session.sessionKey),
      meeting_key: String(session.meetingKey),
      lang: locale,
    });
    const source = new EventSource(`/api/f1/live-stream?${params.toString()}`);

    function flushLocations() {
      flushTimeout = undefined;

      if (disposed || pendingLocations.length === 0) {
        pendingLocations = [];
        return;
      }

      const locations = pendingLocations;
      pendingLocations = [];
      const usableLocations = filterLiveStreamLocations(locations);

      if (usableLocations.length === 0) {
        return;
      }

      setCurrentTrackPoints((current) => mergeCurrentTrackPoints(current, usableLocations));
      setTrackPoints((current) => mergeTrackPoints(current, usableLocations));
      setLastUpdated(usableLocations.at(-1)?.date ?? new Date().toISOString());
      setPollingBackoff(false);
      setRateLimited(false);
    }

    function enqueueLocation(location: F1LocationPoint) {
      pendingLocations.push(location);

      if (flushTimeout === undefined) {
        flushTimeout = window.setTimeout(flushLocations, STREAM_LOCATION_FLUSH_MS);
      }
    }

    function handleStreamEvent(message: MessageEvent<string>) {
      let event: F1LiveStreamEvent;

      try {
        event = JSON.parse(message.data) as F1LiveStreamEvent;
      } catch {
        return;
      }

      if (event.type === "status") {
        if (event.data.status === "subscribed" || event.data.status === "connected") {
          setStreamActive(true);
        } else if (event.data.status === "error" || event.data.status === "closed") {
          setStreamActive(false);
        }
        return;
      }

      setStreamActive(true);
      setLastUpdated(event.generatedAt);

      if (event.type === "location") {
        enqueueLocation(event.data);
        return;
      }

      if (event.type === "position") {
        setStandings((current) => applyStreamPosition(current, event.data, locale));
        return;
      }

      if (event.type === "interval") {
        setStandings((current) => applyStreamInterval(current, event.data, locale));
        return;
      }

      if (event.type === "race-control") {
        setRaceControlMessages((current) => mergeRaceControlMessage(current, event.data));
      }
    }

    source.addEventListener("f1", handleStreamEvent);
    source.onerror = () => {
      if (!disposed) {
        setStreamActive(false);
      }
    };

    return () => {
      disposed = true;
      setStreamActive(false);
      source.removeEventListener("f1", handleStreamEvent);
      source.close();

      if (flushTimeout !== undefined) {
        window.clearTimeout(flushTimeout);
      }
    };
  }, [
    demo,
    loadedDemo,
    locale,
    session?.isLive,
    session?.meetingKey,
    session?.sessionKey,
    tokenConfigured,
  ]);

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
        setPollingBackoff(false);
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

        setPollingBackoff((current) => current || clientError.rateLimited);
        setRateLimited(clientError.rateLimited && !hasUsableDataRef.current);
        setPartial(true);
        setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
      });
    }

    async function loadStandings() {
      await withController(async (signal) => {
        const params = buildParams(demo, activeSession, replayStartedAt.current, locale);
        if (activeSession.isLive && streamActive) {
          params.set("skip_locations", "true");
        }
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
        setPollingBackoff(false);
        if (response.data.trackPoints.length > 0) {
          setCurrentTrackPoints((current) =>
            mergeCurrentTrackPoints(
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
        }
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

        if (!(clientError.rateLimited && hasUsableDataRef.current)) {
          setError((current) => current ?? apiMessage(locale, clientError.message));
        }
        setPollingBackoff((current) => current || clientError.rateLimited);
        setRateLimited(clientError.rateLimited && !hasUsableDataRef.current);
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
        setPollingBackoff(false);
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

        setPollingBackoff((current) => current || clientError.rateLimited);
        setRateLimited((current) =>
          current || (clientError.rateLimited && !hasUsableDataRef.current),
        );
        setMessages((current) => mergeMessages(current, clientError.meta ?? undefined, locale));
      });
    }

    let standingsStartupTimeout: number | undefined;
    let raceControlStartupTimeout: number | undefined;
    const locationPollingEnabled =
      !activeSession.isLive || !tokenConfigured || !streamActive;
    const startupTimeout = window.setTimeout(() => {
      if (locationPollingEnabled) {
        loadLocation(activeSession.isLive ? 120 : 180);
      }
      standingsStartupTimeout = window.setTimeout(loadStandings, 700);
      raceControlStartupTimeout = window.setTimeout(loadRaceControl, 1100);
    }, 1300);
    const fastLivePolling = activeSession.isLive && tokenConfigured;
    const pollingMultiplier = pollingBackoff ? (tokenConfigured ? 1.8 : 3) : 1;

    const locationInterval = locationPollingEnabled
      ? window.setInterval(
          loadLocation,
          Math.round((fastLivePolling ? 3000 : 7000) * pollingMultiplier),
        )
      : undefined;
    const standingsInterval = window.setInterval(
      loadStandings,
      Math.round((fastLivePolling ? 5000 : 7000) * pollingMultiplier),
    );
    const raceControlInterval = window.setInterval(
      loadRaceControl,
      Math.round((fastLivePolling ? 9000 : 18000) * pollingMultiplier),
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
      if (locationInterval !== undefined) {
        window.clearInterval(locationInterval);
      }
      window.clearInterval(standingsInterval);
      window.clearInterval(raceControlInterval);
      for (const controller of controllers) {
        controller.abort();
      }
    };
  }, [
    demo,
    locale,
    loadedDemo,
    pollingBackoff,
    session,
    refreshNonce,
    streamActive,
    tokenConfigured,
  ]);

  const hasCurrentModeData = loadedDemo === demo;
  const currentLoading = loading || !hasCurrentModeData;
  const motionTimeMs = computeMotionTimeMs(session, demo, loadedDemo, replayStartedAt.current);

  return {
    session: hasCurrentModeData ? session : null,
    meeting: hasCurrentModeData ? meeting : null,
    drivers: hasCurrentModeData ? drivers : [],
    standings: hasCurrentModeData ? standings : [],
    raceControlMessages: hasCurrentModeData ? raceControlMessages : [],
    trackPoints: hasCurrentModeData ? trackPoints : [],
    currentTrackPoints: hasCurrentModeData ? currentTrackPoints : [],
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
