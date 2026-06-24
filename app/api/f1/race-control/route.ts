import {
  apiErrorResponse,
  apiResponse,
  fetchRaceControlForRequest,
  resolveSessionContext,
} from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const messages = await fetchRaceControlForRequest(request, context.session, 40);

    return apiResponse(messages, context, {
      cacheSeconds: context.session.isLive ? 4 : 8,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
