import { rarity_of } from '../../entities/birds/bird.generator';
import { current_sprite } from '../../entities/birds/birds.renderer';
import { CONFIG } from '../../../config';
import { __opt_prepare_mutations, __opt_remember_shape, FLOAT_ZERO } from '../../../engine/shape';

const EGG_MS = CONFIG.hatch.egg_ms;
const EGG_RARITY_FACTOR = CONFIG.hatch.egg_rarity_factor;
const FLASH_MS = CONFIG.hatch.flash_ms;
const POP_MS = CONFIG.hatch.pop_ms;
const UI_MS = CONFIG.hatch.ui_ms;

export const BIRD_AT = FLASH_MS / 2;
export const NAME_AT = BIRD_AT + POP_MS;
export const BUTTONS_AT = NAME_AT + UI_MS / 2;
export const DONE_AT = BUTTONS_AT + UI_MS;

const hatch_scene_of = (time: number): BIRD.HatchScene => ({
  bird: null,
  elapsed: time,
  hatch_at: time,
  hatched: false,
});

export const create_hatch_scene = () => hatch_scene_of(FLOAT_ZERO);

__opt_prepare_mutations(__opt_remember_shape(hatch_scene_of(0.5)), [
  'bird',
  'elapsed',
  'hatch_at',
  'hatched',
]);

export const open_hatch = (game: BIRD.GameState, bird: BIRD.Bird) => {
  const scene = game.hatch_scene;

  scene.bird = bird;
  scene.elapsed = 0;
  scene.hatch_at = EGG_MS * EGG_RARITY_FACTOR[rarity_of(bird.behaviour.genes)];
  scene.hatched = false;
  game.current_scene = 'hatch';
};

export const hatch_time = (scene: BIRD.HatchScene) =>
  scene.hatched ? scene.elapsed - scene.hatch_at : -1;

export const is_hatch_done = (scene: BIRD.HatchScene) => hatch_time(scene) >= DONE_AT;

const is_sprite_ready = (engine: BIRD.EngineContext, bird: BIRD.Bird) =>
  current_sprite(engine.resources.bird_sprite_warmer.cache, bird) !== null;

export const update_hatch = (engine: BIRD.EngineContext, scene: BIRD.HatchScene) => {
  scene.elapsed += engine.delta;

  if (
    !scene.hatched &&
    scene.bird !== null &&
    scene.elapsed >= scene.hatch_at &&
    is_sprite_ready(engine, scene.bird)
  ) {
    scene.hatched = true;
    scene.hatch_at = scene.elapsed;
  }
};

export const skip_hatch = (engine: BIRD.EngineContext, scene: BIRD.HatchScene) => {
  if (scene.hatched || (scene.bird !== null && is_sprite_ready(engine, scene.bird))) {
    scene.hatched = true;
    scene.hatch_at = Math.min(scene.hatch_at, scene.elapsed - DONE_AT);
  } else {
    scene.hatch_at = Math.min(scene.hatch_at, scene.elapsed);
  }
};
