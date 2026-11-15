/**
 * A small force layout for a few dozen topics.
 *
 * It runs in the panel, then stops, so a dragged arrangement stays put.
 * No physics library: the graph is a drawing, not a simulation product.
 */

export interface ForceBody {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  pinned: boolean;
}

export interface ForceLink {
  source: string;
  target: string;
  weight: number;
}

export function topicRadius(weight: number): number {
  return Math.max(9, Math.min(22, 8 + Math.sqrt(Math.max(weight, 1)) * 5.2));
}

export function seedBodies(
  nodes: readonly { id: string; r: number }[],
  width: number,
  height: number,
): ForceBody[] {
  const centerX = width / 2;
  const centerY = height / 2;
  const ring = Math.min(width, height) * 0.33;
  return nodes.map((node, index) => {
    const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2;
    return {
      id: node.id,
      x: centerX + Math.cos(angle) * ring,
      y: centerY + Math.sin(angle) * ring * 0.86,
      vx: 0,
      vy: 0,
      r: node.r,
      pinned: false,
    };
  });
}

/** One integration step. Returns kinetic energy so the caller knows when to rest. */
export function tickBodies(
  bodies: ForceBody[],
  links: readonly ForceLink[],
  width: number,
  height: number,
): number {
  const index = new Map(bodies.map((body) => [body.id, body]));

  for (let left = 0; left < bodies.length; left += 1) {
    for (let right = left + 1; right < bodies.length; right += 1) {
      const a = bodies[left];
      const b = bodies[right];
      let dx = a.x - b.x;
      let dy = a.y - b.y;
      let distanceSquared = dx * dx + dy * dy;
      if (distanceSquared < 1) {
        dx = 1;
        dy = 0;
        distanceSquared = 1;
      }
      const distance = Math.sqrt(distanceSquared);
      const repulsion = 2400 / distanceSquared;
      const ux = dx / distance;
      const uy = dy / distance;
      if (!a.pinned) {
        a.vx += ux * repulsion;
        a.vy += uy * repulsion;
      }
      if (!b.pinned) {
        b.vx -= ux * repulsion;
        b.vy -= uy * repulsion;
      }
      const minDistance = a.r + b.r + 34;
      if (distance < minDistance) {
        const push = (minDistance - distance) * 0.12;
        if (!a.pinned) {
          a.vx += ux * push;
          a.vy += uy * push;
        }
        if (!b.pinned) {
          b.vx -= ux * push;
          b.vy -= uy * push;
        }
      }
    }
  }

  for (const link of links) {
    const a = index.get(link.source);
    const b = index.get(link.target);
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const distance = Math.hypot(dx, dy) || 1;
    const rest = 104;
    const spring = (distance - rest) * 0.018 * Math.min(2.2, link.weight);
    const ux = dx / distance;
    const uy = dy / distance;
    if (!a.pinned) {
      a.vx += ux * spring;
      a.vy += uy * spring;
    }
    if (!b.pinned) {
      b.vx -= ux * spring;
      b.vy -= uy * spring;
    }
  }

  const centerX = width / 2;
  const centerY = height / 2;
  let energy = 0;
  for (const body of bodies) {
    if (body.pinned) {
      body.vx = 0;
      body.vy = 0;
      continue;
    }
    body.vx += (centerX - body.x) * 0.012;
    body.vy += (centerY - body.y) * 0.012;
    body.vx *= 0.7;
    body.vy *= 0.7;
    body.x += body.vx;
    body.y += body.vy;
    const padX = body.r + 36;
    const padY = body.r + 22;
    body.x = Math.max(padX, Math.min(width - padX, body.x));
    body.y = Math.max(padY, Math.min(height - padY, body.y));
    energy += body.vx * body.vx + body.vy * body.vy;
  }
  return energy;
}
