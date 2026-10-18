import { is_sprite_ready } from '../../../engine/lazy_sprite';
import { mix_rgb_into, rgb_css, rgb_key, type RGB } from '../../utils/color';
import { lerp } from '../../utils/math';
import { render_stars } from './stars.renderer';
import { daylight, moon_progress, sun_progress, twilight } from './sky';
import { with_smoothing } from '../../utils/draw';
import { CONFIG } from '../../../config';

const DAY_TOP = CONFIG.sky.colors.day_top;
const DAY_BOTTOM = CONFIG.sky.colors.day_bottom;
const NIGHT_TOP = CONFIG.sky.colors.night_top;
const NIGHT_BOTTOM = CONFIG.sky.colors.night_bottom;
const DUSK_BOTTOM = CONFIG.sky.colors.dusk_bottom;
const DUSK_TOP = CONFIG.sky.colors.dusk_top;
const DUSK_TOP_WEIGHT = CONFIG.sky.colors.dusk_top_weight;
const DUSK_BOTTOM_WEIGHT = CONFIG.sky.colors.dusk_bottom_weight;

export const SKY_PIXEL = CONFIG.sky.pixel;
const ARC = CONFIG.sky.arc;
const HORIZON = CONFIG.sky.horizon;

const SUN_GLOW = CONFIG.sky.colors.sun_glow;
const SUN_GLOW_ALPHA = CONFIG.sky.sun_glow_alpha;
const SUN_GLOW_INNER = CONFIG.sky.sun_glow_inner;
const SUN_GLOW_OUTER = CONFIG.sky.sun_glow_outer;
const SUN_GLOW_FROM = rgb_css(SUN_GLOW, SUN_GLOW_ALPHA);
const SUN_GLOW_TO = rgb_css(SUN_GLOW, 0);

const sky_top: RGB = [0, 0, 0];
const sky_bottom: RGB = [0, 0, 0];

const gradients = {
  sky: null as CanvasGradient | null,
  sky_height: -1,
  sky_top: -1,
  sky_bottom: -1,
  glow: null as CanvasGradient | null,
  glow_size: -1,
};

export const sky_horizon = (engine: BIRD.EngineContext) =>
  Math.round(engine.canvas.height * HORIZON);

const body_x = (q: number, size: number, width: number) => Math.round(lerp(-size, width, q));

const body_y = (q: number, size: number, horizon: number) =>
  Math.round(horizon - size / 2 - Math.sin(Math.PI * q) * horizon * ARC);

const sky_gradient = (ctx: CanvasRenderingContext2D, height: number) => {
  const top = rgb_key(sky_top);
  const bottom = rgb_key(sky_bottom);

  if (
    gradients.sky === null ||
    gradients.sky_height !== height ||
    gradients.sky_top !== top ||
    gradients.sky_bottom !== bottom
  ) {
    gradients.sky = ctx.createLinearGradient(0, 0, 0, height);
    gradients.sky.addColorStop(0, rgb_css(sky_top, 1));
    gradients.sky.addColorStop(1, rgb_css(sky_bottom, 1));
    gradients.sky_height = height;
    gradients.sky_top = top;
    gradients.sky_bottom = bottom;
  }

  return gradients.sky;
};

const glow_gradient = (ctx: CanvasRenderingContext2D, size: number) => {
  if (gradients.glow === null || gradients.glow_size !== size) {
    gradients.glow = ctx.createRadialGradient(
      0,
      0,
      size * SUN_GLOW_INNER,
      0,
      0,
      size * SUN_GLOW_OUTER,
    );
    gradients.glow.addColorStop(0, SUN_GLOW_FROM);
    gradients.glow.addColorStop(1, SUN_GLOW_TO);
    gradients.glow_size = size;
  }

  return gradients.glow;
};

export const render_sky = (engine: BIRD.EngineContext, scene: BIRD.PrimaryScene) => {
  const ctx = engine.ctx;
  const { width, height, pixel_ratio } = engine.canvas;
  const light = daylight(scene.day);
  const dusk = twilight(scene.day);
  const sun_q = sun_progress(scene.day);
  const moon_q = moon_progress(scene.day);
  const { sun, moon } = engine.resources;

  mix_rgb_into(sky_top, NIGHT_TOP, DAY_TOP, light);
  mix_rgb_into(sky_top, sky_top, DUSK_TOP, dusk * DUSK_TOP_WEIGHT);
  mix_rgb_into(sky_bottom, NIGHT_BOTTOM, DAY_BOTTOM, light);
  mix_rgb_into(sky_bottom, sky_bottom, DUSK_BOTTOM, dusk * DUSK_BOTTOM_WEIGHT);
  ctx.fillStyle = sky_gradient(ctx, height);
  ctx.fillRect(0, 0, width, height);

  const horizon = sky_horizon(engine);

  render_stars(engine, scene, horizon, light);

  with_smoothing(ctx, false, () => {
    if (moon_q !== null && is_sprite_ready(moon)) {
      const size = moon.canvas.width * SKY_PIXEL * pixel_ratio;
      ctx.drawImage(
        moon.canvas,
        body_x(moon_q, size, width),
        body_y(moon_q, size, horizon),
        size,
        size,
      );
    }

    if (sun_q !== null && is_sprite_ready(sun)) {
      const size = sun.canvas.width * SKY_PIXEL * pixel_ratio;
      const x = body_x(sun_q, size, width);
      const y = body_y(sun_q, size, horizon);
      const cx = x + size / 2;
      const cy = y + size / 2;
      const outer = size * SUN_GLOW_OUTER;

      ctx.fillStyle = glow_gradient(ctx, size);
      ctx.translate(cx, cy);
      ctx.fillRect(-outer, -outer, outer * 2, outer * 2);
      ctx.translate(-cx, -cy);

      ctx.drawImage(sun.canvas, x, y, size, size);
    }
  });
};
