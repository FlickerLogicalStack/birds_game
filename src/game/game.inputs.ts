import { consume_mouse } from '../engine/inputs';
import { can_fullscreen, toggle_fullscreen } from '../engine/fullscreen';
import { pick } from './utils/random';
import { add_wild_bird, release_random_bird } from './entities/birds/birds';
import { step_test_joy } from './entities/birds/birds.joy';
import { pass_idle_time } from './entities/idle/idle';
import { handle_notices_input } from './entities/notices/notices';
import { request_save, reset_game } from './entities/save/save';
import { toggle_debug_hud } from './entities/debug_hud/debug_hud';
import { dismiss_day_panel, handle_day_panel_input } from './entities/ui/day_panel';
import { handle_view_panel_input } from './entities/ui/view_panel';
import { handle_scene_bar_input } from './entities/ui/scene_bar';
import { is_ui_hidden, is_ui_idle, keep_ui_shown, track_ui_activity } from './entities/ui/ui_fade';
import { DAY_PANEL_VIEW } from './entities/ui/day_panel.layout';
import { cancel_pick } from './scenes/breeding/breeding.state';
import { handle_breeding_input } from './scenes/breeding/breeding.inputs';
import { handle_collection_input } from './scenes/collection/collection.inputs';
import { RARITIES } from './scenes/collection/collection.state';
import { handle_hatch_input } from './scenes/hatch/hatch.inputs';
import { handle_achievements_input } from './scenes/achievements/achievements.inputs';
import { handle_loading_input } from './scenes/loading/loading.inputs';
import { handle_primary_input } from './scenes/primary/primary.inputs';
import { handle_profile_input } from './scenes/profile/profile.inputs';
import { CONFIG } from '../config';

const SKIP_MS = CONFIG.idle.skip_ms;

export const handle_input = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const { kb, mouse } = engine.inputs;

  track_ui_activity(engine, game);

  if (kb.KeyH === true) {
    kb.KeyH = false;
    toggle_debug_hud(game.debug_hud);
  }

  if (kb.KeyF === true) {
    kb.KeyF = false;

    if (can_fullscreen()) {
      toggle_fullscreen(engine.ctx.canvas);
    }
  }

  if (kb.KeyP === true) {
    kb.KeyP = false;
    game.is_in_screenshot_mode = true;
  }

  if (kb.Backslash === true) {
    kb.Backslash = false;
    reset_game(engine, game);
  }

  if (kb.BracketLeft === true) {
    kb.BracketLeft = false;
    release_random_bird(engine, game);
  }

  if (kb.BracketRight === true) {
    kb.BracketRight = false;
    add_wild_bird(engine, game, pick(RARITIES, Math.random, 'common'));
  }

  if (kb.Quote === true) {
    kb.Quote = false;
    pass_idle_time(engine, game, SKIP_MS);
  }

  if (kb.KeyJ === true) {
    kb.KeyJ = false;
    step_test_joy(game);
    request_save(game);
  }

  if (kb.Digit1 === true) {
    kb.Digit1 = false;
    cancel_pick(game);
    game.current_scene = 'primary';
  }

  if (kb.Digit2 === true) {
    kb.Digit2 = false;
    cancel_pick(game);
    game.current_scene = 'collection';
  }

  if (kb.Digit3 === true) {
    kb.Digit3 = false;
    cancel_pick(game);
    game.current_scene = 'breeding';
  }

  if (kb.Digit4 === true) {
    kb.Digit4 = false;
    cancel_pick(game);
    game.current_scene = 'achievements';
  }

  const is_over = mouse.is_over;
  const over_notice = handle_notices_input(engine, game);

  if (over_notice) {
    mouse.is_over = false;
  }

  const shown = !is_ui_hidden(game.ui_fade);
  const dismissed = shown && dismiss_day_panel(engine, game);
  const over_scene_bar = shown && handle_scene_bar_input(engine, game);
  const over_day_panel = shown && handle_day_panel_input(engine, game);
  const over_view_panel = shown && handle_view_panel_input(engine, game);
  const over_bar = over_scene_bar || over_day_panel || over_view_panel || over_notice;

  if (dismissed) {
    consume_mouse(mouse);
  }

  if (over_bar || is_ui_idle(game.ui_fade)) {
    mouse.is_over = false;
  }

  if (over_bar || DAY_PANEL_VIEW.open) {
    keep_ui_shown(game.ui_fade);
  }

  switch (game.current_scene) {
    case 'loading':
      handle_loading_input(engine, game);
      break;
    case 'primary':
      handle_primary_input(engine, game, game.primary_scene);
      break;
    case 'collection':
      handle_collection_input(engine, game, game.collection_scene);
      break;
    case 'profile':
      handle_profile_input(engine, game, game.profile_scene);
      break;
    case 'breeding':
      handle_breeding_input(engine, game, game.breeding_scene);
      break;
    case 'hatch':
      handle_hatch_input(engine, game, game.hatch_scene);
      break;
    case 'achievements':
      handle_achievements_input(engine, game, game.achievements_scene);
      break;
  }

  mouse.is_over = is_over;

  consume_mouse(mouse);
};
