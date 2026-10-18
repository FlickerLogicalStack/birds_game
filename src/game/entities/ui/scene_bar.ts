import { consume_mouse } from '../../../engine/inputs';
import { in_rect, is_clicked, is_hovered, type Rect } from '../camera/camera';
import { cancel_pick } from '../../scenes/breeding/breeding.state';
import { ACHIEVEMENTS_ICON, BREEDING_ICON, COLLECTION_ICON, TREE_ICON } from './scene_bar.icons';
import { draw_icon_centered, type PixelIcon } from '../../utils/pixel_icon';
import {
  fill_round_rect,
  fill_stroke_round_rect,
  fill_tip,
  tip_width,
  with_smoothing,
} from '../../utils/draw';
import { pixel_font } from '../../utils/pixel_font';
import {
  create_ui_cache,
  draw_ui_cache,
  ui_cache_begin,
  ui_cache_key,
  ui_cache_redraw,
} from '../../utils/ui_cache';
import type { Ctx2D } from '../../../engine/canvas';
import { icon_alpha } from './icon_alpha';
import { is_ui_hidden } from './ui_fade';
import { CONFIG } from '../../../config';

const BAR_MARGIN = CONFIG.scene_bar.margin;
const BAR_PAD = CONFIG.scene_bar.pad;
const BUTTON_SIZE = CONFIG.scene_bar.button_size;
const BUTTON_GAP = CONFIG.scene_bar.button_gap;
const TIP_FONT_SIZE = CONFIG.scene_bar.tip_font_size;
const TIP_PAD_X = CONFIG.scene_bar.tip_pad_x;
const TIP_HEIGHT = CONFIG.scene_bar.tip_height;
const TIP_GAP = CONFIG.scene_bar.tip_gap;

const BAR_BACKGROUND = CONFIG.theme.scene_bar.background;
const BAR_BORDER = CONFIG.theme.scene_bar.border;
const BUTTON_HOVER = CONFIG.theme.scene_bar.button_hover;
const BUTTON_ACTIVE = CONFIG.theme.active;
const TEXT = CONFIG.theme.text;

export const SCENE_BAR_SPACE = BAR_MARGIN + BAR_PAD * 2 + BUTTON_SIZE;

type BarButton = { scene: BIRD.SceneName; label: string; icon: PixelIcon };

const BAR_BUTTONS: BarButton[] = [
  { scene: 'primary', label: 'Tree', icon: TREE_ICON },
  { scene: 'collection', label: 'Collection', icon: COLLECTION_ICON },
  { scene: 'breeding', label: 'Breeding', icon: BREEDING_ICON },
  { scene: 'achievements', label: 'Achievements', icon: ACHIEVEMENTS_ICON },
];

type SceneBarLayout = {
  rect: Rect;
  buttons: (BarButton & { rect: Rect })[];
};

const bar_scene = (game: BIRD.GameState): BIRD.SceneName =>
  game.current_scene === 'profile'
    ? 'collection'
    : game.current_scene === 'collection' && game.breeding_scene.picking !== -1
      ? 'breeding'
      : game.current_scene;

const is_active = (game: BIRD.GameState, button: BarButton) => button.scene === bar_scene(game);

const has_scene_bar = (game: BIRD.GameState) =>
  game.current_scene !== 'loading' &&
  game.current_scene !== 'hatch' &&
  !(game.current_scene === 'profile' && game.profile_scene.gene_dialog !== null);

const BUTTON_OFFSETS: number[] = [];
let row_width = 0;

BAR_BUTTONS.forEach((_, i) => {
  row_width += i === 0 ? 0 : BUTTON_GAP;
  BUTTON_OFFSETS.push(row_width);
  row_width += BUTTON_SIZE;
});

const LAYOUT: SceneBarLayout = {
  rect: { x: 0, y: 0, w: row_width + BAR_PAD * 2, h: BUTTON_SIZE + BAR_PAD * 2 },
  buttons: BAR_BUTTONS.map(button => ({
    ...button,
    rect: { x: 0, y: 0, w: BUTTON_SIZE, h: BUTTON_SIZE },
  })),
};

const CACHE = create_ui_cache();

const scene_bar_layout = (engine: BIRD.EngineContext): SceneBarLayout => {
  const { rect, buttons } = LAYOUT;

  rect.x = Math.round((engine.canvas.width - row_width) / 2) - BAR_PAD;
  rect.y = engine.canvas.height - engine.canvas.safe.bottom - BAR_MARGIN - rect.h;
  buttons.forEach((button, i) => {
    button.rect.x = rect.x + BAR_PAD + BUTTON_OFFSETS[i]!;
    button.rect.y = rect.y + BAR_PAD;
  });

  return LAYOUT;
};

export const handle_scene_bar_input = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  if (!has_scene_bar(game)) {
    return false;
  }

  const mouse = engine.inputs.mouse;
  const layout = scene_bar_layout(engine);

  if (mouse.is_dragging === true && in_rect(layout.rect, mouse.down_x, mouse.down_y)) {
    mouse.pan_x = 0;
    mouse.pan_y = 0;
  }

  const over = is_hovered(mouse, layout.rect);
  const clicked = is_clicked(mouse, layout.rect);

  if (!over && !clicked) {
    return false;
  }

  if (mouse.click === true) {
    const button = layout.buttons.find(b => in_rect(b.rect, mouse.x, mouse.y));

    if (button !== undefined) {
      cancel_pick(game);
      game.current_scene = button.scene;
    }
  }

  consume_mouse(mouse);

  return true;
};

const bake_scene_bar = (
  ctx: Ctx2D,
  game: BIRD.GameState,
  layout: SceneBarLayout,
  hovered: number,
) => {
  const { x, y, w, h } = layout.rect;
  const radius = BUTTON_SIZE / 3;

  fill_stroke_round_rect(ctx, x, y, w, h, radius + BAR_PAD, BAR_BACKGROUND, BAR_BORDER, 1);

  with_smoothing(ctx, false, () => {
    layout.buttons.forEach((button, i) => {
      const active = is_active(game, button);
      const hover = i === hovered;
      const r = button.rect;

      if (active || hover) {
        fill_round_rect(ctx, r.x, r.y, r.w, r.h, radius, active ? BUTTON_ACTIVE : BUTTON_HOVER);
      }

      ctx.globalAlpha = icon_alpha(active, hover, true);
      draw_icon_centered(ctx, button.icon, r, 1);
      ctx.globalAlpha = 1;
    });
  });
};

export const render_scene_bar = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  if (!has_scene_bar(game) || is_ui_hidden(game.ui_fade)) {
    return;
  }

  const ctx = engine.ctx;
  const mouse = engine.inputs.mouse;
  const layout = scene_bar_layout(engine);
  const buttons = layout.buttons;
  let hovered = -1;

  for (let i = 0; i < buttons.length && hovered === -1; i++) {
    if (is_hovered(mouse, buttons[i]!.rect)) {
      hovered = i;
    }
  }

  ui_cache_begin(CACHE, engine, layout.rect);
  ui_cache_key(CACHE, hovered);

  for (const button of buttons) {
    ui_cache_key(CACHE, is_active(game, button) ? 1 : 0);
  }

  const redraw = ui_cache_redraw(CACHE);

  if (redraw !== null) {
    bake_scene_bar(redraw, game, layout, hovered);
  }

  ctx.globalAlpha = game.ui_fade.alpha;
  draw_ui_cache(ctx, CACHE);

  if (hovered !== -1) {
    const button = buttons[hovered]!;
    const tip_font = pixel_font(TIP_FONT_SIZE, 1, engine.canvas.dpr, 600);
    const tip_w = tip_width(button.label, tip_font, TIP_PAD_X);
    const tip_x = Math.round(button.rect.x + button.rect.w / 2 - tip_w / 2);
    const tip_y = layout.rect.y - TIP_GAP - TIP_HEIGHT;

    fill_tip(ctx, button.label, tip_x, tip_y, tip_w, TIP_HEIGHT, 1, tip_font, BAR_BACKGROUND, TEXT);
  }

  ctx.globalAlpha = 1;
};
