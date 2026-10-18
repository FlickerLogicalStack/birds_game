import { NO_TRANSFER } from '../../../engine/worker';
import { canvas_from_pixels } from '../../../engine/canvas';
import { fill_lazy_sprite } from '../../../engine/lazy_sprite';
import { define_task } from '../../../engine/worker.task';
import type { RGB } from '../../utils/color';
import { CONFIG } from '../../../config';

const DISC_EDGE = 0.3;
const OPAQUE = 255;

const SUN_RADIUS = CONFIG.sun.radius;
const SUN_CORE = CONFIG.sun.core;
const SUN_BODY = CONFIG.sun.body;
const SUN_RIM = CONFIG.sun.rim;
const SUN_CORE_INSET = CONFIG.sun.core_inset;
const SUN_RIM_INSET = CONFIG.sun.rim_inset;

const MOON_RADIUS = CONFIG.moon.radius;
const MOON_LIT = CONFIG.moon.lit;
const MOON_SHADED = CONFIG.moon.shaded;
const MOON_SHADE_FROM = CONFIG.moon.shade_from;
const MOON_CRATER = CONFIG.moon.crater;
const MOON_RIM = CONFIG.moon.rim;
const MOON_RIM_INSET = CONFIG.moon.rim_inset;
const CRATERS = CONFIG.moon.craters;

export type SquarePixels = { size: number; pixels: Uint8ClampedArray<ArrayBuffer> };

const disc_pixels = (
  radius: number,
  color: (dx: number, dy: number, d: number) => RGB | null,
): SquarePixels => {
  const size = radius * 2 + 1;
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - radius;
      const dy = y - radius;
      const d = Math.hypot(dx, dy);

      if (d > radius + DISC_EDGE) {
        continue;
      }

      const c = color(dx, dy, d);

      if (c) {
        const i = (y * size + x) * 4;

        pixels[i] = c[0];
        pixels[i + 1] = c[1];
        pixels[i + 2] = c[2];
        pixels[i + 3] = OPAQUE;
      }
    }
  }

  return { size, pixels };
};

const sun_pixels = (): SquarePixels =>
  disc_pixels(SUN_RADIUS, (_dx, _dy, d) => {
    if (d < SUN_RADIUS - SUN_CORE_INSET) {
      return SUN_CORE;
    }

    return d < SUN_RADIUS - SUN_RIM_INSET ? SUN_BODY : SUN_RIM;
  });

const moon_pixels = (): SquarePixels =>
  disc_pixels(MOON_RADIUS, (dx, dy, d) => {
    if (d >= MOON_RADIUS - MOON_RIM_INSET) {
      return MOON_RIM;
    }

    if (CRATERS.some(([cx, cy, r]) => Math.hypot(dx - cx, dy - cy) <= r)) {
      return MOON_CRATER;
    }

    return dx + dy > MOON_SHADE_FROM ? MOON_SHADED : MOON_LIT;
  });

export const sun_pixels_task = define_task({
  name: 'sky.sun',
  run: sun_pixels,
  transfer: sprite => [sprite.pixels.buffer],
});

export const moon_pixels_task = define_task({
  name: 'sky.moon',
  run: moon_pixels,
  transfer: sprite => [sprite.pixels.buffer],
});

const to_canvas = ({ size, pixels }: SquarePixels) => canvas_from_pixels(pixels, size, size);

export const load_sky_sprites = (engine: BIRD.EngineContext) => {
  const { resources } = engine;
  const sun = resources.workers.run(sun_pixels_task, undefined, NO_TRANSFER).then(to_canvas);
  const moon = resources.workers.run(moon_pixels_task, undefined, NO_TRANSFER).then(to_canvas);

  fill_lazy_sprite(resources.sun, sun, 'sun');
  fill_lazy_sprite(resources.moon, moon, 'moon');
};
