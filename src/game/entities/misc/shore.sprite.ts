import { mix_rgb, type RGB } from '../../utils/color';
import { clamp01, smoothstep } from '../../utils/math';
import { create_rng, hash2, type Rng } from '../../utils/random';
import {
  count_for,
  create_strip,
  GROUND_RISE,
  paint_soil,
  shade_soil,
  wave,
  wave_cells,
  type Put,
} from './ground.sprite';
import type { Tree } from '../tree/tree';
import { CONFIG } from '../../../config';

const G = CONFIG.ground;
const S = G.shore;
const C = S.colors;
const GRASS = G.colors;
const SEED = S.seed;
const BEACH = S.beach;
const SEA_X = BEACH;
export const WATER_LEVEL = S.water_level;
const BLEND = S.sand_blend;
const GLINT_EDGE = 8;

export const SHORE_W = SEA_X + S.sea;

export const shore_x = (tree: Tree) => tree.trunk_x + S.from_trunk;

const water_tone = (d: number) => mix_rgb(C.water, C.water_deep, clamp01(d / S.water_fade));

const WATER_TONES: RGB[] = [];

for (let d = 0; d <= G.soil_depth; d++) {
  WATER_TONES.push(water_tone(d));
}

type WetTones = { light: RGB; base: RGB; dark: RGB };

const WET: WetTones = { light: C.sand_dark, base: C.wet_sand, dark: C.sand_shadow };

const BED_TONES: WetTones[] = [];

for (let d = 0; d <= G.soil_depth; d++) {
  const water = WATER_TONES[d]!;
  const tint = S.bed_tint * clamp01(d / S.water_fade);

  BED_TONES.push({
    light: mix_rgb(WET.light, water, tint),
    base: mix_rgb(WET.base, water, tint),
    dark: mix_rgb(WET.dark, water, tint),
  });
}

const wet_pixel = (tones: WetTones, n: number) =>
  n < S.sand_dark_grain ? tones.dark : n > 1 - S.sand_light_grain ? tones.light : tones.base;

const sand_top = (x: number) => {
  if (x <= SEA_X) {
    const t = Math.max(0, x / BEACH);

    return S.sand_drop + (WATER_LEVEL - S.sand_drop) * t ** S.bed_curve;
  }

  const sea_x = x - SEA_X;

  return (
    WATER_LEVEL +
    sea_x * S.shelf_slope +
    S.bed_depth * smoothstep(S.shelf, S.shelf + S.drop_width, sea_x)
  );
};

export const sand_surface = (x: number) => Math.round(sand_top(x));

export const DRY_FROM = Math.round(S.beach_grass / 2);
export const DRY_TO = BEACH - S.wet_width - 6;

const sea_x_of_depth = (depth: number) => {
  let x = SEA_X;

  while (x < SHORE_W - 1 && sand_top(x) - WATER_LEVEL < depth) {
    x++;
  }

  return x;
};

export const SHALLOW_FROM = sea_x_of_depth(S.bath_depth_min);
export const SHALLOW_TO = Math.max(SHALLOW_FROM, sea_x_of_depth(S.bath_depth_max));

const beach_sand = (x: number, gy: number, top: number): RGB => {
  const n = hash2(x, gy, SEED);
  const wet_chance = (x - (SEA_X - S.wet_width)) / S.wet_width;
  const wet =
    gy >= WATER_LEVEL + (hash2(x, gy, SEED + 1) < 0.5 ? 0 : 1) ||
    hash2(x, gy, SEED + 4) < wet_chance;

  if (wet) {
    return wet_pixel(WET, n);
  }

  if (gy === top) {
    return n < 0.35 ? C.sand : C.sand_light;
  }

  return n < S.sand_light_grain ? C.sand_light : n > 1 - S.sand_dark_grain ? C.sand_dark : C.sand;
};

const bed_sand = (x: number, gy: number, d: number): RGB =>
  wet_pixel(BED_TONES[Math.min(d, BED_TONES.length - 1)]!, hash2(x, gy, SEED));

const pixel_at = (out: Uint8ClampedArray, x: number, gy: number): RGB => {
  const i = (x + (gy + GROUND_RISE) * SHORE_W) * 4;

  return [out[i]!, out[i + 1]!, out[i + 2]!];
};

const paint_columns = (
  out: Uint8ClampedArray,
  put: Put,
  clear: (x: number, gy: number) => void,
  cells: number,
) => {
  for (let x = 0; x < SHORE_W; x++) {
    const raw = sand_top(x);
    const under_water = raw > WATER_LEVEL;
    const ripple = under_water ? Math.round(wave(x, cells, 11) * S.bed_ripple) : 0;
    const top = (under_water ? Math.floor(raw + hash2(x, 3, SEED)) : Math.round(raw)) + ripple;
    const depth = S.sand_depth + Math.round(wave(x, cells, 12) * S.sand_wave);
    const sand_bottom = top + Math.round(depth * smoothstep(0, S.sand_ramp_width, x));
    const blend_top = Math.max(top, sand_bottom - (BLEND >> 1));
    const air_bottom = under_water ? WATER_LEVEL : top;
    const soil_share = S.soil_show * (1 - smoothstep(0, S.soil_show_width, x));

    for (let gy = -GROUND_RISE; gy < air_bottom; gy++) {
      clear(x, gy);
    }

    if (under_water) {
      const foam = x - SEA_X < S.foam_width * (0.5 + 0.5 * hash2(x, 1, SEED));
      const clarity = S.shallow_clear * (1 - clamp01((top - WATER_LEVEL) / S.shallow_depth));

      for (let gy = WATER_LEVEL; gy < top; gy++) {
        const d = gy - WATER_LEVEL;
        const water = d === 0 ? C.water_surface : WATER_TONES[Math.min(d, WATER_TONES.length - 1)]!;
        const is_foam = d === 0 && foam && hash2(x, 2, SEED) < 0.75;

        put(x, gy, is_foam ? C.foam : mix_rgb(water, wet_pixel(WET, hash2(x, gy, SEED)), clarity));
      }
    }

    for (let gy = top; gy < blend_top + BLEND; gy++) {
      const keep = gy < blend_top || hash2(x, gy, SEED + 5) < 1 - (gy - blend_top + 0.5) / BLEND;

      if (keep && under_water) {
        put(x, gy, bed_sand(x, gy, top - WATER_LEVEL));
      } else if (keep) {
        const sand = beach_sand(x, gy, top);

        put(x, gy, soil_share > 0 ? mix_rgb(sand, pixel_at(out, x, gy), soil_share) : sand);
      }
    }
  }
};

const paint_glints = (put: Put, rng: Rng) => {
  const sea = S.sea - GLINT_EDGE;

  for (let i = 0; i < count_for(sea, S.glint_spacing); i++) {
    const x = SEA_X + Math.floor(rng() * sea);
    const d = 1 + Math.floor(rng() ** 1.6 * (S.glint_depth - 1));
    const length = 2 + Math.floor(rng() * 4);
    const color = mix_rgb(C.glint, WATER_TONES[d]!, d / S.glint_depth);

    for (let k = 0; k < length; k++) {
      if (sand_top(x + k) > WATER_LEVEL + d + 1) {
        put(x + k, WATER_LEVEL + d, color);
      }
    }
  }
};

const paint_shells = (put: Put, rng: Rng) => {
  const from = 8;
  const span = SEA_X - from - 6;

  for (let i = 0; i < count_for(span, S.shell_spacing); i++) {
    const x = from + Math.floor(rng() * span);
    const [light, dark] = S.shells[Math.floor(rng() * S.shells.length)]!;
    const top = Math.round(sand_top(x));

    put(x, top - 1, light);
    put(x + 1, top - 1, dark);

    if (rng() < 0.4) {
      put(x, top - 2, light);
    }
  }
};

const blade = (put: Put, x: number, height: number, lean: number) => {
  const top = Math.round(sand_top(x));

  for (let k = 1; k <= height; k++) {
    const tip = k === height;

    put(tip && height >= 3 ? x + lean : x, top - k, tip ? GRASS.grass_light : GRASS.grass_dark);
  }
};

const paint_grass_edge = (put: Put, rng: Rng) => {
  for (let x = 0; x < S.beach_grass; x += 2 + Math.floor(rng() * 4)) {
    if (rng() > 1 - x / S.beach_grass) {
      continue;
    }

    const tall = 2 + Math.floor(rng() * (G.blade_max - 1));

    blade(put, x, tall, rng() < 0.5 ? -1 : 1);
    blade(put, x + 1, Math.max(1, tall - 1 - Math.floor(rng() * 2)), 1);
  }
};

export const render_shore_pixels = (land_w: number): Uint8ClampedArray<ArrayBuffer> => {
  const { out, put, clear } = create_strip(SHORE_W, false);
  const cells = wave_cells(land_w);
  const rng = create_rng(SEED);

  paint_soil(put, SHORE_W, cells, land_w);
  paint_columns(out, put, clear, cells);
  paint_glints(put, rng);
  paint_shells(put, rng);
  paint_grass_edge(put, rng);
  shade_soil(out, SHORE_W);

  return out;
};
