import { __opt_prepare_mutations, __opt_remember_shape, FLOAT_ZERO } from '../../../engine/shape';
import { CONFIG } from '../../../config';

const IDLE_MS = CONFIG.ui_fade.idle_ms;
const FADE_OUT_MS = CONFIG.ui_fade.fade_out_ms;
const FADE_IN_MS = CONFIG.ui_fade.fade_in_ms;

export type UiFade = {
  still_ms: number;
  alpha: number;
  x: number;
  y: number;
  cursor_hidden: boolean;
};

const ui_fade_of = (
  still_ms: number,
  alpha: number,
  x: number,
  y: number,
  cursor_hidden: boolean,
): UiFade => ({
  still_ms,
  alpha,
  x,
  y,
  cursor_hidden,
});

__opt_prepare_mutations(__opt_remember_shape(ui_fade_of(0.5, 0.5, 0.5, 0.5, false)), [
  'still_ms',
  'alpha',
  'x',
  'y',
  'cursor_hidden',
]);

export const create_ui_fade = (): UiFade =>
  ui_fade_of(FLOAT_ZERO, 1, FLOAT_ZERO, FLOAT_ZERO, false);

export const track_ui_activity = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const fade = game.ui_fade;
  const mouse = engine.inputs.mouse;
  const active =
    mouse.x !== fade.x ||
    mouse.y !== fade.y ||
    mouse.click ||
    mouse.double_click ||
    mouse.is_dragging ||
    mouse.wheel !== 0 ||
    mouse.pan_x !== 0 ||
    mouse.pan_y !== 0 ||
    mouse.zoom !== 1;

  fade.x = mouse.x;
  fade.y = mouse.y;
  fade.still_ms = active || game.current_scene !== 'primary' ? 0 : fade.still_ms + engine.delta;
};

export const keep_ui_shown = (fade: UiFade) => {
  fade.still_ms = 0;
};

export const is_ui_idle = (fade: UiFade) => fade.still_ms >= IDLE_MS;

export const update_ui_fade = (fade: UiFade, delta_ms: number) => {
  fade.alpha = is_ui_idle(fade)
    ? Math.max(0, fade.alpha - delta_ms / FADE_OUT_MS)
    : Math.min(1, fade.alpha + delta_ms / FADE_IN_MS);
};

export const is_ui_hidden = (fade: UiFade) => fade.alpha === 0;

export const sync_ui_cursor = (engine: BIRD.EngineContext, fade: UiFade) => {
  const hidden = is_ui_idle(fade);

  if (hidden !== fade.cursor_hidden) {
    fade.cursor_hidden = hidden;
    engine.canvas.element.style.cursor = hidden ? 'none' : '';
  }
};
