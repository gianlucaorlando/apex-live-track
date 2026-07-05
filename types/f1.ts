export type F1SessionStatus =
  | "live"
  | "replay"
  | "finished"
  | "no-session-today"
  | "error";

export interface F1Session {
  sessionKey: number;
  meetingKey: number;
  sessionName: string;
  sessionType: string;
  dateStart: string;
  dateEnd: string;
  circuitKey: number | null;
  circuitShortName: string;
  countryCode: string;
  countryName: string;
  location: string;
  year: number;
  isCancelled: boolean;
  status: F1SessionStatus;
  isLive: boolean;
  isToday: boolean;
}

export interface F1Meeting {
  meetingKey: number;
  meetingName: string;
  meetingOfficialName: string;
  circuitKey: number | null;
  circuitShortName: string;
  circuitImage: string | null;
  circuitInfoUrl: string | null;
  circuitType: string | null;
  countryCode: string;
  countryName: string;
  location: string;
  dateStart: string;
  dateEnd: string;
  year: number;
}

export interface F1Driver {
  driverNumber: number;
  broadcastName: string;
  fullName: string;
  acronym: string;
  teamName: string;
  teamColour: string;
  firstName: string;
  lastName: string;
  headshotUrl: string | null;
  countryCode: string;
}

export interface F1LocationPoint {
  date: string;
  sessionKey: number;
  meetingKey: number;
  driverNumber: number;
  x: number;
  y: number;
  z: number | null;
}

export interface F1Position {
  date: string;
  sessionKey: number;
  meetingKey: number;
  driverNumber: number;
  position: number;
}

export type GapValue = number | string | null;

export interface F1Interval {
  date: string;
  sessionKey: number;
  meetingKey: number;
  driverNumber: number;
  gapToLeader: GapValue;
  interval: GapValue;
}

export interface F1Lap {
  dateStart: string | null;
  sessionKey: number;
  meetingKey: number;
  driverNumber: number;
  lapNumber: number;
}

export interface F1TyreStint {
  sessionKey: number;
  meetingKey: number;
  driverNumber: number;
  compound: string;
  stintNumber: number;
  lapStart: number | null;
  lapEnd: number | null;
  tyreAgeAtStart: number | null;
}

export interface F1SessionResult {
  sessionKey: number;
  meetingKey: number;
  driverNumber: number;
  position: number | null;
  gapToLeader: GapValue;
  duration: GapValue;
  numberOfLaps: number | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
}

export interface RaceControlMessage {
  date: string;
  sessionKey: number;
  meetingKey: number;
  category: string;
  message: string;
  driverNumber: number | null;
  flag: string | null;
  lapNumber: number | null;
  scope: string | null;
  sector: number | null;
  qualifyingPhase: string | null;
}

export type DriverStatus = "OUT" | "PIT" | "LAPPED";

export interface DriverTyreInfo {
  compound: string;
  stintNumber: number;
  lapStart: number | null;
  lapEnd: number | null;
  currentLap: number | null;
  ageLaps: number | null;
}

export interface LiveStandingRow {
  driverNumber: number;
  acronym: string;
  fullName: string;
  headshotUrl: string | null;
  teamName: string;
  teamColour: string;
  position: number | null;
  gap: string;
  interval: string;
  status: DriverStatus | null;
  tyre: DriverTyreInfo | null;
  currentLap: number | null;
  totalLaps: number | null;
  latestLocation: F1LocationPoint | null;
  updatedAt: string | null;
}

export interface TrackPoint {
  driverNumber?: number;
  date?: string;
  /** Cached epoch milliseconds for `date`, avoids re-parsing the ISO string on every hot-path lookup. */
  timeMs?: number;
  x: number;
  y: number;
  z?: number | null;
}

export interface FinishLinePoint {
  driverNumber?: number;
  date?: string;
  x: number;
  y: number;
  z?: number | null;
  source: "lap-start";
  confidence: "high" | "medium" | "low";
  lapNumber: number | null;
}

export interface NormalizedDriverPosition {
  driverNumber: number;
  acronym: string;
  fullName: string;
  headshotUrl: string | null;
  teamName: string;
  teamColour: string;
  position: number | null;
  gap: string;
  interval: string;
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  status: DriverStatus | null;
  tyre: DriverTyreInfo | null;
  currentLap: number | null;
  totalLaps: number | null;
}

export interface NormalizedTrackPoint {
  driverNumber?: number;
  date?: string;
  x: number;
  y: number;
  rawX: number;
  rawY: number;
}

export interface TrackBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  rangeX: number;
  rangeY: number;
}

export interface F1ApiMeta {
  generatedAt: string;
  source: "openf1";
  sessionKey: number | "latest";
  demo: boolean;
  replay: boolean;
  tokenConfigured: boolean;
  partial: boolean;
  messages: string[];
}

export interface F1ApiResponse<T> {
  data: T;
  meta: F1ApiMeta;
}

export interface StandingsPayload {
  rows: LiveStandingRow[];
  trackPoints: TrackPoint[];
}

export type F1LiveStreamEvent =
  | {
      type: "location";
      generatedAt: string;
      data: F1LocationPoint;
    }
  | {
      type: "position";
      generatedAt: string;
      data: F1Position;
    }
  | {
      type: "interval";
      generatedAt: string;
      data: F1Interval;
    }
  | {
      type: "race-control";
      generatedAt: string;
      data: RaceControlMessage;
    }
  | {
      type: "status";
      generatedAt: string;
      data: {
        status: "connected" | "subscribed" | "error" | "closed";
        message?: string;
      };
    };
