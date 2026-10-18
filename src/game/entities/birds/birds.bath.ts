import { FLOAT_ZERO, __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';
import { arc01, MS_PER_SECOND, smoothstep, TAU } from '../../utils/math';
import { pick, range } from '../../utils/random';
import {
  DRY_FROM,
  DRY_TO,
  sand_surface,
  SHALLOW_FROM,
  SHALLOW_TO,
  shore_x,
  WATER_LEVEL,
} from '../misc/shore.sprite';
import type { ActionName } from './bird.generator';
import { flight_arc, flight_ms, land_bird } from './birds.flight';
import { CONFIG } from '../../../config';

const CHARACTER = CONFIG.birds.character;

export type BathKind = 'sand' | 'water';

type BathConfig = typeof CONFIG.birds.sand;

const KIND_CONFIG: Record<BathKind, BathConfig> = {
  sand: CONFIG.birds.sand,
  water: CONFIG.birds.water,
};
const SPOT_ATTEMPTS = 8;
const SHAKES: readonly ActionName[] = ['ruffle', 'ruffle', 'flap', 'turn', 'turn', 'peck'];

export type Bath = {
  bird: BIRD.Bird;
  kind: BathKind;
  phase: 'fly' | 'bathe';
  from_x: number;
  from_y: number;
  to_x: number;
  to_y: number;
  water_y: number;
  arc: number;
  time: number;
  duration: number;
  shake_pause: number;
};

const bath_of = (
  bird: BIRD.Bird,
  kind: BathKind,
  from_x: number,
  from_y: number,
  to_x: number,
  to_y: number,
  water_y: number,
  arc: number,
  duration: number,
): Bath => ({
  bird,
  kind,
  phase: 'fly',
  from_x,
  from_y,
  to_x,
  to_y,
  water_y,
  arc,
  time: FLOAT_ZERO,
  duration,
  shake_pause: FLOAT_ZERO,
});

__opt_prepare_mutations(
  __opt_remember_shape(bath_of(null!, 'sand', 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)),
  ['phase', 'time', 'duration', 'shake_pause'],
);

type Drop = {
  alive: boolean;
  kind: BathKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  floor: number;
  light: boolean;
};

const drop_of = (): Drop => ({
  alive: false,
  kind: 'sand',
  x: 0.5,
  y: 0.5,
  vx: 0.5,
  vy: 0.5,
  gravity: 0.5,
  floor: 0.5,
  light: false,
});

export const SPRAY: readonly Drop[] = Array.from({ length: CONFIG.birds.spray_pool }, drop_of);

__opt_prepare_mutations(__opt_remember_shape(SPRAY[0]!), [
  'alive',
  'kind',
  'x',
  'y',
  'vx',
  'vy',
  'gravity',
  'floor',
  'light',
]);

export const next_bath_pause = (kind: BathKind) =>
  range(Math.random, KIND_CONFIG[kind].pause_min_ms, KIND_CONFIG[kind].pause_max_ms);

export const bath_sink = (bath: Bath) => {
  const c = KIND_CONFIG[bath.kind];

  return bath.phase === 'fly'
    ? 0
    : c.sink *
        Math.min(
          smoothstep(0, c.sink_ms, bath.time),
          smoothstep(0, c.sink_ms, bath.duration - bath.time),
        );
};

export const bath_of_bird = (scene: BIRD.PrimaryScene, bird: BIRD.Bird): Bath | null => {
  for (const bath of scene.baths) {
    if (bath.bird === bird) {
      return bath;
    }
  }

  return null;
};

const is_free = (bird: BIRD.Bird) =>
  !bird.playing &&
  !bird.bathing &&
  bird.flight === null &&
  bird.walk_target === null &&
  bird.behaviour.action === null;

const pick_bath_x = (scene: BIRD.PrimaryScene, kind: BathKind): number | null => {
  const from = kind === 'sand' ? DRY_FROM : SHALLOW_FROM;
  const to = kind === 'sand' ? DRY_TO : SHALLOW_TO;
  const spacing = KIND_CONFIG[kind].spacing;

  for (let attempt = 0; attempt < SPOT_ATTEMPTS; attempt++) {
    const x = shore_x(scene.tree) + Math.round(range(Math.random, from, to));
    let crowded = false;

    for (const bath of scene.baths) {
      crowded = crowded || (bath.kind === kind && Math.abs(bath.to_x - x) < spacing);
    }

    if (!crowded) {
      return x;
    }
  }

  return null;
};

const bather_weight = (bird: BIRD.Bird, kind: BathKind) =>
  kind === 'water' && bird.temper === 'swimmer' ? CHARACTER.swimmer_weight : 1;

const pick_bather = (free: readonly BIRD.Bird[], kind: BathKind) => {
  let total = 0;

  for (const bird of free) {
    total += bather_weight(bird, kind);
  }

  let left = Math.random() * total;

  for (const bird of free) {
    left -= bather_weight(bird, kind);

    if (left < 0) {
      return bird;
    }
  }

  return free[free.length - 1]!;
};

const start_bath = (
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
  kind: BathKind,
): Bath | null => {
  const free = game.birds.filter(is_free);
  const to_x = pick_bath_x(scene, kind);

  if (free.length === 0 || to_x === null) {
    return null;
  }

  const bird = pick_bather(free, kind);
  const ground_y = scene.tree.ground_y;
  const to_y =
    kind === 'sand' ? ground_y + sand_surface(to_x - shore_x(scene.tree)) : ground_y + WATER_LEVEL;
  const distance = Math.hypot(to_x - bird.x, to_y - bird.y);

  bird.bathing = true;
  bird.behaviour.facing_left = to_x < bird.x;

  return bath_of(
    bird,
    kind,
    bird.x,
    bird.y,
    to_x,
    to_y,
    ground_y + WATER_LEVEL,
    flight_arc(distance),
    flight_ms(distance),
  );
};

const spray = (bath: Bath, count: number) => {
  const c = KIND_CONFIG[bath.kind];
  const floor = bath.kind === 'water' ? bath.water_y : bath.to_y;
  let left = count;

  for (const drop of SPRAY) {
    if (left === 0) {
      return;
    }

    if (drop.alive) {
      continue;
    }

    const side = Math.random() < 0.5 ? -1 : 1;
    const speed = range(Math.random, c.spray_speed_min, c.spray_speed_max);
    const angle = range(Math.random, 0.35, 1.25);

    drop.alive = true;
    drop.kind = bath.kind;
    drop.x = bath.to_x + side * range(Math.random, 2, 6);
    drop.y = floor - 1;
    drop.vx = side * speed * Math.cos(angle);
    drop.vy = -speed * Math.sin(angle);
    drop.gravity = c.spray_gravity;
    drop.floor = floor;
    drop.light = Math.random() < 0.4;
    left--;
  }
};

const update_fly = (bath: Bath, delta: number) => {
  const bird = bath.bird;
  const c = KIND_CONFIG[bath.kind];

  bath.time = Math.min(bath.duration, bath.time + delta);

  const s = smoothstep(0, 1, bath.time / bath.duration);

  bird.x = bath.from_x + (bath.to_x - bath.from_x) * s;
  bird.y = bath.from_y + (bath.to_y - bath.from_y) * s - bath.arc * arc01(s);

  if (bath.time < bath.duration) {
    if (bird.behaviour.action !== 'flap') {
      bird.behaviour.trigger('flap');
    }

    return;
  }

  bath.phase = 'bathe';
  bath.time = FLOAT_ZERO;
  bath.duration =
    range(Math.random, c.duration_min_ms, c.duration_max_ms) *
    (bath.kind === 'water' && bath.bird.temper === 'swimmer' ? CHARACTER.swimmer_bath : 1);
  bath.shake_pause = c.sink_ms;
};

const update_bathe = (bath: Bath, delta: number) => {
  const bird = bath.bird;
  const behaviour = bird.behaviour;
  const c = KIND_CONFIG[bath.kind];

  bath.time += delta;
  bath.shake_pause -= delta;

  const wiggle = behaviour.action === 'ruffle' || behaviour.action === 'flap';

  bird.x = bath.to_x + (wiggle ? c.wiggle * Math.sin((bath.time / c.wiggle_ms) * TAU) : 0);
  const sink = bath_sink(bath);
  const bob = c.bob * (sink / c.sink) * Math.sin((bath.time / c.bob_ms + bath.to_x / 7) * TAU);

  bird.y = bath.to_y + sink + bob;
  bird.joy = Math.min(1, bird.joy + (c.joy_gain * delta) / bath.duration);

  const settled = bath.time > c.sink_ms && bath.duration - bath.time > c.sink_ms;

  if (!settled || behaviour.action !== null || bath.shake_pause > 0) {
    return;
  }

  const shake = pick(SHAKES, Math.random, SHAKES[0]!);

  behaviour.trigger(shake);
  bath.shake_pause = range(Math.random, c.shake_pause_min_ms, c.shake_pause_max_ms);

  if (shake === 'ruffle' || shake === 'flap') {
    spray(bath, c.spray_per_shake * (shake === 'flap' ? 2 : 1));
  }
};

const update_spray = (delta: number) => {
  const dt = delta / MS_PER_SECOND;

  for (const drop of SPRAY) {
    if (!drop.alive) {
      continue;
    }

    drop.vy += drop.gravity * dt;
    drop.x += drop.vx * dt;
    drop.y += drop.vy * dt;
    drop.alive = drop.vy < 0 || drop.y < drop.floor;
  }
};

export const stop_bath = (game: BIRD.GameState, bird: BIRD.Bird) => {
  if (!bird.bathing) {
    return;
  }

  const baths = game.primary_scene.baths;

  bird.bathing = false;

  for (let i = 0; i < baths.length; i++) {
    if (baths[i]!.bird === bird) {
      baths.splice(i, 1);

      return;
    }
  }
};

const count_kind = (baths: readonly Bath[], kind: BathKind) => {
  let count = 0;

  for (const bath of baths) {
    count += bath.kind === kind ? 1 : 0;
  }

  return count;
};

const try_start = (
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
  kind: BathKind,
  pause: number,
): number => {
  if (pause > 0) {
    return pause;
  }

  if (count_kind(scene.baths, kind) < KIND_CONFIG[kind].max_birds) {
    const bath = start_bath(game, scene, kind);

    if (bath !== null) {
      scene.baths.push(bath);
    }
  }

  return next_bath_pause(kind);
};

export const update_baths = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  const baths = scene.baths;
  const delta = engine.delta;

  for (let i = baths.length - 1; i >= 0; i--) {
    const bath = baths[i]!;

    if (bath.phase === 'fly') {
      update_fly(bath, delta);
    } else if (bath.time < bath.duration) {
      update_bathe(bath, delta);
    } else {
      bath.bird.bathing = false;
      bath.bird.y = bath.to_y;
      land_bird(game, scene, bath.bird);
      baths.splice(i, 1);
    }
  }

  update_spray(delta);
  scene.sand_pause = try_start(game, scene, 'sand', scene.sand_pause - delta);
  scene.water_pause = try_start(game, scene, 'water', scene.water_pause - delta);
};
