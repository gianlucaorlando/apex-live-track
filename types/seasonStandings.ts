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

export interface SeasonStandingsPayload {
  season: number;
  round: number;
  drivers: SeasonDriverStanding[];
  constructors: SeasonConstructorStanding[];
  generatedAt: string;
  source: "jolpica";
}

export interface SeasonStandingsApiResponse {
  data: SeasonStandingsPayload | null;
  meta: {
    generatedAt: string;
    partial: boolean;
    messages: string[];
  };
}
