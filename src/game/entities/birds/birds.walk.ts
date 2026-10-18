import { clamp } from '../../utils/math';
import { random_sign, range } from '../../utils/random';
import {
  EDGE_MARGIN,
  MIN_SPACING,
  platform_x0,
  platform_x1,
  platform_y_at,
  SPACING_HEIGHT,
} from '../platforms/platforms';
import type { BirdBehaviour } from './bird.generator';
import { stand_x, stand_y } from './birds.place';
import { CONFIG } from '../../../config';

const WALK_PAUSE_MIN = CONFIG.birds.walk.pause_min_ms;
const WALK_PAUSE_MAX = CONFIG.birds.walk.pause_max_ms;
const WALK_CHANCE = CONFIG.birds.walk.chance;
const WALK_DISTANCE_MIN = CONFIG.birds.walk.distance_min;
const WALK_DISTANCE_MAX = CONFIG.birds.walk.distance_max;
const WALK_MIN_DISTANCE = CONFIG.birds.walk.min_distance;
const HOP_SPEED = CONFIG.birds.walk.hop_speed;
const HEIGHT_SLACK = CONFIG.birds.walk.height_slack;

export const next_walk_pause = (behaviour: BirdBehaviour) =>
  range(Math.random, WALK_PAUSE_MIN, WALK_PAUSE_MAX) * behaviour.personality.calmness;

const choose_target = (
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
  bird: BIRD.Bird,
): number | null => {
  const platform = scene.tree.platforms[bird.platform]!;
  const lo = platform_x0(platform) + EDGE_MARGIN;
  const hi = platform_x1(platform) - EDGE_MARGIN;
  const first = random_sign(Math.random);

  for (const dir of [first, -first]) {
    const distance = range(Math.random, WALK_DISTANCE_MIN, WALK_DISTANCE_MAX);
    let target = clamp(bird.x + dir * distance, lo, hi);

    for (const other of game.birds) {
      if (other === bird || other.playing || other.bathing) {
        continue;
      }

      const other_x = stand_x(other);
      const other_y = stand_y(other);

      const y_there = platform_y_at(platform, clamp(other_x, lo, hi));

      if (Math.abs(other_y - y_there) >= SPACING_HEIGHT + HEIGHT_SLACK) {
        continue;
      }

      const from = Math.min(other_x, other.walk_target ?? other_x);
      const to = Math.max(other_x, other.walk_target ?? other_x);

      if (dir > 0 && from > bird.x) {
        target = Math.min(target, from - MIN_SPACING);
      } else if (dir < 0 && to < bird.x) {
        target = Math.max(target, to + MIN_SPACING);
      }
    }

    if ((target - bird.x) * dir >= WALK_MIN_DISTANCE) {
      return target;
    }
  }

  return null;
};

export const update_bird_walk = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
  bird: BIRD.Bird,
) => {
  const behaviour = bird.behaviour;

  if (bird.walk_target === null) {
    bird.walk_pause -= engine.delta;

    if (bird.walk_pause > 0 || behaviour.action !== null) {
      return;
    }

    bird.walk_pause = next_walk_pause(behaviour);

    if (Math.random() >= WALK_CHANCE) {
      return;
    }

    bird.walk_target = choose_target(game, scene, bird);

    if (bird.walk_target === null) {
      return;
    }
  }

  const target = bird.walk_target;
  const dir = Math.sign(target - bird.x);

  if (behaviour.action === 'hop' && behaviour.lift > 0) {
    const step = HOP_SPEED * behaviour.personality.speed * engine.delta_mul;

    bird.x = dir > 0 ? Math.min(target, bird.x + step) : Math.max(target, bird.x - step);
    bird.y = platform_y_at(scene.tree.platforms[bird.platform]!, bird.x);
  }

  if (behaviour.action !== null) {
    return;
  }

  if (bird.x === target) {
    bird.walk_target = null;
    return;
  }

  behaviour.trigger((behaviour.facing_left ? -1 : 1) === dir ? 'hop' : 'turn');
};
