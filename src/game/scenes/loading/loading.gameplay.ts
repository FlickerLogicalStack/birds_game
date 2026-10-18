import { is_sprite_ready } from '../../../engine/lazy_sprite';
import { LOADING_WAITS_FOR } from './loading.state';

const sky_ready = ({ sun, moon, stars, clouds }: BIRD.EngineResources) =>
  is_sprite_ready(sun) &&
  is_sprite_ready(moon) &&
  is_sprite_ready(stars) &&
  clouds.every(is_sprite_ready);

const sprites_ready = (engine: BIRD.EngineContext) =>
  (+is_sprite_ready(engine.resources.tree) + +sky_ready(engine.resources)) / 2;

const SPRITES_WEIGHT = 0.5;

export const loading_progress = (engine: BIRD.EngineContext) =>
  sprites_ready(engine) * SPRITES_WEIGHT +
  engine.resources.bird_sprite_warmer.progress(LOADING_WAITS_FOR) * (1 - SPRITES_WEIGHT);

export const loading_stage = (engine: BIRD.EngineContext) => {
  const { tree, bird_sprite_warmer } = engine.resources;

  if (!is_sprite_ready(tree)) {
    return 'Tree';
  }

  if (!sky_ready(engine.resources)) {
    return 'Sky';
  }

  const birds = Math.floor(bird_sprite_warmer.progress(LOADING_WAITS_FOR) * 100);

  return `Birds ${birds}%`;
};

export const handle_loading_gameplay = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.LoadingScene,
) => {
  if (loading_progress(engine) >= 1) {
    console.info(`Loading done in ${(performance.now() | 0) - scene.started_at} ms`);
    game.current_scene = 'primary';
  }
};
