import {
  apiErrorResponse,
  apiResponse,
  fetchFinishLineForSession,
  resolveSessionContext,
} from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const finishLine = await fetchFinishLineForSession(
      context.session.sessionKey,
      context.session.isLive,
    );

    return apiResponse(finishLine, context, {
      cacheSeconds: context.session.isLive ? 30 : 300,
      partial: finishLine === null,
      messages:
        finishLine === null
          ? ["Start/finish line could not be inferred from lap data."]
          : [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
