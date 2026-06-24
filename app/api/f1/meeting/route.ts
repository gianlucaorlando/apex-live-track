import { normalizeMeeting } from "@/lib/f1Transform";
import {
  apiErrorResponse,
  apiResponse,
  fetchOpenF1Array,
  resolveSessionContext,
} from "@/lib/openf1";
import type { F1Meeting } from "@/types/f1";

export const dynamic = "force-dynamic";

function fallbackMeeting(context: Awaited<ReturnType<typeof resolveSessionContext>>): F1Meeting {
  const { session } = context;

  return {
    meetingKey: session.meetingKey,
    meetingName: `${session.countryName} Grand Prix`,
    meetingOfficialName: `${session.countryName} Grand Prix`,
    circuitKey: session.circuitKey,
    circuitShortName: session.circuitShortName,
    circuitImage: null,
    circuitInfoUrl: null,
    circuitType: null,
    countryCode: session.countryCode,
    countryName: session.countryName,
    location: session.location,
    dateStart: session.dateStart,
    dateEnd: session.dateEnd,
    year: session.year,
  };
}

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const raw = await fetchOpenF1Array<unknown>(
      "meetings",
      { meeting_key: context.session.meetingKey },
      { cacheMs: 10 * 60 * 1000 },
    );
    const meeting = raw[0] ? normalizeMeeting(raw[0]) : fallbackMeeting(context);

    return apiResponse(meeting, context, {
      cacheSeconds: 300,
      partial: raw.length === 0,
      messages: raw.length === 0 ? ["Dettagli evento non disponibili."] : [],
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
