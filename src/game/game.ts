import { loop } from '../engine/engine';
import { load_resources } from '../engine/resources/resources';
import { sync_ui_cursor } from './entities/ui/ui_fade';
import { handle_gameplay } from './game.gameplay';
import { handle_input } from './game.inputs';
import { take_screenshot } from './game.screenshot';
import { render_frame } from './game.render';
import { create_game_state, setup_game_state } from './game.state';

const on_frame = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const started = performance.now();

  handle_input(engine, game);

  handle_gameplay(engine, game);

  game.debug_hud.renders = 0;

  render_frame(engine, game);

  if (game.is_in_screenshot_mode === true) {
    take_screenshot(engine, game);
    game.is_in_screenshot_mode = false;
  }

  sync_ui_cursor(engine, game.ui_fade);

  if (game.debug_hud.enabled === 1) {
    game.debug_hud.frame_times.push(performance.now() - started);
  }
};

void loop(
  () => document.querySelector('canvas')!,
  load_resources,
  { create: create_game_state, setup: setup_game_state },
  on_frame,
);
