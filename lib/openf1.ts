import { NextResponse } from "next/server";
import {
  getOpenF1AccessToken,
  openF1AuthConfigured,
} from "@/lib/openf1Auth";
import { apiMessage, normalizeLocale, type Locale } from "@/lib/i18n";
import {
  DEMO_REPLAY_OFFSET_SECONDS,
  DEMO_SESSION_KEY,
} from "@/lib/f1Constants";
import {
  normalizeInterval,
  normalizeLap,
  normalizeLocationPoint,
  normalizePosition,
  normalizeRaceControlMessage,
  normalizeSession,
  normalizeSessionResult,
  normalizeTyreStint,
} from "@/lib/f1Transform";
import { locationToTrackPoint } from "@/lib/track";
import type {
  F1ApiMeta,
  F1ApiResponse,
  F1Lap,
  FinishLinePoint,
  F1Interval,
  F1LocationPoint,
  F1Position,
  F1Session,
  F1SessionResult,
  F1TyreStint,
  RaceControlMessage,
  StandingsPayload,
} from "@/types/f1";

const OPENF1_BASE_URL = "https://api.openf1.org/v1";

type QueryValue = string | number | boolean | null | undefined;
type OpenF1Params = Record<string, QueryValue>;

interface CacheEntry<T> {
  expiresAt: number;
  staleUntil: number;
  value: T;
}

interface RouteContext {
  sessionKey: number | "latest";
  demo: boolean;
  replay: boolean;
  tokenConfigured: boolean;
  locale: Locale;
  messages?: string[];
}

export interface SessionContext extends RouteContext {
  session: F1Session;
}

export class OpenF1Error extends Error {
  status: number;
  rateLimited: boolean;

  constructor(message: string, status: number, rateLimited = false) {
    super(message);
    this.name = "OpenF1Error";
    this.status = status;
    this.rateLimited = rateLimited;
  }
}

const globalCache = globalThis as typeof globalThis & {
  __f1LiveTrackCache?: Map<string, CacheEntry<unknown>>;
  __f1LiveTrackInflight?: Map<string, Promise<unknown>>;
  __f1LiveTrackNextFetchAt?: number;
  __f1LiveTrackBackoffUntil?: number;
};

const memoryCache =
  globalCache.__f1LiveTrackCache ?? new Map<string, CacheEntry<unknown>>();
globalCache.__f1LiveTrackCache = memoryCache;

const inflightCache =
  globalCache.__f1LiveTrackInflight ?? new Map<string, Promise<unknown>>();
globalCache.__f1LiveTrackInflight = inflightCache;

function tokenConfigured(): boolean {
  return openF1AuthConfigured();
}

async function waitForOpenF1Slot(): Promise<void> {
  const now = Date.now();
  // Unauthenticated production deployments (e.g. no OPENF1_API_TOKEN configured on the
  // host) hit OpenF1's public rate limit easily, especially right after a cold start when
  // several routes fan out concurrent requests with no cache to fall back on. A more
  // conservative interval trades a bit of freshness for far fewer 429s reaching the client.
  const intervalMs = tokenConfigured() ? 180 : 550;
  const nextFetchAt = globalCache.__f1LiveTrackNextFetchAt ?? now;
  const backoffUntil = globalCache.__f1LiveTrackBackoffUntil ?? now;
  const waitMs = Math.max(0, nextFetchAt - now, backoffUntil - now);

  globalCache.__f1LiveTrackNextFetchAt = Math.max(now, nextFetchAt) + intervalMs;

  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

function rememberRateLimitBackoff(): void {
  globalCache.__f1LiveTrackBackoffUntil = Date.now() + (tokenConfigured() ? 3500 : 14000);
}

function cacheEntry<T>(value: T, ttl: number): CacheEntry<T> {
  const now = Date.now();
  const staleMs = Math.max(ttl * 12, 5 * 60 * 1000);

  return {
    expiresAt: now + ttl,
    staleUntil: now + staleMs,
    value,
  };
}

function cacheKey(endpoint: string, params: OpenF1Params): string {
  const query = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");

  return `${endpoint}?${query}`;
}

function buildUrl(endpoint: string, params: OpenF1Params): string {
  const url = new URL(`${OPENF1_BASE_URL}/${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function detailMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const detail = (payload as Record<string, unknown>).detail;
  return typeof detail === "string" ? detail : null;
}

function isNoResultsMessage(message: string | null): boolean {
  return Boolean(message?.toLowerCase().includes("no results"));
}

function parseNumberParam(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isDemoRequest(url: URL): boolean {
  const demo = url.searchParams.get("demo");
  return demo === "true" || demo === "1" || demo === "";
}

export function requestedSessionKey(url: URL): number | "latest" {
  if (isDemoRequest(url)) {
    return DEMO_SESSION_KEY;
  }

  const sessionKey = url.searchParams.get("session_key");
  if (!sessionKey || sessionKey === "latest") {
    return "latest";
  }

  const parsed = Number(sessionKey);
  return Number.isFinite(parsed) ? parsed : "latest";
}

export async function fetchOpenF1Array<T>(
  endpoint: string,
  params: OpenF1Params,
  options?: {
    cacheMs?: number;
    timeoutMs?: number;
  },
): Promise<T[]> {
  const ttl = options?.cacheMs ?? 0;
  const key = cacheKey(endpoint, params);
  const cached = memoryCache.get(key) as CacheEntry<T[]> | undefined;
  const staleCached =
    cached && cached.staleUntil > Date.now() ? cached.value : null;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inflight = inflightCache.get(key) as Promise<T[]> | undefined;
  if (inflight) {
    return inflight;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 8000);
  const headers: HeadersInit = {
    Accept: "application/json",
  };

  // A cold start (empty cache, e.g. right after the process spins back up on a host that
  // sleeps when idle) has no stale value to fall back on, so a single 429 would otherwise
  // reach the client as a hard failure. One short, bounded retry - well below the multi-
  // second backoff used for unrelated calls - is usually enough to ride out a transient
  // limit without making the caller wait noticeably longer.
  const RATE_LIMIT_RETRY_DELAY_MS = 1200;

  const requestPromise = (async () => {
    let attempt = 0;

    for (;;) {
      attempt += 1;

      // Only the first attempt waits for the shared slot/backoff: rememberRateLimitBackoff()
      // below sets a multi-second backoff for *future*, unrelated calls, which would
      // otherwise swallow the short retry delay we already apply ourselves right below.
      if (attempt === 1) {
        await waitForOpenF1Slot();
      }

      const accessToken = await getOpenF1AccessToken();

      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(buildUrl(endpoint, params), {
        cache: "no-store",
        headers,
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);
      const detail = detailMessage(payload);

      if (!response.ok) {
        if (isNoResultsMessage(detail)) {
          if (ttl > 0) {
            memoryCache.set(key, cacheEntry([], ttl));
          }
          return [];
        }

        if (response.status === 429) {
          rememberRateLimitBackoff();

          if (staleCached) {
            memoryCache.set(key, cacheEntry(staleCached, Math.max(ttl, 4000)));
            return staleCached;
          }

          if (attempt === 1) {
            await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_RETRY_DELAY_MS));
            continue;
          }
        }

        throw new OpenF1Error(
          detail ?? `OpenF1 responded with ${response.status}`,
          response.status,
          response.status === 429,
        );
      }

      if (!Array.isArray(payload)) {
        if (isNoResultsMessage(detail)) {
          if (ttl > 0) {
            memoryCache.set(key, cacheEntry([], ttl));
          }
          return [];
        }

        throw new OpenF1Error(
          detail ?? "OpenF1 returned an unexpected payload",
          502,
        );
      }

      if (ttl > 0) {
        memoryCache.set(key, cacheEntry(payload, ttl));
      }

      return payload as T[];
    }
  })();

  inflightCache.set(key, requestPromise);

  try {
    return await requestPromise;
  } catch (error) {
    if (error instanceof OpenF1Error) {
      if (error.rateLimited && staleCached) {
        rememberRateLimitBackoff();
        memoryCache.set(key, cacheEntry(staleCached, Math.max(ttl, 4000)));
        return staleCached;
      }

      throw error;
    }

    if (staleCached) {
      memoryCache.set(key, cacheEntry(staleCached, Math.max(ttl, 4000)));
      return staleCached;
    }

    const message =
      error instanceof Error && error.name === "AbortError"
        ? "OpenF1 request timed out"
        : error instanceof Error
          ? error.message
          : "Richiesta OpenF1 non riuscita";

    throw new OpenF1Error(message, 504);
  } finally {
    clearTimeout(timeout);
    inflightCache.delete(key);
  }
}

export async function resolveSessionContext(request: Request): Promise<SessionContext> {
  const url = new URL(request.url);
  const sessionKey = requestedSessionKey(url);
  const demo = isDemoRequest(url);
  const locale = normalizeLocale(url.searchParams.get("lang"));
  const sessions = await fetchOpenF1Array<unknown>(
    "sessions",
    { session_key: sessionKey },
    { cacheMs: demo ? 10 * 60 * 1000 : 20 * 1000 },
  );

  if (sessions.length === 0) {
    throw new OpenF1Error("Nessuna sessione OpenF1 trovata", 404);
  }

  const session = normalizeSession(sessions[0]);

  return {
    session,
    sessionKey: session.sessionKey,
    demo,
    replay: demo || !session.isLive,
    tokenConfigured: tokenConfigured(),
    locale,
  };
}

export function getTimeWindowParams(
  request: Request,
  session: F1Session,
  defaultWindowSeconds: number,
): OpenF1Params {
  const url = new URL(request.url);
  const requestedWindow = parseNumberParam(
    url.searchParams.get("window_seconds"),
    defaultWindowSeconds,
  );
  const windowSeconds = clamp(requestedWindow, 5, 180);
  const replaySecondsParam = url.searchParams.get("replay_seconds");
  const start = new Date(session.dateStart).getTime();
  const end = new Date(session.dateEnd).getTime();
  const now = Date.now();
  const hasValidBounds =
    Number.isFinite(start) && Number.isFinite(end) && end > start;
  let windowEnd = now;

  if (!session.isLive && hasValidBounds) {
    if (replaySecondsParam) {
      const replaySeconds = parseNumberParam(replaySecondsParam, DEMO_REPLAY_OFFSET_SECONDS);
      windowEnd = start + replaySeconds * 1000;
    } else {
      const durationSeconds = Math.max((end - start) / 1000, 300);
      const minimumOffset = session.sessionKey === DEMO_SESSION_KEY ? DEMO_REPLAY_OFFSET_SECONDS : 600;
      const replaySpan = Math.max(durationSeconds - minimumOffset - 120, 60);
      const replayOffset = minimumOffset + (Math.floor(Date.now() / 1000) % replaySpan);
      windowEnd = start + replayOffset * 1000;
    }
  }

  const windowStart = new Date(windowEnd - windowSeconds * 1000).toISOString();
  const windowFinish = new Date(windowEnd).toISOString();

  return {
    "date>": windowStart,
    "date<": windowFinish,
  };
}

export async function fetchLocationsForRequest(
  request: Request,
  session: F1Session,
  windowSeconds = 45,
): Promise<F1LocationPoint[]> {
  const raw = await fetchOpenF1Array<unknown>(
    "location",
    {
      session_key: session.sessionKey,
      ...getTimeWindowParams(request, session, windowSeconds),
    },
    { cacheMs: session.isLive ? 1800 : 4500 },
  );

  return raw.map(normalizeLocationPoint);
}

export async function fetchPositionsForSession(
  sessionKey: number,
  isLive: boolean,
): Promise<F1Position[]> {
  const raw = await fetchOpenF1Array<unknown>(
    "position",
    { session_key: sessionKey },
    { cacheMs: isLive ? 4500 : 5 * 60 * 1000 },
  );

  return raw.map(normalizePosition);
}

export async function fetchPositionsForRequest(
  request: Request,
  session: F1Session,
): Promise<F1Position[]> {
  const raw = await fetchOpenF1Array<unknown>(
    "position",
    {
      session_key: session.sessionKey,
      "date<": positionCutoffIso(request, session),
    },
    { cacheMs: session.isLive ? 4500 : 12000 },
  );

  return raw.map(normalizePosition);
}

export async function fetchIntervalsForRequest(
  request: Request,
  session: F1Session,
  windowSeconds = 45,
): Promise<F1Interval[]> {
  const raw = await fetchOpenF1Array<unknown>(
    "intervals",
    {
      session_key: session.sessionKey,
      ...getPositionWindowParams(request, session, windowSeconds),
    },
    { cacheMs: session.isLive ? 3500 : 4500 },
  );

  return raw.map(normalizeInterval);
}

export async function fetchLapsForSession(
  sessionKey: number,
  isLive: boolean,
): Promise<F1Lap[]> {
  const raw = await fetchOpenF1Array<unknown>(
    "laps",
    { session_key: sessionKey },
    { cacheMs: isLive ? 15 * 1000 : 10 * 60 * 1000, timeoutMs: 10000 },
  );

  return raw
    .map(normalizeLap)
    .filter((lap) => lap.driverNumber > 0 && lap.lapNumber > 0);
}

export async function fetchLapsForRequest(
  request: Request,
  session: F1Session,
): Promise<F1Lap[]> {
  const cutoff = positionCutoffIso(request, session);
  const raw = await fetchOpenF1Array<unknown>(
    "laps",
    {
      session_key: session.sessionKey,
      "date_start<": cutoff,
    },
    { cacheMs: session.isLive ? 12 * 1000 : 45 * 1000, timeoutMs: 10000 },
  );

  return raw
    .map(normalizeLap)
    .filter((lap) => lap.driverNumber > 0 && lap.lapNumber > 0);
}

export async function fetchTyreStintsForSession(
  sessionKey: number,
  isLive: boolean,
): Promise<F1TyreStint[]> {
  const raw = await fetchOpenF1Array<unknown>(
    "stints",
    { session_key: sessionKey },
    { cacheMs: isLive ? 15 * 1000 : 10 * 60 * 1000, timeoutMs: 10000 },
  );

  return raw
    .map(normalizeTyreStint)
    .filter((stint) => stint.driverNumber > 0 && stint.compound.length > 0);
}

function replayCutoffIso(request: Request, session: F1Session): string {
  const windowParams = getTimeWindowParams(request, session, 180);
  const cutoff = windowParams["date<"];

  return typeof cutoff === "string" ? cutoff : new Date().toISOString();
}

function positionCutoffIso(request: Request, session: F1Session): string {
  const url = new URL(request.url);
  const cutoffTime = new Date(replayCutoffIso(request, session)).getTime();
  const requestedLagMs = parseNumberParam(url.searchParams.get("position_lag_ms"), 0);
  const lagMs = clamp(requestedLagMs, 0, 15000);

  if (!Number.isFinite(cutoffTime) || lagMs <= 0) {
    return replayCutoffIso(request, session);
  }

  return new Date(cutoffTime - lagMs).toISOString();
}

function getPositionWindowParams(
  request: Request,
  session: F1Session,
  defaultWindowSeconds: number,
): OpenF1Params {
  const baseWindow = getTimeWindowParams(request, session, defaultWindowSeconds);
  const baseStart = new Date(String(baseWindow["date>"])).getTime();
  const baseFinish = new Date(String(baseWindow["date<"])).getTime();
  const cutoff = new Date(positionCutoffIso(request, session)).getTime();

  if (
    !Number.isFinite(baseStart) ||
    !Number.isFinite(baseFinish) ||
    !Number.isFinite(cutoff) ||
    cutoff >= baseFinish
  ) {
    return baseWindow;
  }

  const windowMs = Math.max(baseFinish - baseStart, 5000);

  return {
    "date>": new Date(cutoff - windowMs).toISOString(),
    "date<": new Date(cutoff).toISOString(),
  };
}

function messageTime(value: string): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function fetchRaceControlForRequest(
  request: Request,
  session: F1Session,
  limit = 40,
): Promise<RaceControlMessage[]> {
  const cutoff = replayCutoffIso(request, session);
  const raw = await fetchOpenF1Array<unknown>(
    "race_control",
    {
      session_key: session.sessionKey,
      "date<": cutoff,
    },
    {
      cacheMs: session.isLive ? 5000 : 12000,
      timeoutMs: 10000,
    },
  );

  return raw
    .map(normalizeRaceControlMessage)
    .filter((item) => item.message.length > 0)
    .sort((first, second) => messageTime(second.date) - messageTime(first.date))
    .slice(0, limit);
}

function lapStartTime(lap: F1Lap): number | null {
  if (!lap.dateStart) {
    return null;
  }

  const time = new Date(lap.dateStart).getTime();
  return Number.isFinite(time) ? time : null;
}

function finishLineLapCandidates(laps: F1Lap[]): F1Lap[] {
  return laps
    .filter((lap) => lapStartTime(lap) !== null)
    .sort((a, b) => {
      const aLapOnePenalty = a.lapNumber <= 1 ? 1 : 0;
      const bLapOnePenalty = b.lapNumber <= 1 ? 1 : 0;

      if (aLapOnePenalty !== bLapOnePenalty) {
        return aLapOnePenalty - bLapOnePenalty;
      }

      if (a.lapNumber !== b.lapNumber) {
        return a.lapNumber - b.lapNumber;
      }

      return (lapStartTime(a) ?? 0) - (lapStartTime(b) ?? 0);
    });
}

function nearestLocationForLap(
  locations: F1LocationPoint[],
  lap: F1Lap,
): { point: F1LocationPoint; deltaMs: number; sameDriver: boolean } | null {
  const targetTime = lapStartTime(lap);

  if (targetTime === null) {
    return null;
  }

  let best:
    | { point: F1LocationPoint; deltaMs: number; sameDriver: boolean }
    | null = null;

  for (const point of locations) {
    const pointTime = new Date(point.date).getTime();

    if (!Number.isFinite(pointTime)) {
      continue;
    }

    const sameDriver = point.driverNumber === lap.driverNumber;
    const deltaMs = Math.abs(pointTime - targetTime);

    if (
      !best ||
      (sameDriver && !best.sameDriver) ||
      (sameDriver === best.sameDriver && deltaMs < best.deltaMs)
    ) {
      best = { point, deltaMs, sameDriver };
    }
  }

  return best;
}

export async function fetchFinishLineForSession(
  sessionKey: number,
  isLive: boolean,
): Promise<FinishLinePoint | null> {
  const laps = await fetchLapsForSession(sessionKey, isLive);
  const candidates = finishLineLapCandidates(laps).slice(0, 6);

  for (const lap of candidates) {
    const targetTime = lapStartTime(lap);

    if (targetTime === null) {
      continue;
    }

    const rawLocations = await fetchOpenF1Array<unknown>(
      "location",
      {
        session_key: sessionKey,
        "date>": new Date(targetTime - 6000).toISOString(),
        "date<": new Date(targetTime + 6000).toISOString(),
      },
      { cacheMs: isLive ? 30 * 1000 : 10 * 60 * 1000, timeoutMs: 10000 },
    );
    const nearest = nearestLocationForLap(
      rawLocations.map(normalizeLocationPoint),
      lap,
    );

    if (!nearest) {
      continue;
    }

    const confidence: FinishLinePoint["confidence"] =
      nearest.sameDriver && nearest.deltaMs <= 2500
        ? "high"
        : nearest.deltaMs <= 6000
          ? "medium"
          : "low";

    return {
      driverNumber: nearest.point.driverNumber,
      date: nearest.point.date,
      x: nearest.point.x,
      y: nearest.point.y,
      z: nearest.point.z,
      source: "lap-start",
      confidence,
      lapNumber: lap.lapNumber,
    };
  }

  return null;
}

export async function fetchSessionResults(
  sessionKey: number,
): Promise<F1SessionResult[]> {
  const raw = await fetchOpenF1Array<unknown>(
    "session_result",
    { session_key: sessionKey },
    { cacheMs: 5 * 60 * 1000 },
  );

  return raw.map(normalizeSessionResult);
}

export function apiResponse<T>(
  data: T,
  context: RouteContext,
  init?: {
    status?: number;
    partial?: boolean;
    messages?: string[];
    cacheSeconds?: number;
  },
): NextResponse<F1ApiResponse<T>> {
  const messages = [...(context.messages ?? []), ...(init?.messages ?? [])].map((message) =>
    apiMessage(context.locale, message),
  );
  const meta: F1ApiMeta = {
    generatedAt: new Date().toISOString(),
    source: "openf1",
    sessionKey: context.sessionKey,
    demo: context.demo,
    replay: context.replay,
    tokenConfigured: context.tokenConfigured,
    partial: init?.partial ?? false,
    messages,
  };

  const response = NextResponse.json(
    {
      data,
      meta,
    },
    {
      status: init?.status ?? 200,
    },
  );

  if (init?.cacheSeconds) {
    response.headers.set(
      "Cache-Control",
      `public, max-age=0, s-maxage=${init.cacheSeconds}`,
    );
  }

  return response;
}

export function apiErrorResponse(
  error: unknown,
  context?: Partial<RouteContext>,
): NextResponse {
  const openF1Error =
    error instanceof OpenF1Error
      ? error
      : new OpenF1Error(
          error instanceof Error ? error.message : "Errore API inatteso",
          500,
        );
  const status = openF1Error.status === 429 ? 429 : Math.min(openF1Error.status, 599);
  const locale = context?.locale ?? "it";
  const message = apiMessage(locale, openF1Error.message);

  return NextResponse.json(
    {
      data: null,
      meta: {
        generatedAt: new Date().toISOString(),
        source: "openf1",
        sessionKey: context?.sessionKey ?? "latest",
        demo: context?.demo ?? false,
        replay: context?.replay ?? false,
        tokenConfigured: tokenConfigured(),
        partial: true,
        messages: [message],
      } satisfies F1ApiMeta,
      error: {
        message,
        rateLimited: openF1Error.rateLimited,
      },
    },
    { status },
  );
}

export function standingsTrackPoints(payload: StandingsPayload): StandingsPayload {
  return {
    ...payload,
    trackPoints: payload.trackPoints.map((point) => ({
      ...point,
      driverNumber: point.driverNumber,
    })),
  };
}

export function toTrackPoints(points: F1LocationPoint[]) {
  return points.map(locationToTrackPoint);
}
