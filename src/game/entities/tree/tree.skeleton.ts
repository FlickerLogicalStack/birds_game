import { clamp01 } from '../../utils/math';
import { create_rng, range, type Rng } from '../../utils/random';
import type { TreeParams } from './tree';

export type Skeleton = {
  x: number[];
  y: number[];
  r: number[];
  parent: number[];
  trunk: number[];
};

export type Blob = {
  x: number;
  y: number;
  rx: number;
  ry: number;
};

const ROOT_SALT = 0x5bd1e995;
const BEND_SALT = 0x68e31da4;

const PHASE_MAX = 6.28;
const LOBE_5 = 0.6;
const BLOB_TRIES = 3000;
const MID_TRIES = 60;
const DART_GUARD = 20;
const BLOB_SCALE_MIN = 0.85;
const BLOB_SCALE_MAX = 1.15;
const LIMB_REACH = 4;
const TRUNK_WOBBLE = 0.6;
const NODE_CAP = 200000;
const NODE_CAP_SLACK = 10000;
const MIN_PULL = 0.05;
const DUPLICATE = 0.4;
const ANY_NODE = -2;
const ZIG_MIN_SHARE = 0.5;
const SMOOTH_SELF = 0.5;
const ROOT_SHRINK = 0.6;
const ROOT_LOWER = 0.5;
const ROOT_R_JITTER_MIN = 0.8;
const ROOT_R_JITTER_MAX = 1.1;
const ROOT_SEGMENT = 8;
const ROOT_MIN_STEPS = 4;
const ROOT_MIN_R = 2;
const ROOT_TAPER_POW = 1.3;
const FLARE_POW = 2.5;

type Envelope = { rx: number; ry: number; cx: number; cy: number; trunk_h: number };

const envelope = (levels: number, P: TreeParams): Envelope => {
  const C = P.crown;
  const rx = C.rx_base + C.rx_per_level * Math.pow(levels, C.level_pow);
  const ry = rx * C.aspect;
  const trunk_h = C.trunk_base + ry * C.trunk_ry;

  return { rx, ry, cx: 0, cy: -(trunk_h + ry * C.center_ry), trunk_h };
};

const smooth01 = (t: number) => t * t * (3 - 2 * t);

const add_node = (sk: Skeleton, x: number, y: number, parent: number) => {
  sk.x.push(x);
  sk.y.push(y);
  sk.r.push(0);
  sk.parent.push(parent);

  return sk.x.length - 1;
};

export const count_kids = (sk: Skeleton): Int32Array => {
  const kids = new Int32Array(sk.x.length);

  for (const p of sk.parent) {
    if (p >= 0) {
      kids[p]! += 1;
    }
  }

  return kids;
};

const smooth_chains = (sk: Skeleton, passes: number) => {
  const n = sk.x.length;
  const kids = new Int32Array(n);
  const child = new Int32Array(n).fill(-1);

  for (let i = 0; i < n; i++) {
    const p = sk.parent[i]!;

    if (p >= 0) {
      kids[p]! += 1;
      child[p] = i;
    }
  }

  for (let k = 0; k < passes; k++) {
    for (let i = 0; i < n; i++) {
      const p = sk.parent[i]!;

      if (p < 0 || kids[i] !== 1) {
        continue;
      }

      const c = child[i]!;
      const rest = (1 - SMOOTH_SELF) / 2;

      sk.x[i] = sk.x[i]! * SMOOTH_SELF + (sk.x[p]! + sk.x[c]!) * rest;
      sk.y[i] = sk.y[i]! * SMOOTH_SELF + (sk.y[p]! + sk.y[c]!) * rest;
    }
  }
};

const zigzag = (sk: Skeleton, first: number, rng: Rng, P: TreeParams) => {
  const C = P.colonize;

  if (C.twig_zig <= 0) {
    return;
  }

  const n = sk.x.length;
  const side = new Float32Array(n);
  const left = new Int32Array(n);
  const ox = Float64Array.from(sk.x);
  const oy = Float64Array.from(sk.y);

  for (let i = first; i < n; i++) {
    const p = sk.parent[i]!;

    if (p >= first && left[p]! > 0) {
      side[i] = side[p]!;
      left[i] = left[p]! - 1;
    } else {
      side[i] = p >= first ? -side[p]! : rng() < 0.5 ? -1 : 1;
      left[i] = Math.floor(range(rng, C.zig_min, C.zig_max + 1)) - 1;
    }

    const dx = ox[i]! - ox[p]!;
    const dy = oy[i]! - oy[p]!;
    const m = Math.hypot(dx, dy) || 1;
    const a = C.twig_zig * side[i]! * range(rng, ZIG_MIN_SHARE, 1);

    sk.x[i] = ox[i]! - (dy / m) * a;
    sk.y[i] = oy[i]! + (dx / m) * a;
  }
};

const pipe_model = (sk: Skeleton, r_tip: number, n: number, taper: number) => {
  const count = sk.x.length;
  const acc = new Float64Array(count);
  const best = new Float64Array(count);

  for (let i = count - 1; i >= 0; i--) {
    const own = acc[i]! > 0 ? Math.pow(acc[i]!, 1 / n) : r_tip;
    const r = Math.max(own, best[i]!);
    const p = sk.parent[i]!;

    sk.r[i] = r;

    if (p < 0) {
      continue;
    }

    acc[p]! += Math.pow(r, n);

    const grow = r + taper * Math.hypot(sk.x[i]! - sk.x[p]!, sk.y[i]! - sk.y[p]!);

    if (grow > best[p]!) {
      best[p] = grow;
    }
  }
};

const finish_trunk = (sk: Skeleton, e: Envelope, seed: number, P: TreeParams): number => {
  const T = P.trunk;
  const rng = create_rng(seed ^ ROOT_SALT);

  pipe_model(sk, T.r_tip, T.pipe_n, T.taper);

  const n = sk.x.length;
  const kids = new Int32Array(n);
  const child = new Int32Array(n).fill(-1);

  for (let i = 1; i < n; i++) {
    kids[sk.parent[i]!]! += 1;
    child[sk.parent[i]!] = i;
  }

  const trunk = [0];

  while (kids[trunk[trunk.length - 1]!] === 1) {
    trunk.push(child[trunk[trunk.length - 1]!]!);
  }

  const fork = trunk[trunk.length - 1]!;
  const fork_h = -sk.y[fork]!;
  const r_pipe = sk.r[0]!;
  const k = (e.rx * T.trunk_d) / 2 / r_pipe;

  for (let i = 0; i < n; i++) {
    sk.r[i] = sk.r[i]! * (1 + (k - 1) * Math.pow(sk.r[i]! / r_pipe, T.boost_pow));
  }

  let r_limb = 0;

  for (let i = 0; i < n; i++) {
    if (sk.parent[i] === fork) {
      r_limb = Math.max(r_limb, sk.r[i]!);
    }
  }

  const r_neck = Math.min(sk.r[fork]!, r_limb * T.neck_r);

  for (const i of trunk) {
    const u = (-sk.y[i]! / Math.max(1, fork_h) - T.neck) / (1 - T.neck);

    if (u > 0) {
      sk.r[i] = sk.r[i]! + (r_neck - sk.r[i]!) * smooth01(u);
    }
  }

  const rb = sk.r[0]!;
  const fh = rb * T.flare_h;

  for (const i of trunk) {
    const h = -sk.y[i]!;

    if (h < fh) {
      sk.r[i] = sk.r[i]! * (1 + T.flare * Math.pow(1 - h / fh, FLARE_POW));
    }
  }

  for (let side = -1; side <= 1; side += 2) {
    const count = Math.floor(range(rng, T.root_min, T.root_max + 1));

    for (let j = 0; j < count; j++) {
      const len = rb * range(rng, T.root_len_min, T.root_len_max) * (1 - (j / count) * ROOT_SHRINK);
      const r0 =
        rb *
        T.root_r *
        range(rng, ROOT_R_JITTER_MIN, ROOT_R_JITTER_MAX) *
        (1 - (j / count) * ROOT_SHRINK);
      const h0 = rb * range(rng, T.root_h_min, T.root_h_max) * (1 - (j / count) * ROOT_LOWER);
      const steps = Math.max(ROOT_MIN_STEPS, Math.round(len / ROOT_SEGMENT));
      let id = 0;

      for (let s = 1; s <= steps; s++) {
        const u = s / steps;
        const x = side * (rb * T.root_x + len * u);
        const rr = Math.max(ROOT_MIN_R, r0 * Math.pow(1 - u, ROOT_TAPER_POW));
        const y = -h0 * Math.pow(1 - u, T.root_pow) - rr * T.root_up + range(rng, -1, 1);

        id = add_node(sk, x, y, id);
        sk.r[id] = rr;
      }
    }
  }

  sk.trunk = trunk;

  return fork_h;
};

const bend_trunk = (sk: Skeleton, seed: number, fork_h: number, levels: number, P: TreeParams) => {
  const T = P.trunk;
  const rng = create_rng(seed ^ BEND_SALT);
  const grow = clamp01(levels / T.bend_full_level);
  const a = T.bend_arc * fork_h * grow * range(rng, -1, 1);
  const b = T.bend_s_curve * fork_h * grow * range(rng, -1, 1);

  for (const i of sk.trunk) {
    const u = clamp01(-sk.y[i]! / Math.max(1, fork_h));
    const s = Math.sin(Math.PI * u);

    sk.x[i] = sk.x[i]! + a * s * s + b * s * Math.sin(2 * Math.PI * u);
  }
};

export const grow_skeleton = (
  seed: number,
  levels: number,
  base_y: number,
  P: TreeParams,
): { skeleton: Skeleton; blobs: Blob[] } => {
  const C = P.colonize;
  const K = P.crown;
  const e = envelope(levels, P);
  const rng = create_rng(seed);
  const ph1 = range(rng, 0, PHASE_MAX);
  const ph2 = range(rng, 0, PHASE_MAX);

  const in_crown = (x: number, y: number, lim: number) => {
    const nx = (x - e.cx) / e.rx;
    const ny = (y - e.cy) / e.ry;
    const a = Math.atan2(ny, nx);
    const edge = 1 + K.lobes * Math.sin(3 * a + ph1) + K.lobes * LOBE_5 * Math.sin(5 * a + ph2);

    return Math.hypot(nx, ny) / edge <= lim && ny <= K.bottom;
  };

  const br = Math.min(C.blob_max, Math.max(C.blob_min, e.rx * C.blob_r));
  const blobs: Blob[] = [];

  for (let tries = 0; tries < BLOB_TRIES; tries++) {
    const x = e.cx + range(rng, -1, 1) * e.rx;
    const y = e.cy + range(rng, -1, 1) * e.ry;

    if (!in_crown(x, y, C.blob_core)) {
      continue;
    }

    let ok = true;

    for (const b of blobs) {
      if (Math.hypot(b.x - x, (b.y - y) / C.blob_aspect) < br * C.blob_gap) {
        ok = false;
      }
    }

    if (ok) {
      const rx = br * range(rng, BLOB_SCALE_MIN, BLOB_SCALE_MAX);
      const ry = br * C.blob_aspect * range(rng, BLOB_SCALE_MIN, BLOB_SCALE_MAX);

      blobs.push({ x, y, rx, ry });
    }
  }

  const ax: number[] = [];
  const ay: number[] = [];

  for (const b of blobs) {
    const want = Math.round((Math.PI * b.rx * b.ry) / (C.spacing * C.spacing));

    for (let k = 0, guard = 0; k < want && guard < want * DART_GUARD; guard++) {
      const u = range(rng, -1, 1);
      const v = range(rng, -1, 1);

      if (u * u + v * v > 1) {
        continue;
      }

      const x = b.x + u * b.rx;
      const y = b.y + v * b.ry;

      if (!in_crown(x, y, 1)) {
        continue;
      }

      ax.push(x);
      ay.push(y);
      k++;
    }
  }

  const fill = Math.round((Math.PI * e.rx * e.ry * C.filler) / (C.spacing * C.spacing));

  for (let k = 0, guard = 0; k < fill && guard < fill * DART_GUARD; guard++) {
    const x = e.cx + range(rng, -1, 1) * e.rx;
    const y = e.cy + range(rng, -1, 1) * e.ry;

    if (!in_crown(x, y, 1)) {
      continue;
    }

    ax.push(x);
    ay.push(y);
    k++;
  }

  const sk: Skeleton = { x: [], y: [], r: [], parent: [], trunk: [] };
  const ndx: number[] = [];
  const ndy: number[] = [];
  const kids: number[] = [];
  const bud: boolean[] = [];
  const left: number[] = [];
  const fork: boolean[] = [];
  let twigs = false;
  const cell = C.cell;
  const grid = new Map<number, number[]>();
  const GRID_ROW = 65536;
  const key = (gx: number, gy: number) => gx * GRID_ROW + gy;

  const grow = (x: number, y: number, parent: number) => {
    const i = add_node(sk, x, y, parent);

    kids.push(0);
    bud.push(rng() < C.twig_bud);

    if (parent < 0 || !twigs || C.twig_len_max <= 0) {
      left.push(Infinity);
    } else if (kids[parent]! > 0 || left[parent] === Infinity || left[parent]! <= 0) {
      const u = Math.pow(rng(), C.twig_len_pow);

      left.push(Math.round(C.twig_len_min + (C.twig_len_max - C.twig_len_min) * u) - 1);
    } else {
      left.push(left[parent]! - 1);
    }

    const end = left[i]! <= 0 && twigs && C.twig_len_max > 0;

    fork.push(end && rng() < C.twig_fork);

    if (parent < 0) {
      ndx.push(0);
      ndy.push(-1);
    } else {
      kids[parent]! += 1;

      const m = Math.hypot(x - sk.x[parent]!, y - sk.y[parent]!) || 1;

      ndx.push((x - sk.x[parent]!) / m);
      ndy.push((y - sk.y[parent]!) / m);
    }

    const k = key(Math.floor(x / cell), Math.floor(y / cell));
    let list = grid.get(k);

    if (list === undefined) {
      list = [];
      grid.set(k, list);
    }

    list.push(i);

    return i;
  };

  const nearest = (x: number, y: number, rad: number, cone: number, need_bud: boolean) => {
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    const rings = Math.ceil(rad / cell) + 1;
    let best = -1;
    let bd = rad * rad;

    for (let ring = 0; ring <= rings; ring++) {
      const gap = Math.max(0, ring - 1) * cell;

      if (gap * gap > bd) {
        break;
      }

      for (let oy = -ring; oy <= ring; oy++) {
        for (let ox = -ring; ox <= ring; ox++) {
          if (Math.abs(ox) !== ring && Math.abs(oy) !== ring) {
            continue;
          }

          const list = grid.get(key(gx + ox, gy + oy));

          if (list === undefined) {
            continue;
          }

          for (const i of list) {
            const vx = x - sk.x[i]!;
            const vy = y - sk.y[i]!;
            const d = vx * vx + vy * vy;

            if (d >= bd) {
              continue;
            }

            if (cone >= -1) {
              if (kids[i]! >= C.max_kids || (need_bud && kids[i]! > 0 && !bud[i] && !fork[i])) {
                continue;
              }

              if (left[i]! <= 0 && !fork[i] && kids[i] === 0) {
                continue;
              }

              if (vx * ndx[i]! + vy * ndy[i]! < cone * Math.sqrt(d)) {
                continue;
              }
            }

            bd = d;
            best = i;
          }
        }
      }
    }

    return best;
  };

  let id = grow(0, 0, -1);
  let wob = 0;

  for (let y = -C.step; y > -e.trunk_h; y -= C.step) {
    wob += range(rng, -TRUNK_WOBBLE, TRUNK_WOBBLE);
    id = grow(wob, y, id);
  }

  const sx = new Float64Array(NODE_CAP);
  const sy = new Float64Array(NODE_CAP);
  const cnt = new Int32Array(NODE_CAP);

  const stage = (
    px: readonly number[],
    py: readonly number[],
    influence: number,
    kill: number,
    cone: number,
    need_bud: boolean,
    noise: number,
    droop: number,
    lift: boolean,
  ) => {
    const alive = new Uint8Array(px.length).fill(1);
    let started = false;

    for (let it = 0; it < C.max_iter && sk.x.length < NODE_CAP - NODE_CAP_SLACK; it++) {
      const touched: number[] = [];

      for (let a = 0; a < px.length; a++) {
        if (!alive[a]) {
          continue;
        }

        const n = nearest(px[a]!, py[a]!, influence, cone, need_bud);

        if (n < 0) {
          continue;
        }

        const vx = px[a]! - sk.x[n]!;
        const vy = py[a]! - sk.y[n]!;
        const m = Math.hypot(vx, vy) || 1;

        if (cnt[n] === 0) {
          touched.push(n);
        }

        sx[n]! += vx / m;
        sy[n]! += vy / m;
        cnt[n]! += 1;
      }

      if (touched.length === 0) {
        if (!lift || started || sk.y[id]! < e.cy - e.ry) {
          break;
        }

        id = grow(sk.x[id]!, sk.y[id]! - C.step, id);
        continue;
      }

      started = true;

      const fresh: number[] = [];

      for (const n of touched) {
        const nx = sk.x[n]!;
        const ny = sk.y[n]!;
        let dx = sx[n]! / cnt[n]!;
        let dy = sy[n]! / cnt[n]!;

        sx[n] = 0;
        sy[n] = 0;
        cnt[n] = 0;

        const m0 = Math.hypot(dx, dy);

        if (m0 < MIN_PULL) {
          continue;
        }

        dx /= m0;
        dy /= m0;
        dx += (nx >= 0 ? 1 : -1) * C.spread;
        dy += droop * Math.min(1, Math.abs(nx) / e.rx);

        const na = range(rng, -noise, noise);
        const rdx = dx * Math.cos(na) - dy * Math.sin(na);

        dy = dx * Math.sin(na) + dy * Math.cos(na);
        dx = rdx;

        const m = Math.hypot(dx, dy);

        if (m < MIN_PULL) {
          continue;
        }

        const x = nx + (dx / m) * C.step;
        const y = ny + (dy / m) * C.step;

        if (nearest(x, y, C.step * DUPLICATE, ANY_NODE, false) >= 0) {
          continue;
        }

        fresh.push(grow(x, y, n));
      }

      if (fresh.length === 0) {
        break;
      }

      for (let a = 0; a < px.length; a++) {
        if (alive[a] && nearest(px[a]!, py[a]!, kill, ANY_NODE, false) >= 0) {
          alive[a] = 0;
        }
      }
    }
  };

  stage(
    blobs.map(b => b.x),
    blobs.map(b => b.y),
    e.rx * LIMB_REACH,
    br * C.limb_kill,
    C.limb_cone,
    false,
    C.limb_noise,
    C.limb_droop,
    true,
  );

  if (C.mid_gap > 0) {
    const mx: number[] = [];
    const my: number[] = [];
    const gap = br * C.mid_gap;

    for (const b of blobs) {
      const from = mx.length;

      for (let tries = 0; tries < MID_TRIES; tries++) {
        const u = range(rng, -1, 1);
        const v = range(rng, -1, 1);

        if (u * u + v * v > 1) {
          continue;
        }

        const x = b.x + u * b.rx;
        const y = b.y + v * b.ry;
        let ok = in_crown(x, y, 1);

        for (let k = from; k < mx.length && ok; k++) {
          if (Math.hypot(mx[k]! - x, my[k]! - y) < gap) {
            ok = false;
          }
        }

        if (ok) {
          mx.push(x);
          my.push(y);
        }
      }
    }

    stage(
      mx,
      my,
      br * C.mid_influence,
      br * C.mid_kill,
      C.mid_cone,
      true,
      C.mid_noise,
      C.mid_droop,
      false,
    );
  }

  const first_twig = sk.x.length;

  twigs = true;
  stage(
    ax,
    ay,
    br * C.twig_influence,
    C.twig_kill,
    C.twig_cone,
    true,
    C.twig_noise,
    C.twig_droop,
    false,
  );
  smooth_chains(sk, C.smooth);
  zigzag(sk, first_twig, rng, P);

  const fork_h = finish_trunk(sk, e, seed, P);

  bend_trunk(sk, seed, fork_h, levels, P);

  for (let i = 0; i < sk.y.length; i++) {
    sk.y[i] = sk.y[i]! + base_y;
  }

  for (const b of blobs) {
    b.y += base_y;
  }

  return { skeleton: sk, blobs };
};
