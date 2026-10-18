import { BirdAtlas, create_bird_atlas_cache } from '../../game/entities/birds/bird.atlas';
import { BirdSpriteWarmer } from '../../game/entities/birds/bird.warmer';
import { CLOUD_SPRITE_COUNT } from '../../game/entities/sky/clouds.sprites';
import { create_lazy_sprite } from '../lazy_sprite';
import { PersistentCache } from '../persistent';
import { default_worker_count, Workers } from '../worker';

const GAME_WORKER = 'game';
const GAME_DB = 'birds';

export const load_resources = async (): Promise<BIRD.EngineResources> => {
  const workers = new Workers(GAME_WORKER, default_worker_count());

  const persistent = new PersistentCache(GAME_DB);
  const bird_atlas = new BirdAtlas();

  return {
    workers,
    persistent,
    bird_sprite_warmer: new BirdSpriteWarmer(
      create_bird_atlas_cache(bird_atlas),
      bird_atlas,
      workers,
      persistent,
    ),
    sun: create_lazy_sprite(),
    moon: create_lazy_sprite(),
    stars: create_lazy_sprite(),
    clouds: Array.from({ length: CLOUD_SPRITE_COUNT }, create_lazy_sprite),
    tree: create_lazy_sprite(),
    next_tree: create_lazy_sprite(),
  };
};
