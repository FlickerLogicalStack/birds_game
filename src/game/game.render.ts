import { render_debug_hud } from './entities/debug_hud/debug_hud.renderer';
import { render_notices } from './entities/notices/notices';
import { render_scene_bar } from './entities/ui/scene_bar';
import { render_breeding_scene } from './scenes/breeding/breeding.render';
import { render_collection_scene } from './scenes/collection/collection.render';
import { render_hatch_scene } from './scenes/hatch/hatch.render';
import { render_achievements_scene } from './scenes/achievements/achievements.render';
import { render_loading_scene } from './scenes/loading/loading.render';
import { render_primary_debug, render_primary_scene } from './scenes/primary/primary.render';
import { render_profile_scene } from './scenes/profile/profile.render';

const render_current_scene = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  switch (game.current_scene) {
    case 'loading':
      render_loading_scene(engine, game);
      break;
    case 'primary':
      render_primary_scene(engine, game, game.primary_scene);
      break;
    case 'collection':
      render_collection_scene(engine, game, game.collection_scene);
      break;
    case 'profile':
      render_profile_scene(engine, game, game.profile_scene);
      break;
    case 'breeding':
      render_breeding_scene(engine, game, game.breeding_scene);
      break;
    case 'hatch':
      render_hatch_scene(engine, game, game.hatch_scene);
      break;
    case 'achievements':
      render_achievements_scene(engine, game, game.achievements_scene);
      break;
  }
};

const render_current_debug = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  switch (game.current_scene) {
    case 'loading':
      break;
    case 'primary':
      render_primary_debug(engine, game, game.primary_scene);
      break;
    case 'collection':
    case 'profile':
    case 'breeding':
    case 'hatch':
    case 'achievements':
      break;
  }
};

export const render_frame = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  render_current_scene(engine, game);
  render_scene_bar(engine, game);
  render_notices(engine, game);

  if (game.debug_hud.enabled === 1) {
    render_current_debug(engine, game);
    render_debug_hud(engine, game);
  }
};
