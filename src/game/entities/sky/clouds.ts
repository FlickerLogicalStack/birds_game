import { lerp, MS_PER_SECOND } from '../../utils/math';
import { create_rng, range } from '../../utils/random';
import { CLOUD_SPRITE_COUNT } from './clouds.sprites';
import { CONFIG } from '../../../config';

const CLOUD_COUNT = CONFIG.clouds.count;
const CLOUD_LAYOUT_SEED = CONFIG.clouds.seed;

const MIN_SPEED = CONFIG.clouds.min_speed;
const MAX_SPEED = CONFIG.clouds.max_speed;
const SMALL_BIAS = CONFIG.clouds.small_bias;
const START_SPREAD = CONFIG.clouds.start_spread;
const MIN_HEIGHT = CONFIG.clouds.min_height;
const MAX_HEIGHT = CONFIG.clouds.max_height;

export type Cloud = {
  sprite: number;
  x: number;
  height: number;
  speed: number;
};

export const create_clouds = (): Cloud[] => {
  const rng = create_rng(CLOUD_LAYOUT_SEED);
  const clouds = Array.from({ length: CLOUD_COUNT }, (): Cloud => {
    const size = rng() ** SMALL_BIAS;
    const sprite = Math.min(CLOUD_SPRITE_COUNT - 1, Math.floor(size * CLOUD_SPRITE_COUNT));

    return {
      sprite,
      x: range(rng, 0, START_SPREAD),
      height: range(rng, MIN_HEIGHT, MAX_HEIGHT),
      speed: lerp(MIN_SPEED, MAX_SPEED, size) * range(rng, 0.85, 1.15),
    };
  });

  return clouds.sort((a, b) => a.speed - b.speed);
};

export const update_clouds = (clouds: Cloud[], delta_ms: number) => {
  for (const cloud of clouds) {
    cloud.x += (cloud.speed * delta_ms) / MS_PER_SECOND;
  }
};
