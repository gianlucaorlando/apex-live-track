import { apiErrorResponse, apiResponse, resolveSessionContext } from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const messages =
      context.session.isLive && !context.tokenConfigured
        ? ["OPENF1_API_TOKEN non configurato: i dati live possono richiedere un abbonamento OpenF1."]
        : [];

    return apiResponse(context.session, context, {
      cacheSeconds: context.session.isLive ? 10 : 60,
      messages,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
