import { IdleScheduler } from '../engine/idle';
import { create_breeding_scene } from './scenes/breeding/breeding.state';
import { create_debug_hud } from './entities/debug_hud/debug_hud';
import { create_save_state, load_game, offline_since } from './entities/save/save';
import { pass_idle_time, watch_page_visibility } from './entities/idle/idle';
import { watch_app_update } from './entities/notices/update_notice';
import { create_hatch_scene } from './scenes/hatch/hatch.state';
import { create_achievements_scene } from './scenes/achievements/achievements.state';
import { catch_up_achievements, load_achievements } from './entities/achievements/achievements';
import { create_ui_fade } from './entities/ui/ui_fade';
import { create_collection_scene } from './scenes/collection/collection.state';
import { create_loading_scene, setup_loading_scene } from './scenes/loading/loading.state';
import { create_primary_scene, populate_primary_scene } from './scenes/primary/primary.state';
import { create_profile_scene } from './scenes/profile/profile.state';
import { random_seed } from './utils/random';
import { CONFIG } from '../config';

const START_BIRDS = CONFIG.world.start_birds;
const MIN_TREE_LEVELS = CONFIG.tree.growth.min_levels;

export const create_game_state = (engine: BIRD.EngineContext): BIRD.GameState => {
  const saved = load_game();

  const game: BIRD.GameState = {
    birds: [],
    idle: new IdleScheduler(),
    debug_hud: create_debug_hud(),
    ui_fade: create_ui_fade(),
    notices: [],
    notices_scene: 'loading',
    achievements: load_achievements(),

    current_scene: 'loading',
    loading_scene: create_loading_scene(),
    primary_scene: create_primary_scene(
      engine,
      saved?.tree_seed ?? random_seed(Math.random),
      saved?.tree_levels ?? MIN_TREE_LEVELS,
      saved?.birds.length ?? START_BIRDS,
    ),
    collection_scene: create_collection_scene(),
    profile_scene: create_profile_scene(),
    breeding_scene: create_breeding_scene(),
    hatch_scene: create_hatch_scene(),
    achievements_scene: create_achievements_scene(),

    save: create_save_state(),

    is_in_screenshot_mode: false,
  };

  populate_primary_scene(engine, game, game.primary_scene, saved);
  catch_up_achievements(game);

  if (saved !== null) {
    pass_idle_time(engine, game, offline_since(saved.saved_at));
  }

  return game;
};

export const setup_game_state = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  setup_loading_scene(engine, game, game.loading_scene);
  watch_page_visibility(engine, game);
  watch_app_update(game);
};
