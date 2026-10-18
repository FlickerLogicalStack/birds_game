import type { Rng } from '../../utils/random';
import { CONFIG } from '../../../config';
import { __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';

export type Platform = {
  points: [number, number][];
};

export type Spot = {
  platform: number;
  x: number;
};

__opt_prepare_mutations(__opt_remember_shape<Spot>({ platform: 0, x: 0.5 }), ['platform', 'x']);

export const EDGE_MARGIN = CONFIG.platforms.edge_margin;
export const MIN_SPACING = CONFIG.platforms.min_spacing;
export const SPACING_HEIGHT = CONFIG.platforms.spacing_height;
const MAX_ATTEMPTS = 64;

export const platform_x0 = (p: Platform) => p.points[0]![0];

export const platform_x1 = (p: Platform) => p.points[p.points.length - 1]![0];

export const platform_y_at = (p: Platform, x: number) => {
  const points = p.points;

  for (let i = 1; i < points.length; i++) {
    const [bx, by] = points[i]!;

    if (x <= bx || i === points.length - 1) {
      const [ax, ay] = points[i - 1]!;

      return bx === ax ? ay : ay + ((by - ay) * (x - ax)) / (bx - ax);
    }
  }

  return points[0]![1];
};

export const slice_platform = (p: Platform, xa: number, xb: number): Platform => ({
  points: [
    [xa, platform_y_at(p, xa)],
    ...p.points.filter(([x]) => x > xa && x < xb),
    [xb, platform_y_at(p, xb)],
  ],
});

export const split_platform = (
  p: Platform,
  ok: (x: number) => boolean,
  step: number,
): Platform[] => {
  const out: Platform[] = [];
  const x0 = platform_x0(p);
  const x1 = platform_x1(p);
  let run_start: number | null = null;

  for (let x = x0; ; x = Math.min(x1, x + step)) {
    const good = ok(x);

    if (good && run_start === null) {
      run_start = x;
    }

    const end = x >= x1;

    if ((!good || end) && run_start !== null) {
      const run_end = good ? x : x - step;

      if (run_end > run_start) {
        out.push(slice_platform(p, run_start, run_end));
      }

      run_start = null;
    }

    if (end) {
      break;
    }
  }

  return out;
};

export const usable_length = (p: Platform) => platform_x1(p) - platform_x0(p) - EDGE_MARGIN * 2;

export const total_usable_length = (platforms: readonly Platform[]) => {
  let total = 0;

  for (const p of platforms) {
    total += Math.max(0, usable_length(p));
  }

  return total;
};

export const pick_spot = (
  platforms: readonly Platform[],
  taken: readonly Spot[],
  rng: Rng,
): Spot | null => {
  const total = total_usable_length(platforms);

  if (total <= 0) {
    return null;
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let r = rng() * total;
    let index = 0;

    for (; index < platforms.length - 1; index++) {
      const usable = Math.max(0, usable_length(platforms[index]!));

      if (r < usable) {
        break;
      }

      r -= usable;
    }

    const p = platforms[index]!;
    const usable = usable_length(p);

    if (usable <= 0) {
      continue;
    }

    const x = platform_x0(p) + EDGE_MARGIN + rng() * usable;
    const y = platform_y_at(p, x);

    const crowded = taken.some(spot => {
      const other = platforms[spot.platform]!;

      return (
        Math.abs(spot.x - x) < MIN_SPACING &&
        Math.abs(platform_y_at(other, spot.x) - y) < SPACING_HEIGHT
      );
    });

    if (!crowded) {
      return { platform: index, x };
    }
  }

  return null;
};
