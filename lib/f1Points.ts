import type { SeasonConstructorPointsAvailability } from "@/types/seasonStandings";

const GRAND_PRIX_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const SCORING_CARS_PER_CONSTRUCTOR = 2;

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function maxConstructorPointsFor(points: number[]): number {
  return sum(points.slice(0, SCORING_CARS_PER_CONSTRUCTOR));
}

export function constructorPointsAvailabilityFor(
  raceCount: number,
  sprintCount: number,
): SeasonConstructorPointsAvailability {
  const grandPrixPointsPool = raceCount * sum(GRAND_PRIX_POINTS);
  const sprintPointsPool = sprintCount * sum(SPRINT_POINTS);
  const maxGrandPrixPointsPerConstructor = maxConstructorPointsFor(GRAND_PRIX_POINTS);
  const maxSprintPointsPerConstructor = maxConstructorPointsFor(SPRINT_POINTS);

  return {
    raceCount,
    sprintCount,
    grandPrixPointsPool,
    sprintPointsPool,
    totalPointsPool: grandPrixPointsPool + sprintPointsPool,
    maxSingleConstructorPoints:
      raceCount * maxGrandPrixPointsPerConstructor +
      sprintCount * maxSprintPointsPerConstructor,
    maxGrandPrixPointsPerConstructor,
    maxSprintPointsPerConstructor,
  };
}

export interface TitleStatus {
  decided: boolean;
  /** Punti ancora assegnabili a un singolo concorrente (stima prudente). */
  pointsRemaining: number;
  lead: number;
}

/**
 * Titolo deciso quando il vantaggio sul secondo supera i punti ancora in palio
 * (gare e sprint rimaste da calendario; senza calendario si assume il caso peggiore).
 */
export function titleStatus(
  leaderPoints: number,
  secondPoints: number,
  availability: SeasonConstructorPointsAvailability | null,
  completedRounds: number,
  kind: "driver" | "constructor",
): TitleStatus {
  const lead = leaderPoints - secondPoints;

  if (!availability) {
    return { decided: false, pointsRemaining: Number.POSITIVE_INFINITY, lead };
  }

  // Preferisce le gare/sprint rimaste da calendario; altrimenti stima prudente.
  const racesLeft = availability.racesRemaining ?? Math.max(availability.raceCount - completedRounds, 0);
  const sprintsLeft = availability.sprintsRemaining ?? Math.min(availability.sprintCount, racesLeft);
  const perRace = kind === "driver" ? GRAND_PRIX_POINTS[0] : availability.maxGrandPrixPointsPerConstructor;
  const perSprint = kind === "driver" ? SPRINT_POINTS[0] : availability.maxSprintPointsPerConstructor;
  const pointsRemaining = racesLeft * perRace + sprintsLeft * perSprint;

  return { decided: lead > pointsRemaining, pointsRemaining, lead };
}
