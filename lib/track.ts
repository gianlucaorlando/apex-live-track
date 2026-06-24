import type {
  F1LocationPoint,
  NormalizedTrackPoint,
  TrackBounds,
  TrackPoint,
} from "@/types/f1";

export interface TrackNormalizer {
  bounds: TrackBounds | null;
  map: (point: TrackPoint) => NormalizedTrackPoint | null;
}

function isUsablePoint(point: TrackPoint): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    !(point.x === 0 && point.y === 0)
  );
}

function pointTime(point: TrackPoint): number {
  if (!point.date) {
    return 0;
  }

  const time = new Date(point.date).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function getLatestLocationByDriver(
  points: F1LocationPoint[],
): Map<number, F1LocationPoint> {
  const latest = new Map<number, F1LocationPoint>();

  for (const point of points) {
    const current = latest.get(point.driverNumber);
    if (!current || pointTime(point) >= pointTime(current)) {
      latest.set(point.driverNumber, point);
    }
  }

  return latest;
}

export function dedupeNearPoints<T extends TrackPoint>(
  points: T[],
  tolerance: number,
): T[] {
  const result: T[] = [];
  let previous: T | null = null;

  for (const point of points) {
    if (!isUsablePoint(point)) {
      continue;
    }

    if (!previous) {
      result.push(point);
      previous = point;
      continue;
    }

    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    if (distance >= tolerance) {
      result.push(point);
      previous = point;
    }
  }

  return result;
}

export function buildTrackPolyline(points: TrackPoint[]): TrackPoint[] {
  const usable = points.filter(isUsablePoint);
  if (usable.length === 0) {
    return [];
  }

  const byDriver = new Map<number, TrackPoint[]>();
  for (const point of usable) {
    if (typeof point.driverNumber !== "number") {
      continue;
    }

    const driverPoints = byDriver.get(point.driverNumber) ?? [];
    driverPoints.push(point);
    byDriver.set(point.driverNumber, driverPoints);
  }

  const bestDriverTrace = [...byDriver.values()]
    .map((driverPoints) => [...driverPoints].sort((a, b) => pointTime(a) - pointTime(b)))
    .filter((driverPoints) => driverPoints.length >= 8)
    .sort((a, b) => traceCoverageScore(b) - traceCoverageScore(a))[0];

  const source =
    bestDriverTrace && bestDriverTrace.length >= 8
      ? bestDriverTrace
      : [...usable].sort((a, b) => pointTime(a) - pointTime(b));

  return dedupeNearPoints(source, 80);
}

function traceCoverageScore(points: TrackPoint[]): number {
  const usable = points.filter(isUsablePoint);

  if (usable.length === 0) {
    return 0;
  }

  const xs = usable.map((point) => point.x);
  const ys = usable.map((point) => point.y);
  const rangeX = Math.max(...xs) - Math.min(...xs);
  const rangeY = Math.max(...ys) - Math.min(...ys);

  return Math.hypot(rangeX, rangeY) + usable.length * 0.01;
}

export function createTrackNormalizer(
  points: TrackPoint[],
  width: number,
  height: number,
  padding: number,
): TrackNormalizer {
  const usable = points.filter(isUsablePoint);

  if (usable.length === 0) {
    return {
      bounds: null,
      map: () => null,
    };
  }

  const xs = usable.map((point) => point.x);
  const ys = usable.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = Math.max(maxX - minX, 1);
  const rangeY = Math.max(maxY - minY, 1);
  const drawableWidth = Math.max(width - padding * 2, 1);
  const drawableHeight = Math.max(height - padding * 2, 1);
  const scale = Math.min(drawableWidth / rangeX, drawableHeight / rangeY);
  const offsetX = (width - rangeX * scale) / 2;
  const offsetY = (height - rangeY * scale) / 2;

  return {
    bounds: {
      minX,
      maxX,
      minY,
      maxY,
      rangeX,
      rangeY,
    },
    map: (point: TrackPoint) => {
      if (!isUsablePoint(point)) {
        return null;
      }

      return {
        driverNumber: point.driverNumber,
        date: point.date,
        x: offsetX + (point.x - minX) * scale,
        y: height - (offsetY + (point.y - minY) * scale),
        rawX: point.x,
        rawY: point.y,
      };
    },
  };
}

export function normalizeTrackPoints(
  points: TrackPoint[],
  width: number,
  height: number,
  padding: number,
): NormalizedTrackPoint[] {
  const normalizer = createTrackNormalizer(points, width, height, padding);
  return points
    .map((point) => normalizer.map(point))
    .filter((point): point is NormalizedTrackPoint => point !== null);
}

export function locationToTrackPoint(point: F1LocationPoint): TrackPoint {
  return {
    driverNumber: point.driverNumber,
    date: point.date,
    x: point.x,
    y: point.y,
    z: point.z,
  };
}
