import mqtt, { type MqttClient } from "mqtt";
import {
  normalizeInterval,
  normalizeLocationPoint,
  normalizePosition,
  normalizeRaceControlMessage,
} from "@/lib/f1Transform";
import {
  getOpenF1AccessToken,
  openF1AuthConfigured,
  openF1MqttUsername,
} from "@/lib/openf1Auth";
import type {
  F1Interval,
  F1LiveStreamEvent,
  F1LocationPoint,
  F1Position,
  RaceControlMessage,
} from "@/types/f1";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPENF1_MQTT_URL = "wss://mqtt.openf1.org:8084/mqtt";
const OPENF1_TOPICS = ["v1/location", "v1/position", "v1/intervals", "v1/race_control"];
const encoder = new TextEncoder();

type SourceRecord = Record<string, unknown>;

function numberValue(record: SourceRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecords(payload: unknown): SourceRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is SourceRecord => Boolean(item) && typeof item === "object");
  }

  if (payload && typeof payload === "object") {
    return [payload as SourceRecord];
  }

  return [];
}

function matchesSession(
  record: SourceRecord,
  sessionKey: number,
  meetingKey: number | null,
): boolean {
  const recordSessionKey = numberValue(record, "session_key");
  const recordMeetingKey = numberValue(record, "meeting_key");

  if (recordSessionKey !== sessionKey) {
    return false;
  }

  return meetingKey === null || recordMeetingKey === null || recordMeetingKey === meetingKey;
}

function streamEventFor(
  topic: string,
  record: SourceRecord,
): F1LiveStreamEvent | null {
  const generatedAt = new Date().toISOString();

  if (topic.endsWith("/location")) {
    const data = normalizeLocationPoint(record);
    return isValidLocation(data) ? { type: "location", generatedAt, data } : null;
  }

  if (topic.endsWith("/position")) {
    const data = normalizePosition(record);
    return isValidPosition(data) ? { type: "position", generatedAt, data } : null;
  }

  if (topic.endsWith("/intervals")) {
    const data = normalizeInterval(record);
    return isValidInterval(data) ? { type: "interval", generatedAt, data } : null;
  }

  if (topic.endsWith("/race_control")) {
    const data = normalizeRaceControlMessage(record);
    return isValidRaceControl(data) ? { type: "race-control", generatedAt, data } : null;
  }

  return null;
}

function isValidLocation(data: F1LocationPoint): boolean {
  return (
    data.sessionKey > 0 &&
    data.driverNumber > 0 &&
    Boolean(data.date) &&
    Number.isFinite(data.x) &&
    Number.isFinite(data.y)
  );
}

function isValidPosition(data: F1Position): boolean {
  return data.sessionKey > 0 && data.driverNumber > 0 && data.position > 0;
}

function isValidInterval(data: F1Interval): boolean {
  return data.sessionKey > 0 && data.driverNumber > 0;
}

function isValidRaceControl(data: RaceControlMessage): boolean {
  return data.sessionKey > 0 && Boolean(data.date) && Boolean(data.message);
}

function parseSessionParam(url: URL): number | null {
  const value = Number(url.searchParams.get("session_key"));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseMeetingParam(url: URL): number | null {
  const value = Number(url.searchParams.get("meeting_key"));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function clientIdFor(sessionKey: number): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `apex-live-track-${sessionKey}-${suffix}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionKey = parseSessionParam(url);
  const meetingKey = parseMeetingParam(url);

  if (!sessionKey) {
    return new Response("Missing session_key", { status: 400 });
  }

  if (!openF1AuthConfigured()) {
    return new Response("OpenF1 auth is not configured", { status: 401 });
  }

  const accessToken = await getOpenF1AccessToken();
  if (!accessToken) {
    return new Response("Unable to obtain OpenF1 access token", { status: 401 });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let client: MqttClient | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      function send(event: F1LiveStreamEvent) {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(
            encoder.encode(`event: f1\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          cleanup();
        }
      }

      function sendStatus(
        status: Extract<F1LiveStreamEvent, { type: "status" }>["data"]["status"],
        message?: string,
      ) {
        send({
          type: "status",
          generatedAt: new Date().toISOString(),
          data: {
            status,
            message,
          },
        });
      }

      function cleanup() {
        if (closed) {
          return;
        }

        closed = true;

        if (heartbeat) {
          clearInterval(heartbeat);
        }

        if (client) {
          client.end(true);
        }

        try {
          controller.close();
        } catch {
          // The stream can already be closed when the browser disconnects.
        }
      }

      request.signal.addEventListener("abort", cleanup, { once: true });
      heartbeat = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(`: heartbeat ${Date.now()}\n\n`));
          } catch {
            cleanup();
          }
        }
      }, 15000);

      client = mqtt.connect(OPENF1_MQTT_URL, {
        clean: true,
        clientId: clientIdFor(sessionKey),
        connectTimeout: 10000,
        password: accessToken,
        protocolVersion: 5,
        reconnectPeriod: 4000,
        username: openF1MqttUsername(),
      });

      client.on("connect", () => {
        sendStatus("connected");
        client?.subscribe(OPENF1_TOPICS, { qos: 0 }, (error) => {
          if (error) {
            sendStatus("error", "OpenF1 stream subscription failed.");
            return;
          }

          sendStatus("subscribed");
        });
      });

      client.on("message", (topic, payload) => {
        let parsed: unknown;

        try {
          parsed = JSON.parse(payload.toString("utf8"));
        } catch {
          return;
        }

        for (const record of asRecords(parsed)) {
          if (!matchesSession(record, sessionKey, meetingKey)) {
            continue;
          }

          const event = streamEventFor(topic, record);
          if (event) {
            send(event);
          }
        }
      });

      client.on("error", () => {
        sendStatus("error", "OpenF1 stream temporarily unavailable.");
      });

      client.on("close", () => {
        sendStatus("closed");
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
