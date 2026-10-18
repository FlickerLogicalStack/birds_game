import { FLOAT_ZERO, __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';
import { arc01, clamp, MS_PER_SECOND, smoothstep } from '../../utils/math';
import { range } from '../../utils/random';
import { pick_spot, platform_y_at, type Spot } from '../platforms/platforms';
import type { BirdBehaviour } from './bird.generator';
import { taken_spots } from './birds.place';
import { CONFIG } from '../../../config';

export type Flight = {
  from_x: number;
  from_y: number;
  to_platform: number;
  to_x: number;
  to_y: number;
  arc: number;
  duration: number;
  time: number;
  airborne: boolean;
};

const create_flight = (
  from_x: number,
  from_y: number,
  to_platform: number,
  to_x: number,
  to_y: number,
  arc: number,
  duration: number,
): Flight => ({
  from_x,
  from_y,
  to_platform,
  to_x,
  to_y,
  arc,
  duration,
  time: FLOAT_ZERO,
  airborne: false,
});

__opt_prepare_mutations(__opt_remember_shape(create_flight(0.5, 0.5, 0, 0.5, 0.5, 0.5, 0.5)), [
  'time',
  'airborne',
]);

const FLY_PAUSE_MIN = CONFIG.birds.flight.pause_min_ms;
const FLY_PAUSE_MAX = CONFIG.birds.flight.pause_max_ms;
const FLY_CHANCE = CONFIG.birds.flight.chance;
const FLY_DISTANCE_MIN = CONFIG.birds.flight.distance_min;
const FLY_DISTANCE_MAX = CONFIG.birds.flight.distance_max;
const FLY_SPOT_ATTEMPTS = CONFIG.birds.flight.spot_attempts;
const FLY_SPEED = CONFIG.birds.flight.speed;
const FLY_DURATION_MIN = CONFIG.birds.flight.duration_min_ms;
const FLY_DURATION_MAX = CONFIG.birds.flight.duration_max_ms;
const LANDING_REST_MS = CONFIG.birds.flight.landing_rest_ms;
const ARC_BASE = CONFIG.birds.flight.arc_base;
const ARC_PER_DISTANCE = CONFIG.birds.flight.arc_per_distance;
const SPOT_TRIES = CONFIG.birds.character.spot_tries;

export const next_fly_pause = (behaviour: BirdBehaviour) =>
  range(Math.random, FLY_PAUSE_MIN, FLY_PAUSE_MAX) * behaviour.personality.calmness;

export const flight_ms = (distance: number) =>
  clamp((distance / FLY_SPEED) * MS_PER_SECOND, FLY_DURATION_MIN, FLY_DURATION_MAX);

export const flight_arc = (distance: number) => ARC_BASE + distance * ARC_PER_DISTANCE;

const nearest_bird_distance = (
  birds: readonly BIRD.Bird[],
  bird: BIRD.Bird,
  x: number,
  y: number,
) => {
  let nearest = Infinity;

  for (const other of birds) {
    if (other !== bird) {
      nearest = Math.min(nearest, Math.hypot(other.x - x, other.y - y));
    }
  }

  return nearest;
};

const choose_landing = (
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
  bird: BIRD.Bird,
): Flight | null => {
  const platforms = scene.tree.platforms;
  const taken = taken_spots(game.birds, bird);
  const choosy = bird.temper === 'social' || bird.temper === 'loner';
  const tries = choosy ? SPOT_TRIES : 1;
  let found = 0;
  let best_platform = 0;
  let best_x = FLOAT_ZERO;
  let best_y = FLOAT_ZERO;
  let best_score = FLOAT_ZERO;

  for (let attempt = 0; attempt < FLY_SPOT_ATTEMPTS && found < tries; attempt++) {
    const spot = pick_spot(platforms, taken, Math.random);

    if (spot === null) {
      break;
    }

    if (spot.platform === bird.platform) {
      continue;
    }

    const to_y = platform_y_at(platforms[spot.platform]!, spot.x);
    const distance = Math.hypot(spot.x - bird.x, to_y - bird.y);

    if (distance < FLY_DISTANCE_MIN || distance > FLY_DISTANCE_MAX) {
      continue;
    }

    const score = choosy ? nearest_bird_distance(game.birds, bird, spot.x, to_y) : FLOAT_ZERO;
    const better = bird.temper === 'loner' ? score > best_score : score < best_score;

    if (found === 0 || better) {
      best_platform = spot.platform;
      best_x = spot.x;
      best_y = to_y;
      best_score = score;
    }

    found++;
  }

  if (found === 0) {
    return null;
  }

  const distance = Math.hypot(best_x - bird.x, best_y - bird.y);

  return create_flight(
    bird.x,
    bird.y,
    best_platform,
    best_x,
    best_y,
    flight_arc(distance),
    flight_ms(distance),
  );
};

export const land_bird = (game: BIRD.GameState, scene: BIRD.PrimaryScene, bird: BIRD.Bird) => {
  const platforms = scene.tree.platforms;
  const taken = taken_spots(game.birds, bird);
  let best: Spot | null = null;
  let best_y = 0;
  let best_distance = Infinity;

  for (let attempt = 0; attempt < FLY_SPOT_ATTEMPTS; attempt++) {
    const spot = pick_spot(platforms, taken, Math.random);

    if (spot === null) {
      break;
    }

    const to_y = platform_y_at(platforms[spot.platform]!, spot.x);
    const distance = Math.hypot(spot.x - bird.x, to_y - bird.y);

    if (distance < best_distance) {
      best = spot;
      best_y = to_y;
      best_distance = distance;
    }
  }

  if (best === null) {
    best = pick_spot(platforms, [], Math.random) ?? { platform: bird.platform, x: bird.x };
    best_y = platform_y_at(platforms[best.platform]!, best.x);
    best_distance = Math.hypot(best.x - bird.x, best_y - bird.y);
  }

  const flight = create_flight(
    bird.x,
    bird.y,
    best.platform,
    best.x,
    best_y,
    ARC_BASE,
    flight_ms(best_distance),
  );

  flight.airborne = true;
  bird.behaviour.facing_left = best.x < bird.x;
  bird.flight = flight;
};

export const update_bird_flight = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
  bird: BIRD.Bird,
): boolean => {
  const behaviour = bird.behaviour;
  let flight = bird.flight;

  if (flight === null) {
    bird.fly_pause -= engine.delta;

    if (bird.fly_pause > 0 || bird.walk_target !== null || behaviour.action !== null) {
      return false;
    }

    bird.fly_pause = next_fly_pause(behaviour);

    if (Math.random() >= FLY_CHANCE) {
      return false;
    }

    flight = choose_landing(game, scene, bird);

    if (flight === null) {
      return false;
    }

    bird.flight = flight;
  }

  if (!flight.airborne) {
    if (behaviour.action !== null) {
      return true;
    }

    const dir = Math.sign(flight.to_x - flight.from_x);

    if (dir !== 0 && (behaviour.facing_left ? -1 : 1) !== dir) {
      behaviour.trigger('turn');
      return true;
    }

    flight.airborne = true;
  }

  flight.time = Math.min(flight.duration, flight.time + engine.delta);

  const t = flight.time / flight.duration;
  const s = smoothstep(0, 1, t);

  bird.x = flight.from_x + (flight.to_x - flight.from_x) * s;
  bird.y = flight.from_y + (flight.to_y - flight.from_y) * s - flight.arc * arc01(s);

  if (t >= 1) {
    bird.x = flight.to_x;
    bird.y = flight.to_y;
    bird.platform = flight.to_platform;
    bird.flight = null;
    bird.walk_pause = Math.max(bird.walk_pause, LANDING_REST_MS);

    return false;
  }

  if (behaviour.action !== 'flap') {
    behaviour.trigger('flap');
  }

  return true;
};
