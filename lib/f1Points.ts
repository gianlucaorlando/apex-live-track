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
