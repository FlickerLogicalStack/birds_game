import { clamp01 } from '../../utils/math';
import { consume_mouse } from '../../../engine/inputs';
import { in_rect, is_clicked, is_hovered, type Rect } from '../camera/camera';
import { fill_round_rect, fill_stroke_round_rect, with_smoothing } from '../../utils/draw';
import { draw_text_fit, measure_text, pixel_font } from '../../utils/pixel_font';
import { open_hatch } from '../../scenes/hatch/hatch.state';
import { cancel_pick } from '../../scenes/breeding/breeding.state';
import { restart_app } from '../../../engine/app_update';
import { CONFIG } from '../../../config';
import { __opt_prepare_mutations, __opt_remember_shape, FLOAT_ZERO } from '../../../engine/shape';

const LIFE_MS = CONFIG.notices.life_ms;
const FADE_IN_MS = CONFIG.notices.fade_in_ms;
const FADE_OUT_MS = CONFIG.notices.fade_out_ms;
const MAX_VISIBLE = CONFIG.notices.max_visible;
const SLIDE_IN = CONFIG.notices.slide_in;
const SLIDE_MS = CONFIG.notices.slide_ms;
const MARGIN = CONFIG.notices.margin;
const GAP = CONFIG.notices.gap;
const MIN_WIDTH = CONFIG.notices.min_width;
const PAD_X = CONFIG.notices.pad_x;
const PAD_Y = CONFIG.notices.pad_y;
const TITLE_FONT_SIZE = CONFIG.notices.title_font_size;
const TITLE_H = CONFIG.notices.title_height;
const TEXT_FONT_SIZE = CONFIG.notices.text_font_size;
const TEXT_H = CONFIG.notices.text_height;
const LINE_GAP = CONFIG.notices.line_gap;

const BACKGROUND = CONFIG.theme.scene_bar.background;
const BORDER = CONFIG.theme.scene_bar.border;
const HOVER = CONFIG.theme.scene_bar.button_hover;
const TEXT = CONFIG.theme.text_muted;

export type NoticeAction =
  | { kind: 'none' }
  | { kind: 'hatch'; bird: BIRD.Bird }
  | { kind: 'achievements' }
  | { kind: 'restart' };

export const NO_NOTICE_ACTION: NoticeAction = { kind: 'none' };

export type Notice = {
  key: string | null;
  title: string;
  text: string;
  color: string;
  action: NoticeAction;
  shown_ms: number;
  hovered: boolean;
  placed: boolean;
  target_y: number;
  rect: Rect;
};

const notice_of = (
  key: string | null,
  title: string,
  text: string,
  color: string,
  action: NoticeAction,
  time: number,
): Notice => ({
  key,
  title,
  text,
  color,
  action,
  shown_ms: time,
  hovered: false,
  placed: false,
  target_y: time,
  rect: { x: time, y: time, w: time, h: time },
});

__opt_prepare_mutations(__opt_remember_shape(notice_of(null, '', '', '', NO_NOTICE_ACTION, 0.5)), [
  'shown_ms',
  'hovered',
  'placed',
  'target_y',
]);

export const push_notice = (
  game: BIRD.GameState,
  key: string | null,
  title: string,
  text: string,
  color: string,
  action: NoticeAction,
) => {
  if (key !== null) {
    game.notices = game.notices.filter(notice => notice.key !== key);
  }

  game.notices.push(notice_of(key, title, text, color, action, FLOAT_ZERO));
};

const has_notices = (game: BIRD.GameState) => game.current_scene !== 'loading';

const visible_count = (game: BIRD.GameState) =>
  has_notices(game) ? Math.min(MAX_VISIBLE, game.notices.length) : 0;

const is_leaving = (notice: Notice) => notice.shown_ms >= LIFE_MS - FADE_OUT_MS;

const notice_alpha = (notice: Notice) =>
  clamp01(Math.min(notice.shown_ms / FADE_IN_MS, (LIFE_MS - notice.shown_ms) / FADE_OUT_MS));

const place_notices = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const { width, pixel_ratio: s, dpr, safe } = engine.canvas;
  const title_font = pixel_font(TITLE_FONT_SIZE, s, dpr, 700);
  const text_font = pixel_font(TEXT_FONT_SIZE, s, dpr, 400);
  const h = (PAD_Y * 2 + TITLE_H + LINE_GAP + TEXT_H) * s;
  const max_w = width - safe.left - safe.right - MARGIN * 2 * s;
  let y = safe.top + MARGIN * s;

  for (let i = 0; i < visible_count(game); i++) {
    const notice = game.notices[i]!;
    const content = Math.max(
      measure_text(notice.title, title_font),
      measure_text(notice.text, text_font),
    );
    const w = Math.min(max_w, Math.max(MIN_WIDTH * s, Math.ceil(content + PAD_X * 2 * s)));

    notice.rect.x = Math.round((width - w) / 2);
    notice.rect.w = w;
    notice.rect.h = h;
    notice.target_y = y;

    if (!notice.placed) {
      notice.placed = true;
      notice.rect.y = y - SLIDE_IN * s;
    }

    y += h + GAP * s;
  }
};

export const handle_notices_input = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const mouse = engine.inputs.mouse;
  let over = false;

  place_notices(engine, game);

  for (let i = 0; i < visible_count(game); i++) {
    const notice = game.notices[i]!;
    const rect = notice.rect;
    const clicked = is_clicked(mouse, rect);

    notice.hovered = is_hovered(mouse, rect);
    over ||= notice.hovered || clicked;

    if (mouse.is_dragging === true && in_rect(rect, mouse.down_x, mouse.down_y)) {
      mouse.pan_x = 0;
      mouse.pan_y = 0;
    }

    if (clicked && !is_leaving(notice)) {
      notice.shown_ms = LIFE_MS - FADE_OUT_MS;

      const action = notice.action;

      if (action.kind === 'hatch' && game.birds.includes(action.bird)) {
        open_hatch(game, action.bird);
      } else if (action.kind === 'achievements' && game.current_scene !== 'loading') {
        cancel_pick(game);
        game.current_scene = 'achievements';
      } else if (action.kind === 'restart') {
        restart_app();
      }
    }
  }

  if (over) {
    consume_mouse(mouse);
  }

  return over;
};

const fade_on_scene_change = (game: BIRD.GameState) => {
  if (game.current_scene === game.notices_scene) {
    return;
  }

  if (game.notices_scene !== 'loading') {
    for (const notice of game.notices) {
      if (notice.placed) {
        notice.shown_ms = Math.max(notice.shown_ms, LIFE_MS - FADE_OUT_MS);
      }
    }
  }

  game.notices_scene = game.current_scene;
};

export const update_notices = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const slide = 1 - Math.exp(-engine.delta / SLIDE_MS);

  fade_on_scene_change(game);

  for (let i = 0; i < visible_count(game); i++) {
    const notice = game.notices[i]!;

    if (!notice.hovered || is_leaving(notice)) {
      notice.shown_ms += engine.delta;
    }

    notice.rect.y += (notice.target_y - notice.rect.y) * slide;
  }

  for (let i = game.notices.length - 1; i >= 0; i--) {
    if (game.notices[i]!.shown_ms >= LIFE_MS) {
      game.notices.splice(i, 1);
    }
  }
};

export const render_notices = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const ctx = engine.ctx;
  const { pixel_ratio: s, dpr } = engine.canvas;
  const title_font = pixel_font(TITLE_FONT_SIZE, s, dpr, 700);
  const text_font = pixel_font(TEXT_FONT_SIZE, s, dpr, 400);
  const radius = 8 * s;

  place_notices(engine, game);

  for (let i = 0; i < visible_count(game); i++) {
    const notice = game.notices[i]!;
    const { x, y, w, h } = notice.rect;
    const center = x + w / 2;
    const max_w = w - PAD_X * 2 * s;

    ctx.globalAlpha = notice_alpha(notice);
    fill_stroke_round_rect(ctx, x, y, w, h, radius, BACKGROUND, BORDER, 1);

    if (notice.hovered && !is_leaving(notice)) {
      fill_round_rect(ctx, x, y, w, h, radius, HOVER);
    }

    with_smoothing(ctx, false, () => {
      draw_text_fit(
        ctx,
        notice.title,
        center,
        y + (PAD_Y + TITLE_H / 2) * s,
        title_font,
        notice.color,
        'center',
        'middle',
        max_w,
      );
      draw_text_fit(
        ctx,
        notice.text,
        center,
        y + (PAD_Y + TITLE_H + LINE_GAP + TEXT_H / 2) * s,
        text_font,
        TEXT,
        'center',
        'middle',
        max_w,
      );
    });
  }

  ctx.globalAlpha = 1;
};
