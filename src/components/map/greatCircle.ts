/**
 * Geodesic samples for globe arcs.
 *
 * A straight line in longitude cuts across the map. On the sphere the short
 * path is a great circle, and a segment that crosses the antimeridian has
 * to be split or MapLibre draws the long way around the world.
 */

const DEG = Math.PI / 180;

function toVector(lng: number, lat: number): [number, number, number] {
  const lambda = lng * DEG;
  const phi = lat * DEG;
  const cosPhi = Math.cos(phi);
  return [cosPhi * Math.cos(lambda), cosPhi * Math.sin(lambda), Math.sin(phi)];
}

function toLngLat(vector: [number, number, number]): [number, number] {
  const [x, y, z] = vector;
  return [
    Math.atan2(y, x) / DEG,
    Math.atan2(z, Math.hypot(x, y)) / DEG,
  ];
}

export function greatCircleSegments(
  from: [number, number],
  to: [number, number],
  steps = 72,
): [number, number][][] {
  const start = toVector(from[0], from[1]);
  const end = toVector(to[0], to[1]);
  const dot = Math.min(1, Math.max(-1, start[0] * end[0] + start[1] * end[1] + start[2] * end[2]));
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);
  const points: [number, number][] = [];

  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    if (sinOmega < 1e-6) {
      points.push(from);
      continue;
    }
    const weightStart = Math.sin((1 - t) * omega) / sinOmega;
    const weightEnd = Math.sin(t * omega) / sinOmega;
    points.push(
      toLngLat([
        start[0] * weightStart + end[0] * weightEnd,
        start[1] * weightStart + end[1] * weightEnd,
        start[2] * weightStart + end[2] * weightEnd,
      ]),
    );
  }

  const segments: [number, number][][] = [];
  let current: [number, number][] = [];
  for (const point of points) {
    const previous = current[current.length - 1];
    if (previous && Math.abs(point[0] - previous[0]) > 180) {
      if (current.length > 1) segments.push(current);
      current = [point];
      continue;
    }
    current.push(point);
  }
  if (current.length > 1) segments.push(current);
  return segments;
}
