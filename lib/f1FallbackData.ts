import {
  circuitName,
  countryName,
  placeName,
  raceName,
  type Locale,
} from "@/lib/i18n";
import type {
  F1CalendarApiResponse,
  F1CalendarRace,
  F1CalendarSession,
  F1CalendarSessionType,
  RacePodiumDriver,
  RaceStatus,
} from "@/types/calendar";
import type {
  SeasonConstructorStanding,
  SeasonDriverStanding,
  SeasonStandingsApiResponse,
} from "@/types/seasonStandings";

interface FallbackRaceSeed {
  round: number;
  raceName: string;
  circuitName: string;
  locality: string;
  country: string;
  weekendStart: string;
  raceDate: string;
  sprint?: boolean;
  podium?: RacePodiumDriver[];
}

const FALLBACK_SEASON = 2026;
const FALLBACK_ROUND = 7;

function dateStartsAt(date: string): string {
  return new Date(`${date}T12:00:00Z`).toISOString();
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function sameUtcDay(first: Date, second: Date): boolean {
  return (
    first.getUTCFullYear() === second.getUTCFullYear() &&
    first.getUTCMonth() === second.getUTCMonth() &&
    first.getUTCDate() === second.getUTCDate()
  );
}

function raceStatus(startsAt: string, now = new Date()): RaceStatus {
  const startDate = new Date(startsAt);

  if (startDate.getTime() < now.getTime()) {
    return "past";
  }

  return sameUtcDay(startDate, now) ? "today" : "upcoming";
}

function session(type: F1CalendarSessionType, date: string): F1CalendarSession {
  const startsAt = dateStartsAt(date);

  return {
    type,
    date,
    time: null,
    startsAt,
    status: raceStatus(startsAt),
  };
}

function sessionsForRace(race: FallbackRaceSeed): F1CalendarSession[] {
  const saturday = addDays(race.weekendStart, 1);

  if (race.sprint) {
    return [
      session("practice-1", race.weekendStart),
      session("sprint-qualifying", race.weekendStart),
      session("sprint", saturday),
      session("qualifying", saturday),
      session("race", race.raceDate),
    ];
  }

  return [
    session("practice-1", race.weekendStart),
    session("practice-2", race.weekendStart),
    session("practice-3", saturday),
    session("qualifying", saturday),
    session("race", race.raceDate),
  ];
}

function podiumDriver(
  position: number,
  code: string,
  givenName: string,
  familyName: string,
  constructorName: string,
  time: string,
): RacePodiumDriver {
  return {
    position,
    code,
    givenName,
    familyName,
    constructorName,
    points: null,
    time,
    wikipediaUrl: null,
  };
}

const FALLBACK_RACES: FallbackRaceSeed[] = [
  {
    round: 1,
    raceName: "Australian Grand Prix",
    circuitName: "Albert Park Circuit",
    locality: "Melbourne",
    country: "Australia",
    weekendStart: "2026-03-06",
    raceDate: "2026-03-08",
    podium: [
      podiumDriver(1, "RUS", "George", "Russell", "Mercedes", "1:23:06.801"),
      podiumDriver(2, "ANT", "Kimi", "Antonelli", "Mercedes", "+2.974"),
      podiumDriver(3, "LEC", "Charles", "Leclerc", "Ferrari", "+15.519"),
    ],
  },
  {
    round: 2,
    raceName: "Chinese Grand Prix",
    circuitName: "Shanghai International Circuit",
    locality: "Shanghai",
    country: "China",
    weekendStart: "2026-03-13",
    raceDate: "2026-03-15",
    sprint: true,
    podium: [
      podiumDriver(1, "ANT", "Kimi", "Antonelli", "Mercedes", "1:33:15.607"),
      podiumDriver(2, "RUS", "George", "Russell", "Mercedes", "+5.515"),
      podiumDriver(3, "HAM", "Lewis", "Hamilton", "Ferrari", "+25.267"),
    ],
  },
  {
    round: 3,
    raceName: "Japanese Grand Prix",
    circuitName: "Suzuka Circuit",
    locality: "Suzuka",
    country: "Japan",
    weekendStart: "2026-03-27",
    raceDate: "2026-03-29",
    podium: [
      podiumDriver(1, "ANT", "Kimi", "Antonelli", "Mercedes", "1:28:03.403"),
      podiumDriver(2, "PIA", "Oscar", "Piastri", "McLaren", "+13.722"),
      podiumDriver(3, "LEC", "Charles", "Leclerc", "Ferrari", "+15.270"),
    ],
  },
  {
    round: 4,
    raceName: "Miami Grand Prix",
    circuitName: "Miami International Autodrome",
    locality: "Miami",
    country: "United States",
    weekendStart: "2026-05-01",
    raceDate: "2026-05-03",
    sprint: true,
    podium: [
      podiumDriver(1, "ANT", "Kimi", "Antonelli", "Mercedes", "1:33:19.273"),
      podiumDriver(2, "NOR", "Lando", "Norris", "McLaren", "+3.264"),
      podiumDriver(3, "PIA", "Oscar", "Piastri", "McLaren", "+27.092"),
    ],
  },
  {
    round: 5,
    raceName: "Canadian Grand Prix",
    circuitName: "Circuit Gilles Villeneuve",
    locality: "Montreal",
    country: "Canada",
    weekendStart: "2026-05-22",
    raceDate: "2026-05-24",
    sprint: true,
    podium: [
      podiumDriver(1, "ANT", "Kimi", "Antonelli", "Mercedes", "1:28:15.758"),
      podiumDriver(2, "HAM", "Lewis", "Hamilton", "Ferrari", "+10.768"),
      podiumDriver(3, "VER", "Max", "Verstappen", "Red Bull Racing", "+11.276"),
    ],
  },
  {
    round: 6,
    raceName: "Monaco Grand Prix",
    circuitName: "Circuit de Monaco",
    locality: "Monaco",
    country: "Monaco",
    weekendStart: "2026-06-05",
    raceDate: "2026-06-07",
    podium: [
      podiumDriver(1, "ANT", "Kimi", "Antonelli", "Mercedes", "2:23:31.243"),
      podiumDriver(2, "HAM", "Lewis", "Hamilton", "Ferrari", "+6.271"),
      podiumDriver(3, "GAS", "Pierre", "Gasly", "Alpine", "+20.369"),
    ],
  },
  {
    round: 7,
    raceName: "Barcelona-Catalunya Grand Prix",
    circuitName: "Circuit de Barcelona-Catalunya",
    locality: "Barcelona",
    country: "Spain",
    weekendStart: "2026-06-12",
    raceDate: "2026-06-14",
    podium: [
      podiumDriver(1, "HAM", "Lewis", "Hamilton", "Ferrari", "1:32:28.105"),
      podiumDriver(2, "RUS", "George", "Russell", "Mercedes", "+19.561"),
      podiumDriver(3, "NOR", "Lando", "Norris", "McLaren", "+23.719"),
    ],
  },
  {
    round: 8,
    raceName: "Austrian Grand Prix",
    circuitName: "Red Bull Ring",
    locality: "Spielberg",
    country: "Austria",
    weekendStart: "2026-06-26",
    raceDate: "2026-06-28",
  },
  {
    round: 9,
    raceName: "British Grand Prix",
    circuitName: "Silverstone Circuit",
    locality: "Silverstone",
    country: "Great Britain",
    weekendStart: "2026-07-03",
    raceDate: "2026-07-05",
    sprint: true,
  },
  {
    round: 10,
    raceName: "Belgian Grand Prix",
    circuitName: "Circuit de Spa-Francorchamps",
    locality: "Spa-Francorchamps",
    country: "Belgium",
    weekendStart: "2026-07-17",
    raceDate: "2026-07-19",
  },
  {
    round: 11,
    raceName: "Hungarian Grand Prix",
    circuitName: "Hungaroring",
    locality: "Budapest",
    country: "Hungary",
    weekendStart: "2026-07-24",
    raceDate: "2026-07-26",
  },
  {
    round: 12,
    raceName: "Dutch Grand Prix",
    circuitName: "Circuit Zandvoort",
    locality: "Zandvoort",
    country: "Netherlands",
    weekendStart: "2026-08-21",
    raceDate: "2026-08-23",
    sprint: true,
  },
  {
    round: 13,
    raceName: "Italian Grand Prix",
    circuitName: "Autodromo Nazionale Monza",
    locality: "Monza",
    country: "Italy",
    weekendStart: "2026-09-04",
    raceDate: "2026-09-06",
  },
  {
    round: 14,
    raceName: "Spanish Grand Prix",
    circuitName: "Madring",
    locality: "Madrid",
    country: "Spain",
    weekendStart: "2026-09-11",
    raceDate: "2026-09-13",
  },
  {
    round: 15,
    raceName: "Azerbaijan Grand Prix",
    circuitName: "Baku City Circuit",
    locality: "Baku",
    country: "Azerbaijan",
    weekendStart: "2026-09-24",
    raceDate: "2026-09-26",
  },
  {
    round: 16,
    raceName: "Singapore Grand Prix",
    circuitName: "Marina Bay Street Circuit",
    locality: "Singapore",
    country: "Singapore",
    weekendStart: "2026-10-09",
    raceDate: "2026-10-11",
    sprint: true,
  },
  {
    round: 17,
    raceName: "United States Grand Prix",
    circuitName: "Circuit of The Americas",
    locality: "Austin",
    country: "United States",
    weekendStart: "2026-10-23",
    raceDate: "2026-10-25",
  },
  {
    round: 18,
    raceName: "Mexico City Grand Prix",
    circuitName: "Autodromo Hermanos Rodriguez",
    locality: "Mexico City",
    country: "Mexico",
    weekendStart: "2026-10-30",
    raceDate: "2026-11-01",
  },
  {
    round: 19,
    raceName: "Sao Paulo Grand Prix",
    circuitName: "Autodromo Jose Carlos Pace",
    locality: "Sao Paulo",
    country: "Brazil",
    weekendStart: "2026-11-06",
    raceDate: "2026-11-08",
  },
  {
    round: 20,
    raceName: "Las Vegas Grand Prix",
    circuitName: "Las Vegas Strip Circuit",
    locality: "Las Vegas",
    country: "United States",
    weekendStart: "2026-11-19",
    raceDate: "2026-11-21",
  },
  {
    round: 21,
    raceName: "Qatar Grand Prix",
    circuitName: "Lusail International Circuit",
    locality: "Lusail",
    country: "Qatar",
    weekendStart: "2026-11-27",
    raceDate: "2026-11-29",
  },
  {
    round: 22,
    raceName: "Abu Dhabi Grand Prix",
    circuitName: "Yas Marina Circuit",
    locality: "Abu Dhabi",
    country: "United Arab Emirates",
    weekendStart: "2026-12-04",
    raceDate: "2026-12-06",
  },
];

const FALLBACK_DRIVERS: SeasonDriverStanding[] = [
  {
    position: 1,
    positionText: "1",
    points: 156,
    wins: 5,
    driverId: "antonelli",
    permanentNumber: "12",
    code: "ANT",
    givenName: "Kimi",
    familyName: "Antonelli",
    nationality: "Italian",
    constructorId: "mercedes",
    constructorName: "Mercedes",
    constructorNationality: "German",
    wikipediaUrl: null,
  },
  {
    position: 2,
    positionText: "2",
    points: 115,
    wins: 1,
    driverId: "hamilton",
    permanentNumber: "44",
    code: "HAM",
    givenName: "Lewis",
    familyName: "Hamilton",
    nationality: "British",
    constructorId: "ferrari",
    constructorName: "Ferrari",
    constructorNationality: "Italian",
    wikipediaUrl: null,
  },
  {
    position: 3,
    positionText: "3",
    points: 106,
    wins: 1,
    driverId: "russell",
    permanentNumber: "63",
    code: "RUS",
    givenName: "George",
    familyName: "Russell",
    nationality: "British",
    constructorId: "mercedes",
    constructorName: "Mercedes",
    constructorNationality: "German",
    wikipediaUrl: null,
  },
  {
    position: 4,
    positionText: "4",
    points: 75,
    wins: 0,
    driverId: "leclerc",
    permanentNumber: "16",
    code: "LEC",
    givenName: "Charles",
    familyName: "Leclerc",
    nationality: "Monegasque",
    constructorId: "ferrari",
    constructorName: "Ferrari",
    constructorNationality: "Italian",
    wikipediaUrl: null,
  },
  {
    position: 5,
    positionText: "5",
    points: 73,
    wins: 0,
    driverId: "norris",
    permanentNumber: "4",
    code: "NOR",
    givenName: "Lando",
    familyName: "Norris",
    nationality: "British",
    constructorId: "mclaren",
    constructorName: "McLaren",
    constructorNationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 6,
    positionText: "6",
    points: 68,
    wins: 0,
    driverId: "piastri",
    permanentNumber: "81",
    code: "PIA",
    givenName: "Oscar",
    familyName: "Piastri",
    nationality: "Australian",
    constructorId: "mclaren",
    constructorName: "McLaren",
    constructorNationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 7,
    positionText: "7",
    points: 55,
    wins: 0,
    driverId: "verstappen",
    permanentNumber: "1",
    code: "VER",
    givenName: "Max",
    familyName: "Verstappen",
    nationality: "Dutch",
    constructorId: "red_bull",
    constructorName: "Red Bull Racing",
    constructorNationality: "Austrian",
    wikipediaUrl: null,
  },
  {
    position: 8,
    positionText: "8",
    points: 41,
    wins: 0,
    driverId: "gasly",
    permanentNumber: "10",
    code: "GAS",
    givenName: "Pierre",
    familyName: "Gasly",
    nationality: "French",
    constructorId: "alpine",
    constructorName: "Alpine",
    constructorNationality: "French",
    wikipediaUrl: null,
  },
  {
    position: 9,
    positionText: "9",
    points: 34,
    wins: 0,
    driverId: "hadjar",
    permanentNumber: "6",
    code: "HAD",
    givenName: "Isack",
    familyName: "Hadjar",
    nationality: "French",
    constructorId: "red_bull",
    constructorName: "Red Bull Racing",
    constructorNationality: "Austrian",
    wikipediaUrl: null,
  },
  {
    position: 10,
    positionText: "10",
    points: 28,
    wins: 0,
    driverId: "lawson",
    permanentNumber: "30",
    code: "LAW",
    givenName: "Liam",
    familyName: "Lawson",
    nationality: "New Zealander",
    constructorId: "racing_bulls",
    constructorName: "Racing Bulls",
    constructorNationality: "Italian",
    wikipediaUrl: null,
  },
  {
    position: 11,
    positionText: "11",
    points: 18,
    wins: 0,
    driverId: "bearman",
    permanentNumber: "87",
    code: "BEA",
    givenName: "Oliver",
    familyName: "Bearman",
    nationality: "British",
    constructorId: "haas",
    constructorName: "Haas F1 Team",
    constructorNationality: "American",
    wikipediaUrl: null,
  },
  {
    position: 12,
    positionText: "12",
    points: 16,
    wins: 0,
    driverId: "colapinto",
    permanentNumber: "43",
    code: "COL",
    givenName: "Franco",
    familyName: "Colapinto",
    nationality: "Argentine",
    constructorId: "alpine",
    constructorName: "Alpine",
    constructorNationality: "French",
    wikipediaUrl: null,
  },
  {
    position: 13,
    positionText: "13",
    points: 13,
    wins: 0,
    driverId: "lindblad",
    permanentNumber: null,
    code: "LIN",
    givenName: "Arvid",
    familyName: "Lindblad",
    nationality: "British",
    constructorId: "racing_bulls",
    constructorName: "Racing Bulls",
    constructorNationality: "Italian",
    wikipediaUrl: null,
  },
  {
    position: 14,
    positionText: "14",
    points: 6,
    wins: 0,
    driverId: "sainz",
    permanentNumber: "55",
    code: "SAI",
    givenName: "Carlos",
    familyName: "Sainz",
    nationality: "Spanish",
    constructorId: "williams",
    constructorName: "Williams",
    constructorNationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 15,
    positionText: "15",
    points: 5,
    wins: 0,
    driverId: "albon",
    permanentNumber: "23",
    code: "ALB",
    givenName: "Alexander",
    familyName: "Albon",
    nationality: "Thai",
    constructorId: "williams",
    constructorName: "Williams",
    constructorNationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 16,
    positionText: "16",
    points: 3,
    wins: 0,
    driverId: "ocon",
    permanentNumber: "31",
    code: "OCO",
    givenName: "Esteban",
    familyName: "Ocon",
    nationality: "French",
    constructorId: "haas",
    constructorName: "Haas F1 Team",
    constructorNationality: "American",
    wikipediaUrl: null,
  },
  {
    position: 17,
    positionText: "17",
    points: 2,
    wins: 0,
    driverId: "bortoleto",
    permanentNumber: "5",
    code: "BOR",
    givenName: "Gabriel",
    familyName: "Bortoleto",
    nationality: "Brazilian",
    constructorId: "audi",
    constructorName: "Audi",
    constructorNationality: "German",
    wikipediaUrl: null,
  },
  {
    position: 18,
    positionText: "18",
    points: 1,
    wins: 0,
    driverId: "alonso",
    permanentNumber: "14",
    code: "ALO",
    givenName: "Fernando",
    familyName: "Alonso",
    nationality: "Spanish",
    constructorId: "aston_martin",
    constructorName: "Aston Martin",
    constructorNationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 19,
    positionText: "19",
    points: 0,
    wins: 0,
    driverId: "hulkenberg",
    permanentNumber: "27",
    code: "HUL",
    givenName: "Nico",
    familyName: "Hulkenberg",
    nationality: "German",
    constructorId: "audi",
    constructorName: "Audi",
    constructorNationality: "German",
    wikipediaUrl: null,
  },
  {
    position: 20,
    positionText: "20",
    points: 0,
    wins: 0,
    driverId: "bottas",
    permanentNumber: "77",
    code: "BOT",
    givenName: "Valtteri",
    familyName: "Bottas",
    nationality: "Finnish",
    constructorId: "cadillac",
    constructorName: "Cadillac",
    constructorNationality: "American",
    wikipediaUrl: null,
  },
  {
    position: 21,
    positionText: "21",
    points: 0,
    wins: 0,
    driverId: "perez",
    permanentNumber: "11",
    code: "PER",
    givenName: "Sergio",
    familyName: "Perez",
    nationality: "Mexican",
    constructorId: "cadillac",
    constructorName: "Cadillac",
    constructorNationality: "American",
    wikipediaUrl: null,
  },
  {
    position: 22,
    positionText: "22",
    points: 0,
    wins: 0,
    driverId: "stroll",
    permanentNumber: "18",
    code: "STR",
    givenName: "Lance",
    familyName: "Stroll",
    nationality: "Canadian",
    constructorId: "aston_martin",
    constructorName: "Aston Martin",
    constructorNationality: "British",
    wikipediaUrl: null,
  },
];

const FALLBACK_CONSTRUCTORS: SeasonConstructorStanding[] = [
  {
    position: 1,
    positionText: "1",
    points: 262,
    wins: 6,
    constructorId: "mercedes",
    name: "Mercedes",
    nationality: "German",
    wikipediaUrl: null,
  },
  {
    position: 2,
    positionText: "2",
    points: 190,
    wins: 1,
    constructorId: "ferrari",
    name: "Ferrari",
    nationality: "Italian",
    wikipediaUrl: null,
  },
  {
    position: 3,
    positionText: "3",
    points: 141,
    wins: 0,
    constructorId: "mclaren",
    name: "McLaren",
    nationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 4,
    positionText: "4",
    points: 89,
    wins: 0,
    constructorId: "red_bull",
    name: "Red Bull Racing",
    nationality: "Austrian",
    wikipediaUrl: null,
  },
  {
    position: 5,
    positionText: "5",
    points: 57,
    wins: 0,
    constructorId: "alpine",
    name: "Alpine",
    nationality: "French",
    wikipediaUrl: null,
  },
  {
    position: 6,
    positionText: "6",
    points: 41,
    wins: 0,
    constructorId: "racing_bulls",
    name: "Racing Bulls",
    nationality: "Italian",
    wikipediaUrl: null,
  },
  {
    position: 7,
    positionText: "7",
    points: 21,
    wins: 0,
    constructorId: "haas",
    name: "Haas F1 Team",
    nationality: "American",
    wikipediaUrl: null,
  },
  {
    position: 8,
    positionText: "8",
    points: 11,
    wins: 0,
    constructorId: "williams",
    name: "Williams",
    nationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 9,
    positionText: "9",
    points: 2,
    wins: 0,
    constructorId: "audi",
    name: "Audi",
    nationality: "German",
    wikipediaUrl: null,
  },
  {
    position: 10,
    positionText: "10",
    points: 1,
    wins: 0,
    constructorId: "aston_martin",
    name: "Aston Martin",
    nationality: "British",
    wikipediaUrl: null,
  },
  {
    position: 11,
    positionText: "11",
    points: 0,
    wins: 0,
    constructorId: "cadillac",
    name: "Cadillac",
    nationality: "American",
    wikipediaUrl: null,
  },
];

export function isFallbackSeason(seasonPath: string): boolean {
  return seasonPath === "current" || seasonPath === String(FALLBACK_SEASON);
}

export function fallbackProviderMessage(locale: Locale): string {
  if (locale === "en") {
    return "Jolpica is temporarily unavailable: showing Formula1.com fallback data.";
  }

  if (locale === "de") {
    return "Jolpica ist voruebergehend nicht verfuegbar: Formula1.com-Fallbackdaten werden angezeigt.";
  }

  return "Jolpica non disponibile: mostro dati fallback Formula1.com.";
}

export function createFallbackCalendarPayload(locale: Locale): F1CalendarApiResponse {
  const generatedAt = new Date().toISOString();
  const races = FALLBACK_RACES.map((race): F1CalendarRace => {
    const startsAt = dateStartsAt(race.raceDate);

    return {
      season: FALLBACK_SEASON,
      round: race.round,
      raceName: raceName(locale, race.raceName, race.country),
      circuitName: circuitName(locale, race.circuitName),
      locality: placeName(locale, race.locality),
      country: countryName(locale, race.country),
      date: race.raceDate,
      time: null,
      startsAt,
      status: raceStatus(startsAt),
      wikipediaUrl: null,
      circuitWikipediaUrl: null,
      sessions: sessionsForRace(race),
      podium: raceStatus(startsAt) === "past" ? race.podium ?? [] : [],
    };
  });

  return {
    data: {
      season: FALLBACK_SEASON,
      races,
      generatedAt,
      source: "fallback",
    },
    meta: {
      generatedAt,
      partial: true,
      messages: [fallbackProviderMessage(locale)],
    },
  };
}

export function createFallbackSeasonStandingsPayload(
  locale: Locale,
): SeasonStandingsApiResponse {
  const generatedAt = new Date().toISOString();

  return {
    data: {
      season: FALLBACK_SEASON,
      round: FALLBACK_ROUND,
      drivers: FALLBACK_DRIVERS,
      constructors: FALLBACK_CONSTRUCTORS,
      generatedAt,
      source: "fallback",
    },
    meta: {
      generatedAt,
      partial: true,
      messages: [fallbackProviderMessage(locale)],
    },
  };
}
