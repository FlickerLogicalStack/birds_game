import { is_hovered } from '../../entities/camera/camera';
import { loading_progress, loading_stage } from './loading.gameplay';
import { fill_rect, progress_bar } from '../../utils/draw';
import { draw_volatile_text } from '../../utils/pixel_font';
import { draw_node_text, fill_node_button, update_layout } from '../../utils/layout';
import { CONFIG } from '../../../config';
import { LOADING_LAYOUT, LOADING_LAYOUT_ELEMENTS } from './loading.layout';

const BACKGROUND = CONFIG.theme.background;
const TITLE_COLOR = CONFIG.theme.text;
const TEXT_COLOR = CONFIG.theme.text_muted;
const BAR_TRACK = CONFIG.theme.loading.bar_track;
const BAR_FILL = CONFIG.theme.accent;
const BUTTON = CONFIG.theme.loading.button;
const BUTTON_HOVER = CONFIG.theme.loading.button_hover;

export const render_loading_scene = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const ctx = engine.ctx;
  const layout = update_layout(LOADING_LAYOUT, engine, game);
  const { rects, fonts } = layout;
  const { title, bar, caption, skip } = LOADING_LAYOUT_ELEMENTS;
  const progress = loading_progress(engine);
  const { mouse } = engine.inputs;
  const hover = is_hovered(mouse, rects[skip]!);
  const line = `Loading ${Math.floor(progress * 100)}% - ${loading_stage(engine)}`;
  const r = engine.canvas.pixel_ratio;
  const track = rects[bar]!;
  const line_rect = rects[caption]!;

  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, BACKGROUND);
  draw_node_text(ctx, layout, title, TITLE_COLOR, 0);

  progress_bar(ctx, track.x, track.y, track.w, track.h, 4 * r, progress, BAR_TRACK, BAR_FILL, 0);
  draw_volatile_text(
    ctx,
    line,
    line_rect.x + line_rect.w / 2,
    line_rect.y + line_rect.h / 2,
    fonts[caption]!,
    TEXT_COLOR,
    'center',
    'middle',
  );

  fill_node_button(ctx, layout, skip, 8 * r, hover ? BUTTON_HOVER : BUTTON, 0);
  draw_node_text(ctx, layout, skip, TITLE_COLOR, 0);
};
