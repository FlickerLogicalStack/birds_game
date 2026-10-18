import { NO_TRANSFER } from '../../../engine/worker';
import { canvas_from_pixels } from '../../../engine/canvas';
import { hash_text } from '../../../engine/hash';
import { fill_lazy_sprite, type LazySprite } from '../../../engine/lazy_sprite';
import { define_task } from '../../../engine/worker.task';
import { clamp01 } from '../../utils/math';
import { hash2 } from '../../utils/random';
import type { Tree } from './tree';
import { grow_leaves, type Leaves } from './tree.leaves';
import { capsule_t, draw_radii, main_children, spline_segment, trunk_flags } from './tree.shape';
import { count_kids, type Skeleton } from './tree.skeleton';
import { CONFIG } from '../../../config';

const S = CONFIG.tree_sprite;
const BARK = S.bark;
const DEEPEST = BARK.length - 1;
const OUTLINE = S.outline;
const LEAF_COLORS = S.leaves;
const LEAF_TONES = LEAF_COLORS.length;

const FIELD_EMPTY = -1e9;
const FIELD_SET = -1e8;
const MIN_BLEND = 1.5;
const BLEND_BUMP = 0.25;
const RIM_DEPTH = 0.7;
const AO_DEPTH = 0.15;
const AO_MAX = 1.5;
const BARK_COLUMN_SHIFT = 1000;
const BARK_PHASE_ROW = 7;
const BARK_PHASE_SALT = 3;
const BARK_SALT = 11;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const BAYER_SIZE = 4;
const BAYER_LEVELS = 16;
const PIXEL_CENTER = 0.5;

const smooth01 = (t: number) => t * t * (3 - 2 * t);

const paint_bark = (
  sk: Skeleton,
  ox: number,
  oy: number,
  w: number,
  h: number,
  clip_y: number,
  out: Uint8ClampedArray,
) => {
  const N = w * h;
  const H = new Float32Array(N).fill(FIELD_EMPTY);
  const M = new Float32Array(N).fill(FIELD_EMPTY);
  const along = new Float32Array(N);
  const across = new Float32Array(N);
  const rad = new Float32Array(N);
  const M2 = new Float32Array(N).fill(FIELD_EMPTY);
  const along2 = new Float32Array(N);
  const across2 = new Float32Array(N);
  const rad2 = new Float32Array(N);
  const LH = new Float32Array(N).fill(FIELD_EMPTY);
  const LA = new Float32Array(N);
  const LC = new Float32Array(N);
  const LR = new Float32Array(N);
  let bx0 = w;
  let by0 = h;
  let bx1 = -1;
  let by1 = -1;
  let sink_len = 0;

  const reach = (r: number) => r + Math.max(MIN_BLEND, S.blend * r) + 1;

  const sink_k = (al: number) => {
    if (sink_len <= 0 || al >= sink_len) {
      return 1;
    }

    return S.sink + (1 - S.sink) * smooth01(Math.max(0, al / sink_len));
  };

  const put = (k: number, s: number, al: number, ac: number, rr: number) => {
    if (s > LH[k]!) {
      LH[k] = s;
      LA[k] = al;
      LC[k] = ac;
      LR[k] = rr;
    }
  };

  const grow_box = (xa: number, ya: number, xb: number, yb: number) => {
    bx0 = Math.max(0, Math.min(bx0, Math.floor(xa - ox)));
    by0 = Math.max(0, Math.min(by0, Math.floor(ya - oy)));
    bx1 = Math.min(w - 1, Math.max(bx1, Math.ceil(xb - ox)));
    by1 = Math.min(h - 1, Math.max(by1, Math.ceil(yb - oy)));
  };

  const capsule = (
    pax: number,
    pay: number,
    ra: number,
    pbx: number,
    pby: number,
    rb: number,
    al0: number,
  ) => {
    const vx = pbx - pax;
    const vy = pby - pay;
    const len = Math.sqrt(Math.max(1e-6, vx * vx + vy * vy));
    const ux = vx / len;
    const uy = vy / len;
    const kr = (rb - ra) / len;
    const kq = 1 - kr * kr;
    const ext = reach(Math.max(ra, rb));
    const cx0 = Math.max(0, Math.floor(Math.min(pax, pbx) - ox - ext));
    const cx1 = Math.min(w - 1, Math.ceil(Math.max(pax, pbx) - ox + ext));
    const cy0 = Math.max(0, Math.floor(Math.min(pay, pby) - oy - ext));
    const cy1 = Math.min(h - 1, Math.ceil(Math.max(pay, pby) - oy + ext));

    grow_box(cx0 + ox, cy0 + oy, cx1 + ox, cy1 + oy);

    const ax = pax - ox;
    const ay = pay - oy;

    for (let py = cy0; py <= cy1; py++) {
      for (let px = cx0; px <= cx1; px++) {
        const dx = px + PIXEL_CENTER - ax;
        const dy = py + PIXEL_CENTER - ay;
        const t = capsule_t(dx, dy, ux, uy, len, ra, kr, kq);
        const qx = dx - vx * t;
        const qy = dy - vy * t;
        const rr = ra + (rb - ra) * t;
        const d = Math.sqrt(qx * qx + qy * qy);

        if (d > reach(rr)) {
          continue;
        }

        const al = al0 + dx * ux + dy * uy;

        put(
          py * w + px,
          d < rr ? Math.sqrt(rr * rr - d * d) * sink_k(al) : rr - d,
          al,
          qx * -uy + qy * ux,
          rr,
        );
      }
    }
  };

  const merge = () => {
    for (let py = by0; py <= by1; py++) {
      for (let px = bx0; px <= bx1; px++) {
        const k = py * w + px;
        const s = LH[k]!;

        if (s <= FIELD_SET) {
          continue;
        }

        LH[k] = FIELD_EMPTY;

        const old = H[k]!;
        const r_thin = old > FIELD_SET ? Math.min(LR[k]!, rad[k]!) : LR[k]!;
        const kk = Math.max(MIN_BLEND, S.blend * r_thin);

        if (s > old - kk) {
          const hb = Math.max(kk - Math.abs(old - s), 0) / kk;

          H[k] = Math.max(old, s) + hb * hb * kk * BLEND_BUMP;
        }

        if (s > M[k]!) {
          M2[k] = M[k]!;
          along2[k] = along[k]!;
          across2[k] = across[k]!;
          rad2[k] = rad[k]!;
          M[k] = s;
          along[k] = LA[k]!;
          across[k] = LC[k]!;
          rad[k] = LR[k]!;
        } else if (s > M2[k]!) {
          M2[k] = s;
          along2[k] = LA[k]!;
          across2[k] = LC[k]!;
          rad2[k] = LR[k]!;
        }
      }
    }

    bx0 = w;
    by0 = h;
    bx1 = -1;
    by1 = -1;
  };

  const n = sk.x.length;
  const kids = count_kids(sk);
  const main = main_children(sk);
  const rr = draw_radii(sk, kids, main, S.fork_taper, S.fork_cos);
  const in_trunk = trunk_flags(sk);
  const trunk = sk.trunk;
  const top = trunk[trunk.length - 1]!;
  const base_y = sk.y[trunk[0]!]!;

  for (let j = 0; j + 1 < trunk.length; j++) {
    const a = trunk[j]!;
    const b = trunk[j + 1]!;
    const ya = Math.min(sk.y[a]!, clip_y);

    for (let py = Math.max(0, Math.floor(sk.y[b]! - oy)); py + oy < ya && py < h; py++) {
      const t = clamp01((py + PIXEL_CENTER + oy - sk.y[a]!) / (sk.y[b]! - sk.y[a]!));
      const cx = sk.x[a]! + (sk.x[b]! - sk.x[a]!) * t;
      const r = sk.r[a]! + (sk.r[b]! - sk.r[a]!) * t;
      const ext = reach(r);
      const lo = Math.max(0, Math.floor(cx - ext - ox));
      const hi = Math.min(w - 1, Math.ceil(cx + ext - ox));

      grow_box(lo + ox, py + oy, hi + ox, py + oy);

      for (let px = lo; px <= hi; px++) {
        const side = px + PIXEL_CENTER + ox - cx;
        const d = Math.abs(side);

        put(py * w + px, d < r ? Math.sqrt(r * r - d * d) : r - d, base_y - (py + oy), side, r);
      }
    }
  }

  let al = base_y - sk.y[top]!;

  for (let i = main[top]!; i >= 0; i = main[i]!) {
    al = spline_segment(sk, rr, kids, main, i, al, capsule);
  }

  merge();

  for (let i = 0; i < n; i++) {
    const p = sk.parent[i]!;

    if (p < 0 || main[p] === i || in_trunk[i]) {
      continue;
    }

    sink_len = sk.r[p]! * S.sink_len;

    let length = 0;

    for (let j = i; j >= 0; j = main[j]!) {
      length = spline_segment(sk, rr, kids, main, j, length, capsule);
    }

    merge();
  }

  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? FIELD_EMPTY : H[y * w + x]!;

  for (let y = 0; y < h && y + oy < clip_y; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;

      if (H[k]! <= 0) {
        continue;
      }

      const below = y + 1 + oy < clip_y ? at(x, y + 1) : 1;
      const left = at(x - 1, y);
      const right = at(x + 1, y);
      const up = at(x, y - 1);

      if (left <= 0 || right <= 0 || up <= 0 || below <= 0) {
        out.set(OUTLINE, k * 4);
        continue;
      }

      const gx = (Math.max(0, right) - Math.max(0, left)) * 0.5;
      const gy = (Math.max(0, below) - Math.max(0, up)) * 0.5;
      const m = Math.hypot(gx, gy, 1);
      const l = (-gx * S.light_x - gy * S.light_y + S.light_z) / m;
      const bayer =
        BAYER[((y + oy) & (BAYER_SIZE - 1)) * BAYER_SIZE + ((x + ox) & (BAYER_SIZE - 1))]! /
        BAYER_LEVELS;
      let v = (l + S.light_bias) * S.light_scale + (bayer - 0.5) * S.dither;
      const rim = clamp01(1 - M[k]! / Math.max(1, rad[k]! * RIM_DEPTH));

      v -=
        Math.min(AO_MAX, (H[k]! - Math.max(0, M[k]!)) / Math.max(1, rad[k]! * AO_DEPTH)) *
        S.ao *
        rim;

      let tone = Math.max(0, Math.min(DEEPEST, Math.floor(v)));
      let bark_al = along[k]!;
      let bark_ac = across[k]!;
      let bark_r = rad[k]!;

      if (M2[k]! > 0 && S.bark_mix > 0) {
        const span = Math.max(1, S.bark_mix * Math.min(rad[k]!, rad2[k]!));

        if (bayer > 0.5 + (0.5 * (M[k]! - M2[k]!)) / span) {
          bark_al = along2[k]!;
          bark_ac = across2[k]!;
          bark_r = rad2[k]!;
        }
      }

      if (bark_r >= S.bark_min_r) {
        const col = Math.floor(bark_ac / S.bark_width + BARK_COLUMN_SHIFT);
        const phase = hash2(col, BARK_PHASE_ROW, BARK_PHASE_SALT) * S.bark_length;

        if (hash2(col, Math.floor(bark_al / S.bark_length + phase), BARK_SALT) < S.bark_chance) {
          tone = Math.max(0, tone - 1);
        }
      }

      out.set(BARK[tone]!, k * 4);
    }
  }
};

const stamp = (
  buf: Uint8Array,
  w: number,
  h: number,
  ox: number,
  oy: number,
  leaves: Leaves,
  i: number,
) => {
  const hl = leaves.len[i]! / 2;
  const hw = Math.max(1, hl * S.leaf_width);
  const c = Math.cos(leaves.angle[i]!);
  const s = Math.sin(leaves.angle[i]!);
  const ext = Math.ceil(hl) + 1;
  const px0 = Math.round(leaves.x[i]! - ox);
  const py0 = Math.round(leaves.y[i]! - oy);
  const tone = leaves.tone[i]!;

  for (let y = -ext; y <= ext; y++) {
    for (let x = -ext; x <= ext; x++) {
      const u = x * c + y * s;
      const v = -x * s + y * c;
      const tx = px0 + x;
      const ty = py0 + y;

      if ((u * u) / (hl * hl) + (v * v) / (hw * hw) > 1 || tx < 0 || ty < 0 || tx >= w || ty >= h) {
        continue;
      }

      buf[ty * w + tx] = Math.min(LEAF_TONES - 1, tone + (x + y < 0 ? 1 : 0)) + 1;
    }
  }
};

const paint_leaves = (
  leaves: Leaves,
  ox: number,
  oy: number,
  w: number,
  h: number,
  clip_y: number,
  out: Uint8ClampedArray,
) => {
  const back = new Uint8Array(w * h);
  const front = new Uint8Array(w * h);

  for (let i = 0; i < leaves.count; i++) {
    stamp(leaves.front[i] ? front : back, w, h, ox, oy, leaves, i);
  }

  const leaf_at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && (back[y * w + x]! > 0 || front[y * w + x]! > 0);
  const g = S.leaf_edge_gap;

  for (let y = 0; y < h && y + oy < clip_y; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x;
      const bark = out[k * 4 + 3]! > 0;
      const tone = front[k]! > 0 ? front[k]! : !bark ? back[k]! : 0;

      if (tone === 0) {
        continue;
      }

      const edge = !leaf_at(x + 1, y + g) && !leaf_at(x + g, y + 1) && !leaf_at(x, y + g);

      out.set(LEAF_COLORS[edge ? 0 : tone - 1]!, k * 4);
    }
  }
};

export const render_tree_pixels = (tree: Tree): Uint8ClampedArray<ArrayBuffer> => {
  const { x: ox, y: oy, w, h } = tree.bounds;
  const out = new Uint8ClampedArray(w * h * 4);
  const clip_y = tree.ground_y + tree.ground_depth;

  paint_bark(tree.skeleton, ox, oy, w, h, clip_y, out);
  paint_leaves(grow_leaves(tree.skeleton, tree.blobs, tree.seed), ox, oy, w, h, clip_y, out);

  return out;
};

export const tree_pixels_task = define_task({
  name: 'tree.pixels',
  run: render_tree_pixels,
  transfer: pixels => [pixels.buffer],
});

export const load_tree_sprite = (engine: BIRD.EngineContext, tree: Tree, sprite: LazySprite) => {
  const { resources } = engine;
  const { w, h } = tree.bounds;
  const render = () => resources.workers.run(tree_pixels_task, tree, NO_TRANSFER);
  const code = resources.workers.source_hash;
  const pixels =
    code === null
      ? render()
      : resources.persistent.remember(
          'tree.pixels',
          `${code}:${hash_text(JSON.stringify(tree)).toString(36)}`,
          render,
        );

  fill_lazy_sprite(
    sprite,
    pixels.then(pixels => canvas_from_pixels(pixels, w, h)),
    'tree',
  );
};
