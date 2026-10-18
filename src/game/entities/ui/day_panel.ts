import { consume_mouse } from '../../../engine/inputs';
import { in_rect, is_clicked, is_hovered, type Rect } from '../camera/camera';
import {
  can_step_day_speed,
  save_day_cycle,
  skip_day_cycle_to,
  step_day_speed,
  toggle_day_pause,
  type DayCycle,
} from '../sky/sky';
import {
  fill_round_rect,
  fill_stroke_round_rect,
  fill_tip,
  tip_width,
  with_smoothing,
} from '../../utils/draw';
import { pixel_font } from '../../utils/pixel_font';
import { update_layout, type Layout } from '../../utils/layout';
import {
  MINUS_ICON,
  MOON_ICON,
  PAUSE_ICON,
  PLAY_ICON,
  PLUS_ICON,
  SUN_ICON,
} from './day_panel.icons';
import { DAY_PANEL_LAYOUT, DAY_PANEL_LAYOUT_ELEMENTS, DAY_PANEL_VIEW } from './day_panel.layout';
import { draw_icon_centered, type PixelIcon } from '../../utils/pixel_icon';
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

const MARGIN = CONFIG.day_panel.margin;
const PAD = CONFIG.day_panel.pad;
const BUTTON_SIZE = CONFIG.day_panel.button_size;
const TIP_FONT_SIZE = CONFIG.scene_bar.tip_font_size;
const TIP_PAD_X = CONFIG.scene_bar.tip_pad_x;
const TIP_HEIGHT = CONFIG.scene_bar.tip_height;
const TIP_GAP = CONFIG.scene_bar.tip_gap;
const SCALE_KEY = 1024;

const DAY_START_PHASE = CONFIG.sky.day_start_phase;
const NIGHT_START_PHASE = CONFIG.sky.night_start_phase;

const BACKGROUND = CONFIG.theme.scene_bar.background;
const BORDER = CONFIG.theme.scene_bar.border;
const BUTTON_HOVER = CONFIG.theme.scene_bar.button_hover;
const BUTTON_ACTIVE = CONFIG.theme.active;
const TEXT = CONFIG.theme.text;

type DayCell =
  | { kind: 'skip'; phase: number; icon: 'sun' | 'moon' }
  | { kind: 'speed'; dir: -1 | 1 }
  | { kind: 'pause' };

const E = DAY_PANEL_LAYOUT_ELEMENTS;

const CELLS: { cell: DayCell; handle: number }[] = [
  { cell: { kind: 'skip', phase: DAY_START_PHASE, icon: 'sun' }, handle: E.sun },
  { cell: { kind: 'skip', phase: NIGHT_START_PHASE, icon: 'moon' }, handle: E.moon },
  { cell: { kind: 'speed', dir: -1 }, handle: E.slower },
  { cell: { kind: 'speed', dir: 1 }, handle: E.faster },
  { cell: { kind: 'pause' }, handle: E.pause },
];

const CACHE = create_ui_cache();

const has_day_panel = (game: BIRD.GameState) => game.current_scene === 'primary';

const cell_at = (layout: Layout, x: number, y: number) =>
  CELLS.find(c => in_rect(layout.rects[c.handle]!, x, y));

const is_active = (day: DayCycle, cell: DayCell) =>
  cell.kind === 'skip' ? day.target === cell.phase : cell.kind === 'pause' && day.speed === 0;

const is_enabled = (day: DayCycle, cell: DayCell) =>
  cell.kind !== 'speed' || can_step_day_speed(day, cell.dir);

const cell_icon = (day: DayCycle, cell: DayCell): PixelIcon => {
  switch (cell.kind) {
    case 'skip':
      return cell.icon === 'sun' ? SUN_ICON : MOON_ICON;
    case 'speed':
      return cell.dir === -1 ? MINUS_ICON : PLUS_ICON;
    case 'pause':
      return day.speed === 0 ? PLAY_ICON : PAUSE_ICON;
  }
};

const tip_text = (day: DayCycle, cell: DayCell) => {
  switch (cell.kind) {
    case 'skip':
      return cell.icon === 'sun' ? 'Start day' : 'Start night';
    case 'speed':
      return cell.dir === -1 ? 'Slower' : 'Faster';
    case 'pause':
      return day.speed === 0 ? 'Resume' : 'Pause';
  }
};

export const dismiss_day_panel = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const view = DAY_PANEL_VIEW;
  const mouse = engine.inputs.mouse;

  if (!view.pinned || mouse.click !== true || !has_day_panel(game)) {
    return false;
  }

  const layout = update_layout(DAY_PANEL_LAYOUT, engine, game);

  if (is_clicked(mouse, layout.rects[E.panel]!)) {
    return false;
  }

  view.open = view.pinned = false;

  return true;
};

export const handle_day_panel_input = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  if (!has_day_panel(game)) {
    DAY_PANEL_VIEW.open = DAY_PANEL_VIEW.pinned = false;
    return false;
  }

  const view = DAY_PANEL_VIEW;
  const mouse = engine.inputs.mouse;
  const layout = update_layout(DAY_PANEL_LAYOUT, engine, game);
  const was_open = view.open;
  const area = layout.rects[was_open ? E.panel : E.toggle]!;

  if (mouse.is_dragging === true && in_rect(area, mouse.down_x, mouse.down_y)) {
    mouse.pan_x = 0;
    mouse.pan_y = 0;
  }

  const over = is_hovered(mouse, area);
  const clicked = is_clicked(mouse, area);

  if (!was_open) {
    view.open = (over && !mouse.is_touch) || clicked;
    view.pinned = clicked;
  } else if (!view.pinned && !over) {
    view.open = false;
  }

  if (!over && !clicked) {
    return false;
  }

  if (mouse.click === true && was_open) {
    const cell = cell_at(layout, mouse.x, mouse.y)?.cell;
    const day = game.primary_scene.day;

    if (cell?.kind === 'skip') {
      skip_day_cycle_to(day, cell.phase);
    } else if (cell?.kind === 'pause') {
      toggle_day_pause(day);
    } else if (cell?.kind === 'speed') {
      step_day_speed(day, cell.dir);
    }

    if (cell !== undefined) {
      save_day_cycle(day);
    }
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
  const ctx = engine.ctx;
  const font = pixel_font(TIP_FONT_SIZE, s, engine.canvas.dpr, 600);
  const tip_w = tip_width(label, font, TIP_PAD_X * s);
  const tip_h = TIP_HEIGHT * s;
  const tip_x = Math.min(
    Math.round(rect.x + rect.w / 2 - tip_w / 2),
    engine.canvas.width - engine.canvas.safe.right - MARGIN * s - tip_w,
  );
  const tip_y = panel.y + panel.h + TIP_GAP * s;

  fill_tip(ctx, label, tip_x, tip_y, tip_w, tip_h, s, font, BACKGROUND, TEXT);
};

const clip_half = (ctx: Ctx2D, x: number, y: number, n: number, px: number, sun: boolean) => {
  ctx.beginPath();

  if (sun) {
    ctx.rect(x - px, y - px, n * px, px);
  }

  for (let row = 0; row < n; row++) {
    const split = n - 1 - row;

    if (sun) {
      ctx.rect(x - px, y + row * px, (split + 1) * px, px);
    } else {
      ctx.rect(x + split * px, y + row * px, (n - split) * px, px);
    }
  }

  ctx.clip();
};

const bake_toggle = (ctx: Ctx2D, r: Rect, s: number, radius: number) => {
  const n = MOON_ICON.rows.length;
  const px = MOON_ICON.scale * s;
  const x = r.x + Math.floor((r.w - n * px) / 2);
  const y = r.y + Math.floor((r.h - n * px) / 2);

  fill_stroke_round_rect(ctx, r.x, r.y, r.w, r.h, radius, BACKGROUND, BORDER, 1);
  with_smoothing(ctx, false, () => {
    ctx.save();
    clip_half(ctx, x, y, n, px, true);
    draw_icon_centered(ctx, SUN_ICON, r, s);
    ctx.restore();
    ctx.save();
    clip_half(ctx, x, y, n, px, false);
    draw_icon_centered(ctx, MOON_ICON, r, s);
    ctx.restore();
  });
};

const bake_panel = (ctx: Ctx2D, day: DayCycle, layout: Layout, s: number, hovered: number) => {
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
    CELLS.forEach(({ cell, handle }, i) => {
      const r = layout.rects[handle]!;
      const enabled = is_enabled(day, cell);
      const active = is_active(day, cell);
      const hover = i === hovered;

      if (enabled && (active || hover)) {
        fill_round_rect(ctx, r.x, r.y, r.w, r.h, radius, active ? BUTTON_ACTIVE : BUTTON_HOVER);
      }

      ctx.globalAlpha = icon_alpha(active, hover, enabled);
      draw_icon_centered(ctx, cell_icon(day, cell), r, s);
      ctx.globalAlpha = 1;
    });
  });
};

export const render_day_panel = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  if (is_ui_hidden(game.ui_fade)) {
    return;
  }

  const ctx = engine.ctx;
  const mouse = engine.inputs.mouse;
  const day = game.primary_scene.day;
  const layout = update_layout(DAY_PANEL_LAYOUT, engine, game);
  const open = DAY_PANEL_VIEW.open;
  const s = layout.scale[open ? E.panel : E.toggle]!;
  const rect = layout.rects[open ? E.panel : E.toggle]!;
  let hovered = -1;

  ui_cache_begin(CACHE, engine, rect);
  ui_cache_key(CACHE, Math.round(s * SCALE_KEY));
  ui_cache_key(CACHE, open ? 1 : 0);

  if (open) {
    for (let i = 0; i < CELLS.length && hovered === -1; i++) {
      if (mouse.is_over && in_rect(layout.rects[CELLS[i]!.handle]!, mouse.x, mouse.y)) {
        hovered = i;
      }
    }

    ui_cache_key(CACHE, hovered);

    for (const { cell } of CELLS) {
      ui_cache_key(CACHE, is_active(day, cell) ? 1 : 0);
      ui_cache_key(CACHE, is_enabled(day, cell) ? 1 : 0);
    }
  }

  const redraw = ui_cache_redraw(CACHE);

  if (redraw !== null) {
    if (open) {
      bake_panel(redraw, day, layout, s, hovered);
    } else {
      bake_toggle(redraw, rect, s, (BUTTON_SIZE / 3 + PAD) * s);
    }
  }

  ctx.globalAlpha = game.ui_fade.alpha;
  draw_ui_cache(ctx, CACHE);

  if (hovered !== -1) {
    const { cell, handle } = CELLS[hovered]!;

    render_tip(engine, tip_text(day, cell), layout.rects[handle]!, layout.rects[E.panel]!, s);
  }

  ctx.globalAlpha = 1;
};
