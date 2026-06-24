export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "fog"
  | "rain"
  | "storm"
  | "snow"
  | "unknown";

export interface RaceWeather {
  locationName: string;
  country: string;
  latitude: number;
  longitude: number;
  observedAt: string;
  temperatureC: number | null;
  humidityPercent: number | null;
  precipitationMm: number | null;
  rainMm: number | null;
  cloudCoverPercent: number | null;
  windSpeedKmh: number | null;
  weatherCode: number | null;
  condition: WeatherCondition;
  description: string;
  attribution: string;
}

export interface WeatherApiResponse {
  data: RaceWeather | null;
  meta: {
    generatedAt: string;
    partial: boolean;
    messages: string[];
  };
}
