export interface DriverProfile {
  title: string;
  description: string | null;
  extract: string;
  thumbnailUrl: string | null;
  pageUrl: string;
  wins: number | null;
  worldChampionships: number | null;
  wikidataId: string | null;
  attribution: string;
}

export interface DriverProfileApiResponse {
  data: DriverProfile | null;
  meta: {
    generatedAt: string;
    partial: boolean;
    messages: string[];
  };
}
