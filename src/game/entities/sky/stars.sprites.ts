import { NO_TRANSFER } from '../../../engine/worker';
import { canvas_from_pixels } from '../../../engine/canvas';
import { fill_lazy_sprite } from '../../../engine/lazy_sprite';
import { define_task } from '../../../engine/worker.task';
import type { RGB } from '../../utils/color';
import { create_rng, pick, range } from '../../utils/random';
import type { SquarePixels } from './sky.sprites';
import { CONFIG } from '../../../config';

export const STARS_TILE = CONFIG.stars.tile;
const STAR_COUNT = CONFIG.stars.count;
const STARS_SEED = CONFIG.stars.seed;

const STAR_COLORS = CONFIG.stars.colors;
const MIN_ALPHA = CONFIG.stars.min_alpha;
const MAX_ALPHA = CONFIG.stars.max_alpha;
const DIM_BIAS = CONFIG.stars.dim_bias;
const CROSS_SHARE = CONFIG.stars.cross_share;
const CROSS_ARM = CONFIG.stars.cross_arm;

const stars_pixels = (): SquarePixels => {
  const rng = create_rng(STARS_SEED);
  const size = STARS_TILE;
  const pixels = new Uint8ClampedArray(size * size * 4);

  const put = (x: number, y: number, color: RGB, alpha: number) => {
    const i = (((y + size) % size) * size + ((x + size) % size)) * 4;
    const a = Math.round(alpha * 255);

    if (a > pixels[i + 3]!) {
      pixels[i] = color[0];
      pixels[i + 1] = color[1];
      pixels[i + 2] = color[2];
      pixels[i + 3] = a;
    }
  };

  for (let i = 0; i < STAR_COUNT; i++) {
    const x = Math.floor(rng() * size);
    const y = Math.floor(rng() * size);
    const color = pick(STAR_COLORS, rng, STAR_COLORS[0]!);

    if (rng() < CROSS_SHARE) {
      put(x, y, color, MAX_ALPHA);
      put(x - 1, y, color, CROSS_ARM);
      put(x + 1, y, color, CROSS_ARM);
      put(x, y - 1, color, CROSS_ARM);
      put(x, y + 1, color, CROSS_ARM);
    } else {
      put(x, y, color, range(rng, 0, 1) ** DIM_BIAS * (MAX_ALPHA - MIN_ALPHA) + MIN_ALPHA);
    }
  }

  return { size, pixels };
};

export const stars_pixels_task = define_task({
  name: 'sky.stars',
  run: stars_pixels,
  transfer: stars => [stars.pixels.buffer],
});

export const load_star_sprites = (engine: BIRD.EngineContext) => {
  const { resources } = engine;
  const stars = resources.workers
    .run(stars_pixels_task, undefined, NO_TRANSFER)
    .then(({ size, pixels }) => canvas_from_pixels(pixels, size, size));

  fill_lazy_sprite(resources.stars, stars, 'stars');
};
