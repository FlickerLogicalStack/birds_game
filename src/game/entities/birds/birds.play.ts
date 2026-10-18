import { FLOAT_ZERO, __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';
import { MS_PER_SECOND } from '../../utils/math';
import { pick, range } from '../../utils/random';
import type { Tree } from '../tree/tree';
import { land_bird } from './birds.flight';
import { CONFIG } from '../../../config';

const MAX_PAIRS = CONFIG.birds.play.max_pairs;
const PAUSE_MIN = CONFIG.birds.play.pause_min_ms;
const PAUSE_MAX = CONFIG.birds.play.pause_max_ms;
const DURATION_MIN = CONFIG.birds.play.duration_min_ms;
const DURATION_MAX = CONFIG.birds.play.duration_max_ms;
const PARTNER_DISTANCE = CONFIG.birds.play.partner_distance;
const SPEED = CONFIG.birds.play.speed;
const CHASE_BOOST = CONFIG.birds.play.chase_boost;
const TAKEOFF = CONFIG.birds.play.takeoff;
const STEER_MS = CONFIG.birds.play.steer_ms;
const FACE_SPEED = CONFIG.birds.play.face_speed;
const TAG_DISTANCE = CONFIG.birds.play.tag_distance;
const TAG_COOLDOWN_MS = CONFIG.birds.play.tag_cooldown_ms;
const TAG_WAIT_SPEED = CONFIG.birds.play.tag_wait_speed;
const GOAL_RADIUS = CONFIG.birds.play.goal_radius;
const GOAL_MIN_DISTANCE = CONFIG.birds.play.goal_min_distance;
const GOAL_ATTEMPTS = CONFIG.birds.play.goal_attempts;
const GROUND_CLEARANCE = CONFIG.birds.play.ground_clearance;
const JOY_GAIN = CONFIG.birds.play.joy_gain;

type Flyer = {
  bird: BIRD.Bird;
  vx: number;
  vy: number;
};

export type Play = {
  runner: Flyer;
  chaser: Flyer;
  goal_x: number;
  goal_y: number;
  time: number;
  duration: number;
  tag_cooldown: number;
};

const flyer_of = (bird: BIRD.Bird, vx: number, vy: number): Flyer => ({ bird, vx, vy });

const play_of = (
  runner: Flyer,
  chaser: Flyer,
  goal_x: number,
  goal_y: number,
  time: number,
  duration: number,
  tag_cooldown: number,
): Play => ({ runner, chaser, goal_x, goal_y, time, duration, tag_cooldown });

__opt_prepare_mutations(__opt_remember_shape(flyer_of(null!, 0.5, 0.5)), ['vx', 'vy']);
__opt_prepare_mutations(
  __opt_remember_shape(
    play_of(flyer_of(null!, 0.5, 0.5), flyer_of(null!, 0.5, 0.5), 0.5, 0.5, 0.5, 0.5, 0.5),
  ),
  ['runner', 'chaser', 'goal_x', 'goal_y', 'time', 'tag_cooldown'],
);

export const next_play_pause = () => range(Math.random, PAUSE_MIN, PAUSE_MAX);

const is_free = (bird: BIRD.Bird) =>
  !bird.playing &&
  !bird.bathing &&
  bird.flight === null &&
  bird.walk_target === null &&
  bird.behaviour.action === null;

const pick_goal = (play: Play, tree: Tree) => {
  const { x, y, w } = tree.bounds;
  const bottom = tree.ground_y - GROUND_CLEARANCE;
  const bird = play.runner.bird;

  for (let attempt = 0; attempt < GOAL_ATTEMPTS; attempt++) {
    play.goal_x = x + Math.random() * w;
    play.goal_y = y + Math.random() * (bottom - y);

    if (Math.hypot(play.goal_x - bird.x, play.goal_y - bird.y) >= GOAL_MIN_DISTANCE) {
      return;
    }
  }
};

const start_play = (game: BIRD.GameState, tree: Tree): Play | null => {
  const free = game.birds.filter(is_free);

  if (free.length < 2) {
    return null;
  }

  const a = pick(free, Math.random, free[0]!);
  let b: BIRD.Bird | null = null;
  let best = PARTNER_DISTANCE;

  for (const other of free) {
    const distance = Math.hypot(other.x - a.x, other.y - a.y);

    if (other !== a && distance < best) {
      b = other;
      best = distance;
    }
  }

  if (b === null) {
    return null;
  }

  a.playing = true;
  b.playing = true;

  const play = play_of(
    flyer_of(a, FLOAT_ZERO, -SPEED * TAKEOFF),
    flyer_of(b, FLOAT_ZERO, -SPEED * TAKEOFF),
    a.x,
    a.y,
    FLOAT_ZERO,
    range(Math.random, DURATION_MIN, DURATION_MAX),
    TAG_COOLDOWN_MS,
  );

  pick_goal(play, tree);

  return play;
};

const steer = (flyer: Flyer, tx: number, ty: number, speed: number, delta: number) => {
  const bird = flyer.bird;
  const behaviour = bird.behaviour;
  const dx = tx - bird.x;
  const dy = ty - bird.y;
  const distance = Math.hypot(dx, dy) || 1;
  const k = 1 - Math.exp(-delta / STEER_MS);

  flyer.vx += ((dx / distance) * speed - flyer.vx) * k;
  flyer.vy += ((dy / distance) * speed - flyer.vy) * k;
  bird.x += (flyer.vx * delta) / MS_PER_SECOND;
  bird.y += (flyer.vy * delta) / MS_PER_SECOND;

  if (Math.abs(flyer.vx) > FACE_SPEED) {
    behaviour.facing_left = flyer.vx < 0;
  }

  if (behaviour.action !== 'flap') {
    behaviour.trigger('flap');
  }
};

const update_play = (engine: BIRD.EngineContext, tree: Tree, play: Play) => {
  const delta = engine.delta;
  const runner = play.runner;
  const chaser = play.chaser;

  play.time += delta;
  play.tag_cooldown = Math.max(0, play.tag_cooldown - delta);

  if (Math.hypot(play.goal_x - runner.bird.x, play.goal_y - runner.bird.y) < GOAL_RADIUS) {
    pick_goal(play, tree);
  }

  steer(runner, play.goal_x, play.goal_y, SPEED, delta);
  steer(
    chaser,
    runner.bird.x,
    runner.bird.y,
    SPEED * (play.tag_cooldown > 0 ? TAG_WAIT_SPEED : CHASE_BOOST),
    delta,
  );

  if (
    play.tag_cooldown === 0 &&
    Math.hypot(runner.bird.x - chaser.bird.x, runner.bird.y - chaser.bird.y) < TAG_DISTANCE
  ) {
    play.runner = chaser;
    play.chaser = runner;
    play.tag_cooldown = TAG_COOLDOWN_MS;
    pick_goal(play, tree);
  }

  const joy = (JOY_GAIN * delta) / play.duration;

  runner.bird.joy = Math.min(1, runner.bird.joy + joy);
  chaser.bird.joy = Math.min(1, chaser.bird.joy + joy);
};

const end_play = (game: BIRD.GameState, scene: BIRD.PrimaryScene, play: Play) => {
  const runner = play.runner.bird;
  const chaser = play.chaser.bird;

  runner.playing = false;
  chaser.playing = false;
  land_bird(game, scene, runner);
  land_bird(game, scene, chaser);
};

export const stop_play = (game: BIRD.GameState, bird: BIRD.Bird) => {
  if (!bird.playing) {
    return;
  }

  const scene = game.primary_scene;
  const plays = scene.plays;

  bird.playing = false;

  for (let i = 0; i < plays.length; i++) {
    const play = plays[i]!;
    const runner = play.runner.bird;
    const chaser = play.chaser.bird;

    if (runner === bird || chaser === bird) {
      const other = runner === bird ? chaser : runner;

      other.playing = false;
      land_bird(game, scene, other);
      plays.splice(i, 1);

      return;
    }
  }
};

export const update_plays = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  const plays = scene.plays;

  for (let i = plays.length - 1; i >= 0; i--) {
    const play = plays[i]!;

    if (play.time >= play.duration) {
      end_play(game, scene, play);
      plays.splice(i, 1);
    } else {
      update_play(engine, scene.tree, play);
    }
  }

  scene.play_pause -= engine.delta;

  if (scene.play_pause > 0) {
    return;
  }

  scene.play_pause = next_play_pause();

  if (plays.length < MAX_PAIRS) {
    const play = start_play(game, scene.tree);

    if (play !== null) {
      plays.push(play);
    }
  }
};
