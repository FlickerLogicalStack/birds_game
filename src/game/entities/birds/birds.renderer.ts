import { create_canvas, type SpriteCanvas } from '../../../engine/canvas';
import { snap_px, to_screen_x, to_screen_y, type Camera } from '../camera/camera';
import { scene_reveal } from '../misc/reveal';
import { daylight } from '../sky/sky';
import type { AtlasSprite, BirdAtlasCache } from './bird.atlas';
import { eye_colors, SPRITE_FEET_Y, SPRITE_SIZE } from './bird.generator';
import { with_smoothing } from '../../utils/draw';
import { TAU } from '../../utils/math';
import { render_bird_in_bath } from './birds.bath.renderer';
import { CONFIG } from '../../../config';

const GLOW = CONFIG.birds.eye_glow;
const GLOW_SIZE = GLOW.radius * 2 + 1;

export const current_sprite = (cache: BirdAtlasCache, bird: BIRD.Bird): AtlasSprite | null => {
  const behaviour = bird.behaviour;
  const code = behaviour.pose_code;
  let entry = bird.drawn;

  if (entry === null || !entry.alive || bird.drawn_code !== code) {
    entry = cache.entry_by_code(behaviour.gid, code) ?? null;
    bird.drawn_code = code;

    if (entry === null) {
      entry = cache.entry_by_code(behaviour.gid, behaviour.rest_code) ?? null;
      bird.drawn_code = -1;
    }

    bird.drawn = entry;

    if (entry === null) {
      return null;
    }
  }

  cache.touch(entry);

  return entry.sprite;
};

export const draw_bird_sprite = (
  engine: BIRD.EngineContext,
  bird: BIRD.Bird,
  x: number,
  y: number,
  size: number,
): boolean => {
  const sprite = current_sprite(engine.resources.bird_sprite_warmer.cache, bird);

  if (sprite === null) {
    return false;
  }

  const { left, top, right, bottom } = sprite.bounds;

  if (right < left) {
    return true;
  }

  const k = size / SPRITE_SIZE;
  const w = right - left + 1;
  const h = bottom - top + 1;
  const facing_left = bird.behaviour.facing_left;
  const dx = facing_left ? SPRITE_SIZE - 1 - right : left;
  const sx = sprite.x + (facing_left ? SPRITE_SIZE : 0) + dx;

  engine.ctx.drawImage(
    sprite.page,
    sx,
    sprite.y + top,
    w,
    h,
    x + dx * k,
    y + top * k,
    w * k,
    h * k,
  );

  return true;
};

export const render_bird_at = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  camera: Camera,
  bird: BIRD.Bird,
  feet_x: number,
  feet_y: number,
) => {
  const size = SPRITE_SIZE * camera.zoom;
  const x = snap_px(to_screen_x(camera, feet_x - SPRITE_SIZE / 2), engine.canvas.dpr);
  const y = snap_px(to_screen_y(camera, feet_y - SPRITE_FEET_Y), engine.canvas.dpr);

  if (x + size < 0 || y + size < 0 || x > engine.canvas.width || y > engine.canvas.height) {
    return;
  }

  if (!draw_bird_sprite(engine, bird, x, y, size)) {
    return;
  }

  game.debug_hud.renders += 1;
};

const glow_sprites = new Map<number, SpriteCanvas>();

const glow_sprite = (rgba: number): SpriteCanvas => {
  const known = glow_sprites.get(rgba);

  if (known !== undefined) {
    return known;
  }

  const { canvas, ctx } = create_canvas(GLOW_SIZE, GLOW_SIZE);
  const image = ctx.createImageData(GLOW_SIZE, GLOW_SIZE);
  const pixels = new Uint32Array(image.data.buffer);
  const color = rgba & 0x00ffffff;

  for (let y = 0; y < GLOW_SIZE; y++) {
    for (let x = 0; x < GLOW_SIZE; x++) {
      const d = Math.hypot(x - GLOW.radius, y - GLOW.radius) / (GLOW.radius + 0.5);
      const a = d < 0.35 ? 0.6 : d < 0.7 ? 0.3 : d < 1 ? 0.12 : 0;

      pixels[y * GLOW_SIZE + x] = (color | (Math.round(a * 255) << 24)) >>> 0;
    }
  }

  ctx.putImageData(image, 0, 0);
  glow_sprites.set(rgba, canvas);

  return canvas;
};

const render_eye_glow = (
  engine: BIRD.EngineContext,
  camera: Camera,
  bird: BIRD.Bird,
  night: number,
) => {
  const genes = bird.behaviour.genes;

  if (genes.special === undefined || genes.special.eyes !== 'glowing' || bird.drawn === null) {
    return;
  }

  const sprite = bird.drawn.sprite;

  if (sprite.eye_x < 0) {
    return;
  }

  const ctx = engine.ctx;
  const k = camera.zoom;
  const eye_x = bird.behaviour.facing_left ? SPRITE_SIZE - sprite.eye_x : sprite.eye_x;
  const x = to_screen_x(camera, bird.x - SPRITE_SIZE / 2 + eye_x - GLOW.radius - 0.5);
  const y = to_screen_y(camera, bird.y - SPRITE_FEET_Y + sprite.eye_y - GLOW.radius - 0.5);
  const alpha = ctx.globalAlpha;
  const pulse = 1 + GLOW.pulse * Math.sin((performance.now() / GLOW.pulse_ms) * TAU);

  ctx.globalAlpha = alpha * Math.min(1, night * GLOW.alpha * pulse);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(
    glow_sprite(eye_colors(genes).from),
    snap_px(x, engine.canvas.dpr),
    snap_px(y, engine.canvas.dpr),
    GLOW_SIZE * k,
    GLOW_SIZE * k,
  );
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = alpha;
};

export const render_birds = (engine: BIRD.EngineContext, game: BIRD.GameState, camera: Camera) => {
  const alpha = scene_reveal(engine);

  if (alpha === 0) {
    return;
  }

  const ctx = engine.ctx;
  const night = 1 - daylight(game.primary_scene.day);

  ctx.globalAlpha = alpha;
  with_smoothing(ctx, false, () => {
    for (const bird of game.birds) {
      render_bird_at(engine, game, camera, bird, bird.x, bird.y);

      if (bird.bathing) {
        render_bird_in_bath(engine, game.primary_scene, bird);
      }

      if (night > 0) {
        render_eye_glow(engine, camera, bird, night);
      }
    }
  });
  ctx.globalAlpha = 1;
};
