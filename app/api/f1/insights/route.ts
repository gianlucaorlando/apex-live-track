import { fetchSessionInsights } from "@/lib/f1Insights";
import { apiErrorResponse, apiResponse, resolveSessionContext } from "@/lib/openf1";
import type { SessionInsights } from "@/types/f1Insights";

export const dynamic = "force-dynamic";

const EMPTY_INSIGHTS: SessionInsights = {
  teamRadio: [],
  pitStops: [],
  weather: null,
  startingGrid: {},
  overtakes: [],
  championshipDrivers: [],
  championshipTeams: [],
  fastestLap: null,
  bestSectors: [null, null, null],
  lapsByDriver: {},
  speedTrap: [],
  gapByLap: {},
};

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);

    if (context.demo) {
      return apiResponse(EMPTY_INSIGHTS, context);
    }

    const insights = await fetchSessionInsights(request, context.session);

    return apiResponse(insights, context, {
      cacheSeconds: context.session.isLive ? 5 : 10,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
