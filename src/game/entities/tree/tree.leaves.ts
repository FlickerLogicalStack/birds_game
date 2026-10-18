import { create_rng, range } from '../../utils/random';
import { TAU } from '../../utils/math';
import { main_children } from './tree.shape';
import { count_kids, type Blob, type Skeleton } from './tree.skeleton';
import { CONFIG } from '../../../config';

const S = CONFIG.tree_sprite;
const LEAF_SALT = 0x2545f491;
const TONES = S.leaves.length;
const MIN_U = 1e-6;
const CLUMP_FLAT = 0.8;
const BLOB_LOCAL = 1.5;
const GLOBAL_X = -0.5;
const GLOBAL_Y = -0.85;
const LOCAL_X = -0.55;
const LOCAL_Y = -0.75;
const BASE_TONE = 2.6;

export type Leaves = {
  count: number;
  x: number[];
  y: number[];
  angle: number[];
  len: number[];
  front: boolean[];
  tone: Uint8Array;
};

export const grow_leaves = (sk: Skeleton, blobs: readonly Blob[], seed: number): Leaves => {
  const rng = create_rng(seed ^ LEAF_SALT);
  const n = sk.x.length;
  const kids = count_kids(sk);
  const main = main_children(sk);
  const attach = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    const p = sk.parent[i]!;

    if (p >= 0) {
      attach[i] = main[p] === i ? attach[p]! : sk.r[p]!;
    }
  }

  const r_trunk = sk.r[0]!;
  const x: number[] = [];
  const y: number[] = [];
  const lx: number[] = [];
  const ly: number[] = [];
  const angle: number[] = [];
  const len: number[] = [];
  const front: boolean[] = [];
  const noise: number[] = [];

  const push = (px: number, py: number, plx: number, ply: number) => {
    x.push(px);
    y.push(py);
    lx.push(plx);
    ly.push(ply);
    angle.push(range(rng, 0, Math.PI));
    len.push(range(rng, S.leaf_len_min, S.leaf_len_max));
    front.push(rng() < S.leaf_front);
    noise.push(range(rng, -1, 1));
  };

  for (let i = 0; i < n; i++) {
    if (sk.parent[i]! < 0 || sk.r[i]! > S.leaf_twig_r || attach[i]! > r_trunk * S.leaf_attach) {
      continue;
    }

    const tip = kids[i] === 0;
    const count = tip ? S.leaf_per_tip : S.leaf_per_node;
    const s = tip ? S.leaf_tip_spread : S.leaf_spread;

    for (let k = 0; k < count; k++) {
      const u = Math.max(MIN_U, rng());
      const m = Math.min(S.leaf_max_sigma, Math.sqrt(-2 * Math.log(u)));
      const a = range(rng, 0, TAU);
      const dx = m * Math.cos(a) * s;
      const dy = m * Math.sin(a) * s * CLUMP_FLAT - S.leaf_lift;

      push(sk.x[i]! + dx, sk.y[i]! + dy, dx / s, dy / s);
    }
  }

  for (const b of blobs) {
    const count = Math.round(Math.PI * b.rx * b.ry * S.leaf_blob_fill);

    for (let k = 0; k < count; k++) {
      const u = range(rng, -1, 1);
      const v = range(rng, -1, 1);

      if (u * u + v * v <= 1) {
        push(b.x + u * b.rx, b.y + v * b.ry, u * BLOB_LOCAL, v * BLOB_LOCAL);
      }
    }
  }

  const count = x.length;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;

  for (let i = 0; i < count; i++) {
    x0 = Math.min(x0, x[i]!);
    x1 = Math.max(x1, x[i]!);
    y0 = Math.min(y0, y[i]!);
    y1 = Math.max(y1, y[i]!);
  }

  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.max(1, (x1 - x0) / 2);
  const ry = Math.max(1, (y1 - y0) / 2);
  const C = S.leaf_ao_cell;
  const gw = Math.ceil((x1 - x0) / C) + 3;
  const gh = Math.ceil((y1 - y0) / C) + 3;
  const grid = new Float32Array(gw * gh);
  const cell = (i: number) =>
    (Math.floor((y[i]! - y0) / C) + 1) * gw + Math.floor((x[i]! - x0) / C) + 1;

  for (let i = 0; i < count; i++) {
    grid[cell(i)]! += 1;
  }

  const density = new Float32Array(count);
  let max_density = 0;

  for (let i = 0; i < count; i++) {
    const c = cell(i);
    let sum = 0;

    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        sum += grid[c + oy * gw + ox] ?? 0;
      }
    }

    density[i] = sum;
    max_density = Math.max(max_density, sum);
  }

  const tone = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    const g = GLOBAL_X * ((x[i]! - cx) / rx) + GLOBAL_Y * ((y[i]! - cy) / ry);
    const local = LOCAL_X * lx[i]! + LOCAL_Y * ly[i]!;
    const v =
      BASE_TONE +
      g * S.leaf_light_global +
      local * S.leaf_light_local +
      noise[i]! * S.leaf_jitter -
      (density[i]! / Math.max(1, max_density)) * S.leaf_ao;

    tone[i] = Math.max(0, Math.min(TONES - 1, Math.round(v)));
  }

  return { count, x, y, angle, len, front, tone };
};

export const leaves_margin = () =>
  S.leaf_tip_spread * S.leaf_max_sigma + S.leaf_len_max / 2 + S.leaf_lift + 1;
