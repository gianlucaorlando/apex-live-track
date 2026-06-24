import {
  apiErrorResponse,
  apiResponse,
  fetchPositionsForSession,
  resolveSessionContext,
} from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const positions = await fetchPositionsForSession(
      context.session.sessionKey,
      context.session.isLive,
    );

    return apiResponse(positions, context, {
      cacheSeconds: context.session.isLive ? 4 : 60,
      partial: positions.length === 0,
      messages: positions.length === 0 ? ["No position records returned by OpenF1."] : [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
