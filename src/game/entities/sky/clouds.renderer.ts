import { mod } from '../../utils/math';
import { create_canvas, type Ctx2D, type SpriteCanvas } from '../../../engine/canvas';
import { is_sprite_ready } from '../../../engine/lazy_sprite';
import { mix_rgb, rgb_css } from '../../utils/color';
import { daylight, twilight } from './sky';
import { sky_horizon, SKY_PIXEL } from './sky.renderer';
import { with_smoothing } from '../../utils/draw';
import { CONFIG } from '../../../config';

const NIGHT_TINT = CONFIG.clouds.night_tint;
const DUSK_TINT = CONFIG.clouds.dusk_tint;
const NIGHT_TINT_WEIGHT = CONFIG.clouds.night_tint_weight;
const DUSK_TINT_WEIGHT = CONFIG.clouds.dusk_tint_weight;
const TINT_STEPS = 64;
const MIX_STEPS = 16;

type ScaledCloud = { scale: number; tint: number; mix: number; canvas: SpriteCanvas; ctx: Ctx2D };

const scaled = new WeakMap<SpriteCanvas, ScaledCloud>();

const scaled_sprite = (sprite: SpriteCanvas, scale: number, tint: number, mix: number) => {
  let cached = scaled.get(sprite);

  if (cached?.scale === scale && cached.tint === tint && cached.mix === mix) {
    return cached.canvas;
  }

  if (cached?.scale !== scale) {
    cached = { scale, tint, mix, ...create_canvas(sprite.width * scale, sprite.height * scale) };
    scaled.set(sprite, cached);
  }

  const { canvas, ctx } = cached;

  cached.tint = tint;
  cached.mix = mix;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sprite, 0, 0, canvas.width, canvas.height);

  if (tint > 0) {
    const color = mix_rgb(NIGHT_TINT, DUSK_TINT, mix / MIX_STEPS);

    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = rgb_css(color, tint / TINT_STEPS);
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'source-over';
  }

  return canvas;
};

export const render_clouds = (engine: BIRD.EngineContext, scene: BIRD.PrimaryScene) => {
  const { width, pixel_ratio, dpr } = engine.canvas;
  const sprites = engine.resources.clouds;
  const horizon = sky_horizon(engine);
  const scale = SKY_PIXEL * pixel_ratio;
  const light = daylight(scene.day);
  const dusk = twilight(scene.day);
  const night_tint = (1 - light) * NIGHT_TINT_WEIGHT;
  const dusk_tint = dusk * DUSK_TINT_WEIGHT;
  const tint = Math.round(Math.max(night_tint, dusk_tint) * TINT_STEPS);
  const mix = tint === 0 ? 0 : Math.round((dusk_tint / (dusk_tint + night_tint)) * MIX_STEPS);
  const ctx = engine.ctx;

  with_smoothing(ctx, true, () => {
    for (const cloud of scene.clouds) {
      const sprite = sprites[cloud.sprite];

      if (!sprite || !is_sprite_ready(sprite)) {
        continue;
      }

      const w = sprite.canvas.width * scale;
      const h = sprite.canvas.height * scale;
      const span = width + w;
      const x = mod(cloud.x * pixel_ratio, span) - w;
      const y = Math.round(horizon * cloud.height - h);

      if (x + w <= 0 || x >= width || y + h <= 0) {
        continue;
      }

      ctx.drawImage(scaled_sprite(sprite.canvas, scale * dpr, tint, mix), x, y, w, h);
    }
  });
};
