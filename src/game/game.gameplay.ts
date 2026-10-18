import { age_bird } from './entities/birds/birds.age';
import { fade_joy } from './entities/birds/birds.joy';
import { update_notices } from './entities/notices/notices';
import { update_save } from './entities/save/save';
import { update_tree_growth } from './entities/tree/tree.growth';
import { update_ui_fade } from './entities/ui/ui_fade';
import { handle_collection_gameplay } from './scenes/collection/collection.gameplay';
import { update_hatch } from './scenes/hatch/hatch.state';
import { handle_loading_gameplay } from './scenes/loading/loading.gameplay';
import { handle_primary_gameplay } from './scenes/primary/primary.gameplay';

export const handle_gameplay = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  for (const bird of game.birds) {
    bird.behaviour.update(engine.delta);
    age_bird(bird, engine.delta);
    fade_joy(bird, engine.delta);
  }

  update_ui_fade(game.ui_fade, engine.delta);
  update_save(engine, game);
  update_tree_growth(engine, game);
  update_notices(engine, game);

  switch (game.current_scene) {
    case 'primary':
      handle_primary_gameplay(engine, game, game.primary_scene);
      break;
    case 'collection':
      handle_collection_gameplay(game, game.collection_scene);
      break;
    case 'loading':
      handle_loading_gameplay(engine, game, game.loading_scene);
      break;
    case 'hatch':
      update_hatch(engine, game.hatch_scene);
      break;
    case 'profile':
    case 'breeding':
    case 'achievements':
      break;
  }

  if (game.debug_hud.enabled === 1) {
    game.debug_hud.frames.push(engine.delta);
  }
};
