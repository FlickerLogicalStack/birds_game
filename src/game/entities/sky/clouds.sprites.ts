import { NO_TRANSFER } from '../../../engine/worker';
import { canvas_from_pixels } from '../../../engine/canvas';
import { fill_lazy_sprite, type LazySprite } from '../../../engine/lazy_sprite';
import { define_task } from '../../../engine/worker.task';
import type { RGB } from '../../utils/color';
import { lerp } from '../../utils/math';
import { create_rng, range, type Rng } from '../../utils/random';
import { CONFIG } from '../../../config';

export const CLOUD_SPRITE_COUNT = CONFIG.clouds.sprite_count;
const CLOUDS_SEED = CONFIG.clouds.sprite_seed;

const MIN_WIDTH = CONFIG.clouds.min_width;
const MAX_WIDTH = CONFIG.clouds.max_width;
const MIN_PUFF_RADIUS = CONFIG.clouds.min_puff_radius;
const MAX_PUFF_RADIUS_SHARE = CONFIG.clouds.max_puff_radius_share;
const MAX_PUFF_RADIUS = CONFIG.clouds.max_puff_radius;
const WIDTH_PER_PUFF = CONFIG.clouds.width_per_puff;
const OPAQUE = 255;

const CLOUD_LIT = CONFIG.clouds.lit_color;
const CLOUD_SHADE = CONFIG.clouds.shade_color;
const CLOUD_BASE = CONFIG.clouds.base_color;
const LIT_RADIUS = CONFIG.clouds.lit_radius;
const LIT_SHIFT_X = CONFIG.clouds.lit_shift_x;
const LIT_SHIFT_Y = CONFIG.clouds.lit_shift_y;
const RIM_BELOW = CONFIG.clouds.rim_below;
const LIT = 1;
const SHADE = 2;
const BASE = 3;
const TONES: readonly (RGB | undefined)[] = [undefined, CLOUD_LIT, CLOUD_SHADE, CLOUD_BASE];
const BASE_ROWS = CONFIG.clouds.base_rows;
const SLAB_ROWS = CONFIG.clouds.slab_rows;
const SLAB_REACH = CONFIG.clouds.slab_reach;
const MIN_PUFF_RADIUS_PX = CONFIG.clouds.min_puff_radius_px;
const SLAB = -2;

type Puff = { x: number; y: number; r: number };

export type CloudPixels = { width: number; height: number; pixels: Uint8ClampedArray<ArrayBuffer> };

const cloud_puffs = (rng: Rng, width: number) => {
  const share = range(rng, MIN_PUFF_RADIUS, MAX_PUFF_RADIUS_SHARE);
  const max_r = Math.max(MIN_PUFF_RADIUS_PX, Math.min(MAX_PUFF_RADIUS, width * share));
  const count = Math.max(2, Math.round(width / Math.max(WIDTH_PER_PUFF, max_r * 1.4)));
  const back: Puff[] = [];
  const front: Puff[] = [];

  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const r = max_r * (0.55 + 0.45 * Math.sin(Math.PI * t)) * range(rng, 0.85, 1.1);

    front.push({ x: lerp(r, width - r, t) + range(rng, -1, 1), y: 0, r });
  }

  const back_count = Math.max(1, Math.round(count / 2) - 1);

  for (let i = 0; i < back_count; i++) {
    const t = (i + 0.5) / back_count;
    const r = max_r * range(rng, 1, 1.25);

    back.push({ x: lerp(width * 0.25, width * 0.75, t) + range(rng, -2, 2), y: 0, r });
  }

  return { back, front };
};

const clean_specks = (tone: Uint8Array, width: number, height: number) => {
  const source = tone.slice();
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? 0 : source[y * width + x]!;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const own = source[y * width + x]!;

      if (own !== LIT && own !== SHADE) {
        continue;
      }

      const other = own === LIT ? SHADE : LIT;
      const around =
        (at(x - 1, y) === other ? 1 : 0) +
        (at(x + 1, y) === other ? 1 : 0) +
        (at(x, y - 1) === other ? 1 : 0) +
        (at(x, y + 1) === other ? 1 : 0);

      if (around >= 3) {
        tone[y * width + x] = other;
      }
    }
  }
};

const outline_front_puffs = (
  tone: Uint8Array,
  owner: Int16Array,
  puffs: readonly Puff[],
  width: number,
  height: number,
) => {
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= width || y >= height ? -1 : owner[y * width + x]!;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = at(x, y);

      if (i < 0 || tone[y * width + x] !== LIT || y + 0.5 > puffs[i]!.y + puffs[i]!.r * RIM_BELOW) {
        continue;
      }

      const left = at(x - 1, y);
      const right = at(x + 1, y);
      const up = at(x, y - 1);

      if ((left >= 0 && left < i) || (right >= 0 && right < i) || (up >= 0 && up < i)) {
        tone[y * width + x] = SHADE;
      }
    }
  }
};

const cloud_pixels = (rng: Rng, width: number): CloudPixels => {
  const { back, front } = cloud_puffs(rng, width);
  const max_r = Math.max(...back.map(p => p.r), ...front.map(p => p.r));
  const height = Math.ceil(max_r * 2.4) + BASE_ROWS;
  const bottom = height - 1;

  for (const p of front) {
    p.y = bottom - BASE_ROWS - p.r * range(rng, 0.75, 1);
  }

  for (const p of back) {
    p.y = bottom - max_r * range(rng, 0.9, 1.1);
  }

  const puffs = [...back, ...front];
  const slab_left = Math.min(...front.map(p => p.x - p.r * SLAB_REACH));
  const slab_right = Math.max(...front.map(p => p.x + p.r * SLAB_REACH));
  const slab_top = Math.min(bottom - SLAB_ROWS, Math.max(...front.map(p => p.y)));
  const owner = new Int16Array(width * height).fill(-1);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y + 0.5 > slab_top && x + 0.5 >= slab_left && x + 0.5 <= slab_right) {
        owner[y * width + x] = SLAB;
      }

      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]!;

        if (Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y) <= p.r) {
          owner[y * width + x] = i;
          break;
        }
      }
    }
  }

  const tone = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = owner[y * width + x]!;

      if (i === -1) {
        continue;
      }

      if (y > bottom - BASE_ROWS) {
        tone[y * width + x] = BASE;
      } else if (i === SLAB) {
        tone[y * width + x] = SHADE;
      } else {
        const p = puffs[i]!;
        const dx = (x + 0.5 - p.x) / p.r;
        const dy = (y + 0.5 - p.y) / p.r;
        const lit = Math.hypot(dx + LIT_SHIFT_X, dy + LIT_SHIFT_Y) <= LIT_RADIUS;

        tone[y * width + x] = lit ? LIT : SHADE;
      }
    }
  }

  clean_specks(tone, width, height);
  outline_front_puffs(tone, owner, puffs, width, height);

  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < tone.length; i++) {
    const color = TONES[tone[i]!];

    if (color) {
      pixels[i * 4] = color[0];
      pixels[i * 4 + 1] = color[1];
      pixels[i * 4 + 2] = color[2];
      pixels[i * 4 + 3] = OPAQUE;
    }
  }

  return { width, height, pixels };
};

const clouds_pixels = (): CloudPixels[] => {
  const rng = create_rng(CLOUDS_SEED);

  return Array.from({ length: CLOUD_SPRITE_COUNT }, (_, i) =>
    cloud_pixels(
      rng,
      Math.round(lerp(MIN_WIDTH, MAX_WIDTH, i / (CLOUD_SPRITE_COUNT - 1)) + range(rng, -2, 2)),
    ),
  );
};

export const clouds_pixels_task = define_task({
  name: 'sky.clouds',
  run: clouds_pixels,
  transfer: clouds => clouds.map(cloud => cloud.pixels.buffer),
});

const to_canvas = ({ width, height, pixels }: CloudPixels) =>
  canvas_from_pixels(pixels, width, height);

export const load_cloud_sprites = (engine: BIRD.EngineContext) => {
  const { resources } = engine;
  const clouds = resources.workers.run(clouds_pixels_task, undefined, NO_TRANSFER);

  resources.clouds.forEach((sprite: LazySprite, i) =>
    fill_lazy_sprite(
      sprite,
      clouds.then(all => to_canvas(all[i]!)),
      `cloud ${i}`,
    ),
  );
};
