import { DEG } from '../../utils/math';
import {
  EDGE_MARGIN,
  MIN_SPACING,
  platform_x0,
  platform_x1,
  platform_y_at,
  SPACING_HEIGHT,
  type Platform,
} from '../platforms/platforms';
import { capsule_t, draw_radii, main_children, spline_segment, trunk_flags } from './tree.shape';
import { count_kids, type Skeleton } from './tree.skeleton';
import type { TreeParams } from './tree';
import { CONFIG } from '../../../config';

const FORK_TAPER = CONFIG.tree_sprite.fork_taper;
const FORK_COS = CONFIG.tree_sprite.fork_cos;
const MASK_PAD = 2;
const MIN_RUN = 3;
const PIXEL_CENTER = 0.5;

type Mask = { data: Uint8Array; w: number; h: number; x0: number; y0: number };

const bark_mask = (sk: Skeleton, clip_y: number): Mask => {
  const n = sk.x.length;
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;

  for (let i = 0; i < n; i++) {
    min_x = Math.min(min_x, sk.x[i]! - sk.r[i]!);
    min_y = Math.min(min_y, sk.y[i]! - sk.r[i]!);
    max_x = Math.max(max_x, sk.x[i]! + sk.r[i]!);
    max_y = Math.max(max_y, sk.y[i]! + sk.r[i]!);
  }

  const x0 = Math.floor(min_x) - MASK_PAD;
  const y0 = Math.floor(min_y) - MASK_PAD;
  const w = Math.ceil(max_x) + MASK_PAD + 1 - x0;
  const h = Math.ceil(max_y) + MASK_PAD + 1 - y0;
  const data = new Uint8Array(w * h);
  const kids = count_kids(sk);
  const main = main_children(sk);
  const rr = draw_radii(sk, kids, main, FORK_TAPER, FORK_COS);
  const in_trunk = trunk_flags(sk);

  const capsule = (ax: number, ay: number, ra: number, bx: number, by: number, rb: number) => {
    const vx = bx - ax;
    const vy = by - ay;
    const len = Math.sqrt(Math.max(1e-6, vx * vx + vy * vy));
    const ux = vx / len;
    const uy = vy / len;
    const kr = (rb - ra) / len;
    const kq = 1 - kr * kr;
    const ext = Math.max(ra, rb) + 1;
    const cx0 = Math.max(0, Math.floor(Math.min(ax, bx) - x0 - ext));
    const cx1 = Math.min(w - 1, Math.ceil(Math.max(ax, bx) - x0 + ext));
    const cy0 = Math.max(0, Math.floor(Math.min(ay, by) - y0 - ext));
    const cy1 = Math.min(h - 1, Math.ceil(Math.max(ay, by) - y0 + ext), Math.ceil(clip_y - y0) - 1);

    for (let py = cy0; py <= cy1; py++) {
      for (let px = cx0; px <= cx1; px++) {
        const dx = px + PIXEL_CENTER + x0 - ax;
        const dy = py + PIXEL_CENTER + y0 - ay;
        const t = capsule_t(dx, dy, ux, uy, len, ra, kr, kq);
        const qx = dx - vx * t;
        const qy = dy - vy * t;
        const r = ra + (rb - ra) * t;

        if (qx * qx + qy * qy < r * r) {
          data[py * w + px] = 1;
        }
      }
    }
  };

  for (let j = 0; j + 1 < sk.trunk.length; j++) {
    const a = sk.trunk[j]!;
    const b = sk.trunk[j + 1]!;
    const ya = Math.min(sk.y[a]!, clip_y);

    for (let py = Math.max(0, Math.floor(sk.y[b]! - y0)); py + y0 < ya && py < h; py++) {
      const t = Math.min(
        1,
        Math.max(0, (py + PIXEL_CENTER + y0 - sk.y[a]!) / (sk.y[b]! - sk.y[a]!)),
      );
      const cx = sk.x[a]! + (sk.x[b]! - sk.x[a]!) * t;
      const r = sk.r[a]! + (sk.r[b]! - sk.r[a]!) * t;
      const lo = Math.max(0, Math.floor(cx - r - x0));
      const hi = Math.min(w - 1, Math.ceil(cx + r - x0));

      for (let px = lo; px <= hi; px++) {
        if (Math.abs(px + PIXEL_CENTER + x0 - cx) < r) {
          data[py * w + px] = 1;
        }
      }
    }
  }

  const top = sk.trunk[sk.trunk.length - 1]!;

  for (let i = main[top]!; i >= 0; i = main[i]!) {
    spline_segment(sk, rr, kids, main, i, 0, capsule);
  }

  for (let i = 0; i < n; i++) {
    const p = sk.parent[i]!;

    if (p < 0 || main[p] === i || in_trunk[i]) {
      continue;
    }

    for (let j = i; j >= 0; j = main[j]!) {
      spline_segment(sk, rr, kids, main, j, 0, capsule);
    }
  }

  return { data, w, h, x0, y0 };
};

export const trace_platforms = (
  sk: Skeleton,
  ground_y: number,
  clip_y: number,
  P: TreeParams,
): Platform[] => {
  const T = P.platforms;
  const { data, w, h, x0, y0 } = bark_mask(sk, clip_y);
  const bark = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] === 1;
  const lowest = ground_y - T.ground;
  const surf = new Uint8Array(w * h);

  for (let x = 0; x < w; x++) {
    for (let y = 1; y < h; y++) {
      if (!bark(x, y) || bark(x, y - 1) || y + y0 > lowest) {
        continue;
      }

      let free = true;

      for (let k = 1; k <= T.clearance && free; k++) {
        free = !bark(x, y - k);
      }

      let deep = 0;

      while (deep < T.min_thickness && bark(x, y + deep)) {
        deep++;
      }

      if (free && deep >= T.min_thickness) {
        surf[y * w + x] = 1;
      }
    }
  }

  const used = new Uint8Array(w * h);
  const open = (x: number, y: number) =>
    y >= 0 && y < h && surf[y * w + x] === 1 && used[y * w + x] === 0;
  const runs: number[][] = [];

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!open(x, y)) {
        continue;
      }

      const run = [y];
      let cy = y;

      used[y * w + x] = 1;

      for (let cx = x + 1; cx < w; cx++) {
        const ny = open(cx, cy) ? cy : open(cx, cy - 1) ? cy - 1 : open(cx, cy + 1) ? cy + 1 : -1;

        if (ny < 0) {
          break;
        }

        used[ny * w + cx] = 1;
        run.push(ny);
        cy = ny;
      }

      if (run.length >= MIN_RUN) {
        run.unshift(x);
        runs.push(run);
      }
    }
  }

  const max_slope = Math.tan(T.max_slope * DEG);
  const win = T.trace_win;
  const out: Platform[] = [];

  const flush = (x_start: number, rows: readonly number[], from: number, to: number) => {
    if (to - from < T.min_length) {
      return;
    }

    const points: [number, number][] = [];

    for (let i = from; i < to; i += T.simplify) {
      points.push([x_start + i + x0, rows[i]! + y0]);
    }

    if (points[points.length - 1]![0] !== x_start + to - 1 + x0) {
      points.push([x_start + to - 1 + x0, rows[to - 1]! + y0]);
    }

    out.push({ points });
  };

  for (const run of runs) {
    const x_start = run[0]!;
    const rows = run.slice(1);
    let start = -1;

    for (let i = 0; i <= rows.length; i++) {
      let good = i < rows.length;

      if (good) {
        const a = Math.max(0, i - win);
        const b = Math.min(rows.length - 1, i + win);

        good = Math.abs(rows[b]! - rows[a]!) <= max_slope * Math.max(1, b - a);
      }

      if (good && start < 0) {
        start = i;
      }

      if (!good && start >= 0) {
        flush(x_start, rows, start, i);
        start = -1;
      }
    }
  }

  return out;
};

export const count_seats = (platforms: readonly Platform[]): number => {
  const order = platforms.map((_, i) => i);

  order.sort((a, b) => {
    const pa = platforms[a]!;
    const pb = platforms[b]!;

    return platform_x1(pb) - platform_x0(pb) - (platform_x1(pa) - platform_x0(pa));
  });

  const seat_x: number[] = [];
  const seat_y: number[] = [];

  for (const i of order) {
    const p = platforms[i]!;
    const x1 = platform_x1(p) - EDGE_MARGIN;

    for (let x = platform_x0(p) + EDGE_MARGIN; x <= x1; x++) {
      const y = platform_y_at(p, x);
      let free = true;

      for (let s = 0; s < seat_x.length && free; s++) {
        free =
          Math.abs(seat_x[s]! - x) >= MIN_SPACING || Math.abs(seat_y[s]! - y) >= SPACING_HEIGHT;
      }

      if (free) {
        seat_x.push(x);
        seat_y.push(y);
        x += MIN_SPACING - 1;
      }
    }
  }

  return seat_x.length;
};
