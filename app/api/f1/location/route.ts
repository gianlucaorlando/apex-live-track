import {
  apiErrorResponse,
  apiResponse,
  fetchLocationsForRequest,
  resolveSessionContext,
} from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const points = await fetchLocationsForRequest(request, context.session, 45);

    return apiResponse(points, context, {
      cacheSeconds: context.session.isLive ? 2 : 5,
      partial: points.length === 0,
      messages:
        points.length === 0
          ? ["Nessun punto posizione disponibile nella finestra selezionata."]
          : [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
