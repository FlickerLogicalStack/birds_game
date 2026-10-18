import { to_world_x, to_world_y, type Camera } from '../camera/camera';
import { is_opaque, type AtlasSprite, type SpriteBounds } from './bird.atlas';
import { SPRITE_FEET_Y, SPRITE_SIZE } from './bird.generator';
import { current_sprite } from './birds.renderer';
import { CONFIG } from '../../../config';

const PICK_SLOP_PX = CONFIG.input.pick_slop_px;

const has_pixel_near = (sprite: AtlasSprite, x: number, y: number, radius: number) => {
  const x0 = Math.max(0, x - radius);
  const x1 = Math.min(SPRITE_SIZE - 1, x + radius);
  const y0 = Math.max(0, y - radius);
  const y1 = Math.min(SPRITE_SIZE - 1, y + radius);

  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      if (is_opaque(sprite, px, py)) {
        return true;
      }
    }
  }

  return false;
};

export type BirdHit = { bird: BIRD.Bird; bounds: SpriteBounds; index: number };

export const hit_bird_at = (
  engine: BIRD.EngineContext,
  bird: BIRD.Bird,
  feet_x: number,
  feet_y: number,
  world_x: number,
  world_y: number,
  radius: number,
): SpriteBounds | null => {
  let x = Math.floor(world_x - (feet_x - SPRITE_SIZE / 2));
  const y = Math.floor(world_y - (feet_y - SPRITE_FEET_Y));

  if (x < -radius || y < -radius || x >= SPRITE_SIZE + radius || y >= SPRITE_SIZE + radius) {
    return null;
  }

  const sprite = current_sprite(engine.resources.bird_sprite_warmer.cache, bird);

  if (sprite === null) {
    return null;
  }

  if (bird.behaviour.facing_left) {
    x = SPRITE_SIZE - 1 - x;
  }

  return has_pixel_near(sprite, x, y, radius) ? sprite.bounds : null;
};

export const pick_radius = (camera: Camera) => Math.ceil(PICK_SLOP_PX / camera.zoom);

export const pick_bird = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  camera: Camera,
  screen_x: number,
  screen_y: number,
): BirdHit | null => {
  const world_x = to_world_x(camera, screen_x);
  const world_y = to_world_y(camera, screen_y);
  const radius = pick_radius(camera);

  for (let i = game.birds.length - 1; i >= 0; i--) {
    const bird = game.birds[i]!;
    const bounds = hit_bird_at(engine, bird, bird.x, bird.y, world_x, world_y, radius);

    if (bounds !== null) {
      return { bird, bounds, index: i };
    }
  }

  return null;
};
