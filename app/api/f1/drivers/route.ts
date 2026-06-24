import { normalizeDriver } from "@/lib/f1Transform";
import {
  apiErrorResponse,
  apiResponse,
  fetchOpenF1Array,
  resolveSessionContext,
} from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const raw = await fetchOpenF1Array<unknown>(
      "drivers",
      { session_key: context.session.sessionKey },
      { cacheMs: 10 * 60 * 1000 },
    );
    const drivers = raw.map(normalizeDriver);

    return apiResponse(drivers, context, {
      cacheSeconds: 300,
      partial: drivers.length === 0,
      messages: drivers.length === 0 ? ["No driver list returned by OpenF1."] : [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
