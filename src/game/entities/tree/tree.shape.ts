import type { Skeleton } from './tree.skeleton';

export type CapsuleSink = (
  ax: number,
  ay: number,
  ra: number,
  bx: number,
  by: number,
  rb: number,
  al: number,
) => void;

const PIECE_OF_RADIUS = 0.3;
const MIN_PIECE = 2;
const ALONG_MIN_SHARE = 0.5;

export const main_children = (sk: Skeleton): Int32Array => {
  const main = new Int32Array(sk.x.length).fill(-1);

  for (let i = 0; i < sk.x.length; i++) {
    const p = sk.parent[i]!;

    if (p >= 0 && (main[p]! < 0 || sk.r[i]! > sk.r[main[p]!]!)) {
      main[p] = i;
    }
  }

  return main;
};

export const draw_radii = (
  sk: Skeleton,
  kids: Int32Array,
  main: Int32Array,
  fork_taper: number,
  fork_cos: number,
): Float32Array => {
  const n = sk.x.length;
  const rr = Float32Array.from(sk.r);

  if (fork_taper <= 0) {
    return rr;
  }

  const along = new Int32Array(n).fill(-1);
  const along_c = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const f = sk.parent[i]!;

    if (f < 0 || sk.parent[f]! < 0 || sk.r[i]! < ALONG_MIN_SHARE * sk.r[main[f]!]!) {
      continue;
    }

    const q = sk.parent[f]!;
    const ax = sk.x[f]! - sk.x[q]!;
    const ay = sk.y[f]! - sk.y[q]!;
    const bx = sk.x[i]! - sk.x[f]!;
    const by = sk.y[i]! - sk.y[f]!;
    const c = (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by) || 1);

    if (c > fork_cos && (along[f]! < 0 || c > along_c[f]!)) {
      along[f] = i;
      along_c[f] = c;
    }
  }

  for (let f = 0; f < n; f++) {
    if (kids[f]! < 2 || along[f]! < 0) {
      continue;
    }

    const extra = sk.r[f]! - sk.r[along[f]!]!;

    if (extra <= 0) {
      continue;
    }

    const len = fork_taper * sk.r[f]!;
    let s = 0;
    let prev = f;

    for (let i = along[f]!; i >= 0 && s < len; i = main[i]!) {
      s += Math.hypot(sk.x[i]! - sk.x[prev]!, sk.y[i]! - sk.y[prev]!);
      prev = i;

      const t = Math.min(1, s / len);

      rr[i] = Math.max(rr[i]!, sk.r[i]! + extra * (1 - t * t * (3 - 2 * t)));
    }
  }

  return rr;
};

export const spline_segment = (
  sk: Skeleton,
  rr: Float32Array,
  kids: Int32Array,
  main: Int32Array,
  i: number,
  al0: number,
  sink: CapsuleSink,
): number => {
  const pi = sk.parent[i]!;
  const ra = kids[pi] === 1 || main[pi] === i ? rr[pi]! : rr[i]!;
  const rb = rr[i]!;
  const gp = sk.parent[pi]!;
  const p0 = main[pi] === i && gp >= 0 ? gp : pi;
  const p3 = main[i]! >= 0 ? main[i]! : i;
  const ax = sk.x[pi]!;
  const ay = sk.y[pi]!;
  const bx = sk.x[i]!;
  const by = sk.y[i]!;
  const len = Math.hypot(bx - ax, by - ay);
  const n = Math.max(1, Math.ceil(len / Math.max(MIN_PIECE, Math.min(ra, rb) * PIECE_OF_RADIUS)));
  let px = ax;
  let py = ay;

  for (let k = 1; k <= n; k++) {
    const t = k / n;
    const t2 = t * t;
    const t3 = t2 * t;
    const c0 = -0.5 * t3 + t2 - 0.5 * t;
    const c1 = 1.5 * t3 - 2.5 * t2 + 1;
    const c2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
    const c3 = 0.5 * t3 - 0.5 * t2;
    const qx = c0 * sk.x[p0]! + c1 * ax + c2 * bx + c3 * sk.x[p3]!;
    const qy = c0 * sk.y[p0]! + c1 * ay + c2 * by + c3 * sk.y[p3]!;

    sink(
      px,
      py,
      ra + (rb - ra) * ((k - 1) / n),
      qx,
      qy,
      ra + (rb - ra) * t,
      al0 + (len * (k - 1)) / n,
    );
    px = qx;
    py = qy;
  }

  return al0 + len;
};

export const capsule_t = (
  dx: number,
  dy: number,
  ux: number,
  uy: number,
  len: number,
  ra: number,
  kr: number,
  kq: number,
) => {
  const s0 = dx * ux + dy * uy;
  const KQ_MIN = 0.05;
  const t = kq > KQ_MIN ? (s0 + kr * ra) / kq / len : s0 / len;

  return Math.min(1, Math.max(0, t));
};

export const trunk_flags = (sk: Skeleton): Uint8Array => {
  const in_trunk = new Uint8Array(sk.x.length);

  for (let j = 1; j < sk.trunk.length; j++) {
    in_trunk[sk.trunk[j]!] = 1;
  }

  return in_trunk;
};
