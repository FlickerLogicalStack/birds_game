import { consume_mouse } from '../../../engine/inputs';
import { is_fullscreen, toggle_fullscreen } from '../../../engine/fullscreen';
import { in_rect, is_clicked, is_hovered, type Rect } from '../camera/camera';
import { toggle_auto_follow } from '../camera/camera.auto_follow';
import { toggle_debug_hud } from '../debug_hud/debug_hud';
import { AUTO_FOLLOW_ICON, DEBUG_ICON, FULLSCREEN_ICON } from './scene_bar.icons';
import { draw_icon_centered, type PixelIcon } from '../../utils/pixel_icon';
import {
  fill_round_rect,
  fill_stroke_round_rect,
  fill_tip,
  tip_width,
  with_smoothing,
} from '../../utils/draw';
import { pixel_font } from '../../utils/pixel_font';
import { update_layout, type Layout } from '../../utils/layout';
import { VIEW_PANEL_LAYOUT, VIEW_PANEL_LAYOUT_ELEMENTS } from './view_panel.layout';
import { icon_alpha } from './icon_alpha';
import { is_ui_hidden } from './ui_fade';
import {
  create_ui_cache,
  draw_ui_cache,
  ui_cache_begin,
  ui_cache_key,
  ui_cache_redraw,
} from '../../utils/ui_cache';
import type { Ctx2D } from '../../../engine/canvas';
import { CONFIG } from '../../../config';

const PAD = CONFIG.day_panel.pad;
const BUTTON_SIZE = CONFIG.day_panel.button_size;
const TIP_FONT_SIZE = CONFIG.scene_bar.tip_font_size;
const TIP_PAD_X = CONFIG.scene_bar.tip_pad_x;
const TIP_HEIGHT = CONFIG.scene_bar.tip_height;
const TIP_GAP = CONFIG.scene_bar.tip_gap;
const SCALE_KEY = 1024;

const BACKGROUND = CONFIG.theme.scene_bar.background;
const BORDER = CONFIG.theme.scene_bar.border;
const BUTTON_HOVER = CONFIG.theme.scene_bar.button_hover;
const BUTTON_ACTIVE = CONFIG.theme.active;
const TEXT = CONFIG.theme.text;

type ViewCell = 'auto_follow' | 'fullscreen' | 'debug_hud';

const E = VIEW_PANEL_LAYOUT_ELEMENTS;

const CELLS: { cell: ViewCell; handle: number; label: string; icon: PixelIcon }[] = [
  { cell: 'auto_follow', handle: E.follow, label: 'Auto camera', icon: AUTO_FOLLOW_ICON },
  { cell: 'fullscreen', handle: E.fullscreen, label: 'Fullscreen', icon: FULLSCREEN_ICON },
  { cell: 'debug_hud', handle: E.debug, label: 'Debug', icon: DEBUG_ICON },
];

const CACHE = create_ui_cache();

const has_view_panel = (game: BIRD.GameState) => game.current_scene === 'primary';

const is_active = (game: BIRD.GameState, cell: ViewCell) => {
  switch (cell) {
    case 'auto_follow':
      return game.primary_scene.auto_follow.enabled;
    case 'fullscreen':
      return is_fullscreen();
    case 'debug_hud':
      return game.debug_hud.enabled === 1;
  }
};

const is_shown = (layout: Layout, handle: number) => layout.visible[handle] === 1;

export const view_panel_right = (game: BIRD.GameState) => {
  const panel = VIEW_PANEL_LAYOUT.rects[E.panel]!;

  return has_view_panel(game) && !is_ui_hidden(game.ui_fade) ? panel.x + panel.w : 0;
};

const cell_at = (layout: Layout, x: number, y: number) =>
  CELLS.find(c => is_shown(layout, c.handle) && in_rect(layout.rects[c.handle]!, x, y))?.cell;

export const handle_view_panel_input = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  if (!has_view_panel(game)) {
    return false;
  }

  const mouse = engine.inputs.mouse;
  const layout = update_layout(VIEW_PANEL_LAYOUT, engine, game);
  const area = layout.rects[E.panel]!;

  if (mouse.is_dragging === true && in_rect(area, mouse.down_x, mouse.down_y)) {
    mouse.pan_x = 0;
    mouse.pan_y = 0;
  }

  const over = is_hovered(mouse, area);
  const clicked = is_clicked(mouse, area);

  if (!over && !clicked) {
    return false;
  }

  const cell = mouse.click === true ? cell_at(layout, mouse.x, mouse.y) : undefined;

  if (cell === 'auto_follow') {
    const primary = game.primary_scene;

    toggle_auto_follow(primary.auto_follow, primary.camera_follow);
  } else if (cell === 'fullscreen') {
    toggle_fullscreen(engine.ctx.canvas);
  } else if (cell === 'debug_hud') {
    toggle_debug_hud(game.debug_hud);
  }

  consume_mouse(mouse);

  return true;
};

const render_tip = (
  engine: BIRD.EngineContext,
  label: string,
  rect: Rect,
  panel: Rect,
  s: number,
) => {
  const font = pixel_font(TIP_FONT_SIZE, s, engine.canvas.dpr, 600);
  const tip_w = tip_width(label, font, TIP_PAD_X * s);
  const tip_h = TIP_HEIGHT * s;
  const tip_x = panel.x + panel.w + TIP_GAP * s;
  const tip_y = Math.round(rect.y + rect.h / 2 - tip_h / 2);

  fill_tip(engine.ctx, label, tip_x, tip_y, tip_w, tip_h, s, font, BACKGROUND, TEXT);
};

const bake_panel = (
  ctx: Ctx2D,
  game: BIRD.GameState,
  layout: Layout,
  s: number,
  hovered: number,
) => {
  const panel = layout.rects[E.panel]!;
  const radius = (BUTTON_SIZE / 3) * s;

  fill_stroke_round_rect(
    ctx,
    panel.x,
    panel.y,
    panel.w,
    panel.h,
    radius + PAD * s,
    BACKGROUND,
    BORDER,
    1,
  );

  with_smoothing(ctx, false, () => {
    CELLS.forEach(({ cell, handle, icon }, i) => {
      if (!is_shown(layout, handle)) {
        return;
      }

      const r = layout.rects[handle]!;
      const active = is_active(game, cell);
      const hover = i === hovered;

      if (active || hover) {
        fill_round_rect(ctx, r.x, r.y, r.w, r.h, radius, active ? BUTTON_ACTIVE : BUTTON_HOVER);
      }

      ctx.globalAlpha = icon_alpha(active, hover, true);
      draw_icon_centered(ctx, icon, r, s);
      ctx.globalAlpha = 1;
    });
  });
};

export const render_view_panel = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  if (is_ui_hidden(game.ui_fade)) {
    return;
  }

  const ctx = engine.ctx;
  const mouse = engine.inputs.mouse;
  const layout = update_layout(VIEW_PANEL_LAYOUT, engine, game);
  const panel = layout.rects[E.panel]!;
  const s = layout.scale[E.panel]!;
  let hovered = -1;

  for (let i = 0; i < CELLS.length && hovered === -1; i++) {
    const handle = CELLS[i]!.handle;

    if (
      is_shown(layout, handle) &&
      mouse.is_over &&
      in_rect(layout.rects[handle]!, mouse.x, mouse.y)
    ) {
      hovered = i;
    }
  }

  ui_cache_begin(CACHE, engine, panel);
  ui_cache_key(CACHE, Math.round(s * SCALE_KEY));
  ui_cache_key(CACHE, hovered);

  for (const { cell } of CELLS) {
    ui_cache_key(CACHE, is_active(game, cell) ? 1 : 0);
  }

  const redraw = ui_cache_redraw(CACHE);

  if (redraw !== null) {
    bake_panel(redraw, game, layout, s, hovered);
  }

  ctx.globalAlpha = game.ui_fade.alpha;
  draw_ui_cache(ctx, CACHE);

  if (hovered !== -1) {
    const { label, handle } = CELLS[hovered]!;

    render_tip(engine, label, layout.rects[handle]!, panel, s);
  }

  ctx.globalAlpha = 1;
};
