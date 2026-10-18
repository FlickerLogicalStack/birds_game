import { mix_rgb, type RGB } from '../../utils/color';
import { clamp01, lerp, mod } from '../../utils/math';
import { create_rng, hash2, range, type Rng } from '../../utils/random';
import { CONFIG } from '../../../config';

const G = CONFIG.ground;
const C = G.colors;
const SEED = G.seed;
const GRASS_DEPTH = G.grass_depth;
const BLADE_MAX = G.blade_max;
const FLOWER_STEM = G.flower_stem;
const SOIL_DEPTH = G.soil_depth;
const SOIL_FADE = G.soil_fade;
const LAYERS = G.soil_layers;
const SHADE_FROM = G.shade_from;
const SHADE_MIN = G.shade_min;
const SHADE_CURVE = G.shade_curve;
const INCLUSION_TOP = GRASS_DEPTH + 3;
const INCLUSION_BOTTOM = SOIL_DEPTH - SOIL_FADE;
const WAVE_PERIOD = 12;
const OPAQUE = 255;

const BLACK: RGB = [0, 0, 0];
const WHITE: RGB = [255, 255, 255];
const LAYER_TONES = LAYERS.map(({ color }) => ({
  base: color,
  dark: mix_rgb(color, BLACK, 0.14),
  light: mix_rgb(color, WHITE, 0.08),
}));

export const GROUND_RISE = FLOWER_STEM + 2;
export const GROUND_STRIP_H = GROUND_RISE + SOIL_DEPTH;

type Stone = readonly [RGB, RGB, RGB];

export type Put = (x: number, gy: number, color: RGB) => void;

export const wave = (x: number, cells: number, salt: number) => {
  const t = x / WAVE_PERIOD;
  const i = Math.floor(t);
  const f = t - i;
  const a = hash2(mod(i, cells), salt, SEED);
  const b = hash2(mod(i + 1, cells), salt, SEED);

  return lerp(a, b, f * f * (3 - 2 * f)) * 2 - 1;
};

export const wave_cells = (w: number) => Math.max(1, Math.round(w / WAVE_PERIOD));

export const count_for = (w: number, spacing: number) => Math.round(w / spacing);

const inclusion_depth = (rng: Rng, margin: number) =>
  Math.floor(range(rng, INCLUSION_TOP, INCLUSION_BOTTOM - margin));

export const paint_soil = (put: Put, w: number, cells: number, x0: number) => {
  for (let x = 0; x < w; x++) {
    const wx = x0 + x;
    let layer = 0;
    let boundary = LAYERS[0]!.thickness + Math.round(wave(wx, cells, 0) * G.layer_wave);

    for (let gy = 0; gy < SOIL_DEPTH; gy++) {
      while (gy >= boundary && layer < LAYERS.length - 1) {
        layer += 1;
        boundary += LAYERS[layer]!.thickness + Math.round(wave(wx, cells, layer) * G.layer_wave);
      }

      const fade = 1 - clamp01((gy - INCLUSION_BOTTOM) / SOIL_FADE);
      const near_boundary = gy === boundary - 1 && layer < LAYERS.length - 1;
      const tones =
        LAYER_TONES[near_boundary && hash2(wx, gy, SEED + 3) < 0.5 ? layer + 1 : layer]!;
      const clump = hash2(wx >> 1, gy >> 1, SEED + 4);
      let color = tones.base;

      if (hash2(wx, gy, SEED + 5) < G.grain * fade) {
        color = G.grain_color;
      } else if (clump < G.clump_dark * fade) {
        color = tones.dark;
      } else if (clump > 1 - G.clump_light * fade) {
        color = tones.light;
      }

      put(x, gy, color);
    }
  }
};

const paint_pebble = (put: Put, x: number, gy: number, pw: number, ph: number, stone: Stone) => {
  const [light, mid, dark] = stone;

  for (let dy = 0; dy < ph; dy++) {
    for (let dx = 0; dx < pw; dx++) {
      if (ph === 2 && dy === 0 && (dx === 0 || dx === pw - 1)) {
        continue;
      }

      const lit = dy === 0 && dx <= pw / 2;
      const shade = dx === pw - 1 || (ph === 2 && dy === 1 && dx === pw - 2);

      put(x + dx, gy + dy, lit ? light : shade ? dark : mid);
    }
  }

  for (let dx = 1; dx <= pw; dx++) {
    put(x + dx, gy + ph, C.soil_shadow);
  }
};

const paint_rock = (put: Put, cx: number, cy: number, rx: number, ry: number, stone: Stone) => {
  const [light, mid, dark] = stone;

  for (let dy = -ry; dy <= ry; dy++) {
    for (let dx = -rx; dx <= rx + 1; dx++) {
      const nx = dx / (rx + 0.5);
      const ny = dy / (ry + 0.5);
      const d = nx * nx + ny * ny;

      if (d > 1) {
        if (dy > 0 && (nx * nx) / 1.1 + ((dy - 1) / (ry + 0.5)) ** 2 <= 1) {
          put(cx + dx, cy + dy, C.soil_shadow);
        }

        continue;
      }

      const side = nx + ny;

      put(cx + dx, cy + dy, side < -0.55 ? light : side > 0.6 || d > 0.8 ? dark : mid);
    }
  }

  put(cx, cy, dark);
  put(cx + 1, cy + 1, dark);
};

const paint_root = (put: Put, rng: Rng, x: number) => {
  const length = 4 + Math.floor(rng() * (G.root_length_max - 3));
  const branch_at = rng() < 0.3 ? 2 + Math.floor(rng() * (length - 2)) : -1;
  let drift = rng() < 0.5 ? -1 : 1;
  let rx = x;

  for (let k = 0; k < length; k++) {
    const gy = GRASS_DEPTH + k;

    put(rx, gy, G.root_color);

    if (k === branch_at) {
      for (let j = 1; j <= 3; j++) {
        put(rx - drift * j, gy + j, G.root_color);
      }
    }

    if (rng() < 0.35) {
      rx += drift;
    }

    if (rng() < 0.2) {
      drift = -drift;
    }
  }
};

const paint_bone = (put: Put, x: number, gy: number) => {
  put(x, gy, G.bone);
  put(x + 5, gy, G.bone);

  for (let dx = 1; dx <= 4; dx++) {
    put(x + dx, gy + 1, G.bone);
  }

  put(x, gy + 2, G.bone_shade);
  put(x + 5, gy + 2, G.bone_shade);
};

const paint_worm = (put: Put, x: number, gy: number) => {
  put(x, gy, G.worm);
  put(x + 1, gy, G.worm);
  put(x + 2, gy + 1, G.worm);
  put(x + 3, gy + 1, G.worm_shade);
};

const paint_inclusions = (put: Put, rng: Rng, w: number) => {
  const stones = G.stones;
  const stone = () => stones[Math.floor(rng() * stones.length)]!;

  for (let i = 0; i < count_for(w, G.rock_spacing); i++) {
    const rx = 3 + Math.floor(rng() * 2);
    const ry = 2;

    paint_rock(put, Math.floor(rng() * w), inclusion_depth(rng, ry + 1) + ry, rx, ry, stone());
  }

  for (let i = 0; i < count_for(w, G.pebble_spacing); i++) {
    const pw = 2 + Math.floor(rng() * 3);
    const ph = pw >= 3 && rng() < 0.6 ? 2 : 1;

    paint_pebble(put, Math.floor(rng() * w), inclusion_depth(rng, ph + 1), pw, ph, stone());
  }

  for (let i = 0; i < count_for(w, G.bone_spacing); i++) {
    paint_bone(put, Math.floor(rng() * w), inclusion_depth(rng, 3));
  }

  for (let i = 0; i < count_for(w, G.worm_spacing); i++) {
    paint_worm(put, Math.floor(rng() * w), inclusion_depth(rng, 2));
  }

  for (let i = 0; i < count_for(w, G.root_spacing); i++) {
    paint_root(put, rng, Math.floor(rng() * w));
  }
};

const paint_grass = (put: Put, rng: Rng, w: number) => {
  for (let x = 0; x < w; x++) {
    const band =
      GRASS_DEPTH -
      1 +
      Math.floor(hash2(x >> 1, 0, SEED) * 3) +
      (hash2(x, 1, SEED) < G.root_chance ? 2 : 0);

    for (let gy = 0; gy < band; gy++) {
      const n = hash2(x, gy, SEED + 1);
      const above_edge = band - 1 - gy;
      let color = C.grass;

      if (gy === 0) {
        color = n < 0.25 ? C.grass : C.grass_light;
      } else if (above_edge === 0) {
        color = C.grass_edge;
      } else if (above_edge === 1) {
        color = n < 0.5 ? C.grass_edge : C.grass_dark;
      } else if (gy <= 2 && n < 0.12) {
        color = C.grass_light;
      } else if (n < (gy / band) * 0.6) {
        color = C.grass_dark;
      }

      put(x, gy, color);
    }

    put(x, band, C.soil_shadow);
  }

  const blade = (x: number, height: number, lean: number, color: RGB, tip: RGB) => {
    for (let k = 1; k <= height; k++) {
      const top = k === height;

      put(top && height >= 3 ? x + lean : x, -k, top ? tip : color);
    }
  };

  const gap = G.tuft_gap_max - G.tuft_gap_min + 1;

  for (let x = Math.floor(rng() * gap); x < w; x += G.tuft_gap_min + Math.floor(rng() * gap)) {
    const tall = 2 + Math.floor(rng() * (BLADE_MAX - 1));
    const lean = rng() < 0.5 ? -1 : 1;

    blade(x - 1, tall - 1 - Math.floor(rng() * 2), -1, C.grass_dark, C.grass);
    blade(x, tall, lean, C.grass, C.grass_light);

    if (rng() < 0.5) {
      blade(x + 1, tall - 1 - Math.floor(rng() * 2), 1, C.grass_dark, C.grass);
    }
  }

  const flowers = Math.max(1, count_for(w, G.flower_spacing));

  for (let i = 0; i < flowers; i++) {
    const x = Math.floor(((i + rng()) / flowers) * w);
    const kind = G.flower_kinds[Math.floor(rng() * G.flower_kinds.length)]!;
    const head = -FLOWER_STEM - 1;

    for (let k = 1; k <= FLOWER_STEM; k++) {
      put(x, -k, C.grass);
    }

    put(x + (rng() < 0.5 ? -1 : 1), -1, C.grass_light);
    put(x, head, kind.center);
    put(x - 1, head, kind.petal);
    put(x + 1, head, kind.petal);
    put(x, head - 1, kind.petal);
  }
};

const soil_shade = (gy: number) =>
  lerp(1, SHADE_MIN, clamp01((gy - SHADE_FROM) / (SOIL_DEPTH - 1 - SHADE_FROM)) ** SHADE_CURVE);

export const DEEP_SOIL = mix_rgb(LAYERS[LAYERS.length - 1]!.color, BLACK, 1 - SHADE_MIN);

export const shade_soil = (out: Uint8ClampedArray, w: number) => {
  for (let gy = SHADE_FROM; gy < SOIL_DEPTH; gy++) {
    const shade = soil_shade(gy);
    const row = (gy + GROUND_RISE) * w * 4;

    for (let i = row; i < row + w * 4; i += 4) {
      out[i] = out[i]! * shade;
      out[i + 1] = out[i + 1]! * shade;
      out[i + 2] = out[i + 2]! * shade;
    }
  }
};

export const create_strip = (w: number, wrap: boolean) => {
  const h = GROUND_STRIP_H;
  const out = new Uint8ClampedArray(w * h * 4);

  const index = (x: number, gy: number) => {
    const y = gy + GROUND_RISE;

    if (y < 0 || y >= h || (!wrap && (x < 0 || x >= w))) {
      return -1;
    }

    return (mod(x, w) + y * w) * 4;
  };

  const put: Put = (x, gy, color) => {
    const i = index(x, gy);

    if (i !== -1) {
      out[i] = color[0];
      out[i + 1] = color[1];
      out[i + 2] = color[2];
      out[i + 3] = OPAQUE;
    }
  };

  const clear = (x: number, gy: number) => {
    const i = index(x, gy);

    if (i !== -1) {
      out.fill(0, i, i + 4);
    }
  };

  return { out, put, clear };
};

export const render_ground_pixels = (w: number): Uint8ClampedArray<ArrayBuffer> => {
  const { out, put } = create_strip(w, true);
  const rng = create_rng(SEED);

  paint_soil(put, w, wave_cells(w), 0);
  paint_inclusions(put, rng, w);
  paint_grass(put, rng, w);
  shade_soil(out, w);

  return out;
};
