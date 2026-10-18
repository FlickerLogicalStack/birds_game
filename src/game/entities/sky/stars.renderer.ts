import { is_sprite_ready } from '../../../engine/lazy_sprite';
import { rgb_css } from '../../utils/color';
import { MS_PER_SECOND, smoothstep, TAU } from '../../utils/math';
import { create_rng, range } from '../../utils/random';
import { DAY_CYCLE_MS } from './sky';
import { STARS_TILE } from './stars.sprites';
import { with_smoothing } from '../../utils/draw';
import { CONFIG } from '../../../config';

const STARS_FROM = CONFIG.stars.appear_from;
const MIN_VISIBILITY = CONFIG.stars.min_visibility;
const STARS_DRIFT = CONFIG.stars.drift;

const TWINKLE_COUNT = CONFIG.stars.twinkle_count;
const TWINKLE_SEED = CONFIG.stars.twinkle_seed;
const TWINKLE_COLOR = rgb_css(CONFIG.stars.twinkle_color, 1);
const MIN_TWINKLE_PERIOD = CONFIG.stars.twinkle_min_period;
const MAX_TWINKLE_PERIOD = CONFIG.stars.twinkle_max_period;
const TWINKLE_LOW = CONFIG.stars.twinkle_low;

type TwinkleStar = {
  x: number;
  y: number;
  size: number;
  speed: number;
  phase: number;
};

const TWINKLE_STARS: readonly TwinkleStar[] = (() => {
  const rng = create_rng(TWINKLE_SEED);

  return Array.from({ length: TWINKLE_COUNT }, () => ({
    x: rng(),
    y: rng(),
    size: rng() < 0.25 ? 2 : 1,
    speed: TAU / range(rng, MIN_TWINKLE_PERIOD, MAX_TWINKLE_PERIOD),
    phase: range(rng, 0, TAU),
  }));
})();

export const stars_visibility = (light: number) => smoothstep(STARS_FROM, 1, 1 - light);

export const render_stars = (
  engine: BIRD.EngineContext,
  scene: BIRD.PrimaryScene,
  horizon: number,
  light: number,
) => {
  const visibility = stars_visibility(light);
  const stars = engine.resources.stars;

  if (visibility < MIN_VISIBILITY || !is_sprite_ready(stars) || horizon <= 0) {
    return;
  }

  const ctx = engine.ctx;
  const { width, pixel_ratio, dpr } = engine.canvas;
  const tile = STARS_TILE * pixel_ratio;
  const drift = scene.day.phase * STARS_DRIFT * pixel_ratio;
  const prev_alpha = ctx.globalAlpha;

  ctx.globalAlpha = visibility;
  with_smoothing(ctx, pixel_ratio * dpr === 1, () => {
    const start_x = (drift % tile) - tile;

    for (let y = 0; y < horizon; y += tile) {
      const h = Math.min(tile, horizon - y);

      for (let x = start_x; x < width; x += tile) {
        ctx.drawImage(stars.canvas, 0, 0, STARS_TILE, h / pixel_ratio, x, y, tile, h);
      }
    }

    const seconds = (scene.day.phase * DAY_CYCLE_MS) / MS_PER_SECOND;

    ctx.fillStyle = TWINKLE_COLOR;

    for (const star of TWINKLE_STARS) {
      const wave = 0.5 + 0.5 * Math.sin(seconds * star.speed + star.phase);
      const size = star.size * pixel_ratio;
      const x = (star.x * width + drift) % width;
      const y = Math.round(star.y * horizon);

      ctx.globalAlpha = visibility * (TWINKLE_LOW + (1 - TWINKLE_LOW) * wave);
      ctx.fillRect(x, y, size, size);
    }
  });

  ctx.globalAlpha = prev_alpha;
};
