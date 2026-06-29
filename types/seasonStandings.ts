export interface SeasonDriverStanding {
  position: number;
  positionText: string;
  points: number;
  wins: number;
  driverId: string;
  permanentNumber: string | null;
  code: string;
  givenName: string;
  familyName: string;
  nationality: string | null;
  constructorId: string;
  constructorName: string;
  constructorNationality: string | null;
  wikipediaUrl: string | null;
}

export interface SeasonConstructorStanding {
  position: number;
  positionText: string;
  points: number;
  wins: number;
  constructorId: string;
  name: string;
  nationality: string | null;
  wikipediaUrl: string | null;
}

export interface SeasonConstructorPointsAvailability {
  raceCount: number;
  sprintCount: number;
  grandPrixPointsPool: number;
  sprintPointsPool: number;
  totalPointsPool: number;
  maxSingleConstructorPoints: number;
  maxGrandPrixPointsPerConstructor: number;
  maxSprintPointsPerConstructor: number;
}

export interface SeasonStandingsPayload {
  season: number;
  round: number;
  drivers: SeasonDriverStanding[];
  constructors: SeasonConstructorStanding[];
  constructorPointsAvailable: SeasonConstructorPointsAvailability | null;
  generatedAt: string;
  source: "jolpica" | "fallback";
}

export interface SeasonStandingsApiResponse {
  data: SeasonStandingsPayload | null;
  meta: {
    generatedAt: string;
    partial: boolean;
    messages: string[];
  };
}
