import { FLOAT_ZERO, __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';
import { MS_PER_SECOND } from '../../utils/math';
import { range } from '../../utils/random';
import type { Trail } from './bird.generator';
import { bath_of_bird } from './birds.bath';
import { CONFIG } from '../../../config';

const T = CONFIG.birds.trail;

type Mote = {
  alive: boolean;
  kind: Exclude<Trail, 'none'>;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  seed: number;
};

const mote_of = (): Mote => ({
  alive: false,
  kind: 'sparks',
  x: 0.5,
  y: 0.5,
  vx: 0.5,
  vy: 0.5,
  age: 0.5,
  life: 0.5,
  seed: 0.5,
});

export const MOTES: readonly Mote[] = Array.from({ length: T.pool }, mote_of);

__opt_prepare_mutations(__opt_remember_shape(MOTES[0]!), [
  'alive',
  'kind',
  'x',
  'y',
  'vx',
  'vy',
  'age',
  'life',
  'seed',
]);

let since_emit = FLOAT_ZERO;

const is_airborne = (scene: BIRD.PrimaryScene, bird: BIRD.Bird) => {
  if (bird.flight !== null || bird.playing) {
    return true;
  }

  if (!bird.bathing) {
    return false;
  }

  const bath = bath_of_bird(scene, bird);

  return bath !== null && bath.phase === 'fly';
};

const emit = (bird: BIRD.Bird, kind: Exclude<Trail, 'none'>) => {
  for (const mote of MOTES) {
    if (mote.alive) {
      continue;
    }

    const c = T[kind];

    mote.alive = true;
    mote.kind = kind;
    mote.x = bird.x + range(Math.random, -T.emit_spread, T.emit_spread);
    mote.y = bird.y - T.emit_dy + range(Math.random, -T.emit_spread, T.emit_spread);
    mote.vx = range(Math.random, -c.drift, c.drift);
    mote.vy = c.fall + range(Math.random, -c.drift, c.drift);
    mote.age = FLOAT_ZERO;
    mote.life = c.life_ms * range(Math.random, 0.7, 1.3);
    mote.seed = Math.random();

    return;
  }
};

export const update_trails = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  const delta = engine.delta;
  const dt = delta / MS_PER_SECOND;

  for (const mote of MOTES) {
    if (!mote.alive) {
      continue;
    }

    mote.age += delta;
    mote.x += mote.vx * dt;
    mote.y += mote.vy * dt;
    mote.alive = mote.age < mote.life;
  }

  since_emit += delta;

  if (since_emit < T.emit_ms) {
    return;
  }

  since_emit %= T.emit_ms;

  for (const bird of game.birds) {
    const special = bird.behaviour.genes.special;

    if (special !== undefined && special.trail !== 'none' && is_airborne(scene, bird)) {
      emit(bird, special.trail);
    }
  }
};
