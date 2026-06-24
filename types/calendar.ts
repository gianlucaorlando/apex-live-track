export type RaceStatus = "past" | "today" | "upcoming";

export type F1CalendarSessionType =
  | "practice-1"
  | "practice-2"
  | "practice-3"
  | "sprint-qualifying"
  | "sprint-shootout"
  | "sprint"
  | "qualifying"
  | "race";

export interface F1CalendarSession {
  type: F1CalendarSessionType;
  date: string;
  time: string | null;
  startsAt: string;
  status: RaceStatus;
}

export interface RacePodiumDriver {
  position: number;
  code: string;
  givenName: string;
  familyName: string;
  constructorName: string;
  points: number | null;
  time: string | null;
  wikipediaUrl: string | null;
}

export interface F1CalendarRace {
  season: number;
  round: number;
  raceName: string;
  circuitName: string;
  locality: string;
  country: string;
  date: string;
  time: string | null;
  startsAt: string;
  laps: number | null;
  status: RaceStatus;
  wikipediaUrl: string | null;
  circuitWikipediaUrl: string | null;
  sessions: F1CalendarSession[];
  podium: RacePodiumDriver[];
}

export interface F1CalendarPayload {
  season: number;
  races: F1CalendarRace[];
  generatedAt: string;
  source: "jolpica" | "fallback";
}

export interface F1CalendarApiResponse {
  data: F1CalendarPayload | null;
  meta: {
    generatedAt: string;
    partial: boolean;
    messages: string[];
  };
}
