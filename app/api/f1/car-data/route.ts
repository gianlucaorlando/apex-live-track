import { fetchCarTelemetry } from "@/lib/f1Insights";
import { apiErrorResponse, apiResponse, resolveSessionContext } from "@/lib/openf1";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await resolveSessionContext(request);
    const driverNumber = Number(new URL(request.url).searchParams.get("driver_number"));

    if (context.demo || !Number.isInteger(driverNumber) || driverNumber <= 0) {
      return apiResponse([], context);
    }

    const samples = await fetchCarTelemetry(request, context.session, driverNumber);

    return apiResponse(samples, context, { cacheSeconds: 1 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
