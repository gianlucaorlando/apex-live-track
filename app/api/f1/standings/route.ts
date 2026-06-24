import { buildStandings, normalizeDriver } from "@/lib/f1Transform";
import {
  apiErrorResponse,
  apiResponse,
  fetchIntervalsForRequest,
  fetchLapsForRequest,
  fetchLocationsForRequest,
  fetchOpenF1Array,
  fetchPositionsForRequest,
  fetchPositionsForSession,
  fetchSessionResults,
  fetchTyreStintsForSession,
  resolveSessionContext,
  toTrackPoints,
} from "@/lib/openf1";
import type { StandingsPayload } from "@/types/f1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const tyreDataPromise = Promise.all([
      fetchTyreStintsForSession(context.session.sessionKey, context.session.isLive),
      fetchLapsForRequest(request, context.session),
    ])
      .then(([tyreStints, laps]) => ({
        laps,
        tyreError: null as string | null,
        tyreStints,
      }))
      .catch((error: unknown) => ({
        laps: [],
        tyreError: error instanceof Error ? error.message : "Dati gomme non disponibili.",
        tyreStints: [],
      }));
    const sessionResultsPromise = fetchSessionResults(context.session.sessionKey).catch(
      () => [],
    );
    const [rawDrivers, positions, intervals, locations, tyreData, sessionResults] =
      await Promise.all([
        fetchOpenF1Array<unknown>(
          "drivers",
          { session_key: context.session.sessionKey },
          { cacheMs: 10 * 60 * 1000 },
        ),
        fetchPositionsForRequest(request, context.session).catch(() =>
          fetchPositionsForSession(context.session.sessionKey, context.session.isLive),
        ),
        fetchIntervalsForRequest(request, context.session, 45),
        fetchLocationsForRequest(request, context.session, 45),
        tyreDataPromise,
        sessionResultsPromise,
      ]);
    const drivers = rawDrivers.map(normalizeDriver);
    const rows = buildStandings({
      drivers,
      positions,
      intervals,
      locations,
      laps: tyreData.laps,
      tyreStints: tyreData.tyreStints,
      sessionResults,
      locale: context.locale,
    });
    const payload: StandingsPayload = {
      rows,
      trackPoints: toTrackPoints(locations),
    };
    const messages: string[] = [];

    if (drivers.length === 0) {
      messages.push("Dati piloti mancanti.");
    }

    if (positions.length === 0 && sessionResults.length === 0) {
      messages.push("Dati posizione mancanti.");
    }

    if (intervals.length === 0) {
      messages.push("Dati intervallo parziali o non disponibili per questa sessione.");
    }

    if (locations.length === 0) {
      messages.push("Dati posizione parziali o non disponibili per questa finestra.");
    }

    if (tyreData.tyreError) {
      messages.push("Dati gomme parziali o non disponibili per questa sessione.");
    }

    return apiResponse(payload, context, {
      cacheSeconds: context.session.isLive ? 4 : 5,
      partial: messages.length > 0,
      messages,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
