import {
  apiErrorResponse,
  apiResponse,
  fetchIntervalsForRequest,
  resolveSessionContext,
} from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const intervals = await fetchIntervalsForRequest(request, context.session, 45);

    return apiResponse(intervals, context, {
      cacheSeconds: context.session.isLive ? 4 : 5,
      partial: intervals.length === 0,
      messages:
        intervals.length === 0
          ? ["Nessun intervallo disponibile nella finestra selezionata."]
          : [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
