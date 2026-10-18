import type { WarmLevel } from '../../entities/birds/bird.warmer';
import { load_cloud_sprites } from '../../entities/sky/clouds.sprites';
import { load_sky_sprites } from '../../entities/sky/sky.sprites';
import { load_star_sprites } from '../../entities/sky/stars.sprites';
import { load_tree_sprite } from '../../entities/tree/tree.sprite';

export const LOADING_WAITS_FOR: WarmLevel = 'rest';

export const create_loading_scene = (): BIRD.LoadingScene => ({ started_at: -1 });

export const setup_loading_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.LoadingScene,
) => {
  scene.started_at = performance.now() | 0;
  load_tree_sprite(engine, game.primary_scene.tree, engine.resources.tree);
  load_sky_sprites(engine);
  load_cloud_sprites(engine);
  load_star_sprites(engine);
};
