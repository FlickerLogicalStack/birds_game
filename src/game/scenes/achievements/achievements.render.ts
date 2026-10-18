import {
  CARD_COUNT,
  COLLECTIONS,
  COUNTERS,
  HUE_COLORS,
  HUE_COLORS_MISSING,
  tier_of,
  tier_title,
  TIERS,
} from '../../entities/achievements/achievements';
import { draw_node_text, number_text, update_layout } from '../../utils/layout';
import {
  fill_rect,
  fill_round_rect,
  fill_stroke_round_rect,
  progress_bar,
  with_clip,
} from '../../utils/draw';
import { render_scrollbar } from '../../entities/ui/scrollbar';
import { draw_text, draw_volatile_text, pixel_font, type PixelFont } from '../../utils/pixel_font';
import type { Rect } from '../../entities/camera/camera';
import { ACHIEVEMENTS_LAYOUT, ACHIEVEMENTS_LAYOUT_ELEMENTS } from './achievements.layout';
import {
  card_width,
  cells_per_row,
  chip_font,
  chip_label,
  chip_lead,
  chip_width,
  collection_of,
  DIAMOND,
  has_chips,
  is_counter_card,
  value_count,
  values_top,
} from './achievements.cards';
import { CONFIG } from '../../../config';

const C = CONFIG.achievements;
const BACKGROUND = CONFIG.theme.background;
const CARD = CONFIG.theme.achievements.card;
const CARD_BORDER = CONFIG.theme.achievements.card_border;
const MISSING = CONFIG.theme.achievements.missing;
const CHIP = CONFIG.theme.achievements.chip;
const ACCENT = CONFIG.theme.accent;
const TEXT = CONFIG.theme.text;
const TEXT_DIM = CONFIG.theme.text_dim;
const TEXT_MUTED = CONFIG.theme.text_muted;
const LAST_TIER = TIERS.length;
const COMPLETE = 'Complete';

const E = ACHIEVEMENTS_LAYOUT_ELEMENTS;

const TIER_TITLES = COUNTERS.map(def =>
  Array.from({ length: LAST_TIER + 1 }, (_, t) => tier_title(def, t)),
);

const COLLECTION_COUNTS = COLLECTIONS.map(def => number_text(n => `${n} / ${def.size}`));

const COUNTER_COUNTS = COUNTERS.map(() =>
  number_text(n => {
    const tier = tier_of(n);

    return tier === LAST_TIER ? `${COMPLETE} (${n})` : `${n} / ${TIERS[tier]}`;
  }),
);

const tier_progress = (n: number) => {
  const tier = tier_of(n);

  if (tier === LAST_TIER) {
    return 1;
  }

  const from = tier === 0 ? 0 : TIERS[tier - 1]!;

  return (n - from) / (TIERS[tier]! - from);
};

const fill_diamond = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fill();
};

const render_chips = (
  ctx: CanvasRenderingContext2D,
  game: BIRD.GameState,
  k: number,
  x: number,
  y: number,
  inner_w: number,
  font: PixelFont,
  s: number,
) => {
  const counter = is_counter_card(k);
  const tier = counter ? tier_of(game.achievements.counters[k]!) : 0;
  const index = k - COUNTERS.length;
  const h = C.chip_height * s;
  const lead = chip_lead(k, s);
  let cx = 0;
  let cy = y;

  for (let i = 0; i < value_count(k); i++) {
    const w = chip_width(game, k, i, font, s);

    if (cx > 0 && cx + w > inner_w) {
      cx = 0;
      cy += h + C.chip_gap * s;
    }

    const got = counter ? i < tier : game.achievements.got[index]![i] === 1;
    const left = x + cx;

    fill_round_rect(ctx, left, cy, w, h, h / 2, got ? CHIP : MISSING);

    if (counter) {
      fill_diamond(
        ctx,
        left + (C.chip_pad_x + DIAMOND / 2) * s,
        cy + h / 2,
        (DIAMOND / 2) * s,
        got ? ACCENT : TEXT_DIM,
      );
    }

    draw_text(
      ctx,
      chip_label(game, k, i),
      left + lead,
      cy + h / 2,
      font,
      got ? TEXT : TEXT_DIM,
      'start',
      'middle',
    );
    cx += w + C.chip_gap * s;
  }
};

const render_cells = (
  ctx: CanvasRenderingContext2D,
  game: BIRD.GameState,
  k: number,
  x: number,
  y: number,
  inner_w: number,
  s: number,
) => {
  const def = collection_of(k);
  const got = game.achievements.got[k - COUNTERS.length]!;
  const per_row = cells_per_row(inner_w, s);
  const pitch = (C.cell + C.cell_gap) * s;
  const size = C.cell * s;
  const hues = def.kind === 'hues';

  for (let i = 0; i < def.size; i++) {
    const has = got[i] === 1;
    const color = hues ? (has ? HUE_COLORS[i]! : HUE_COLORS_MISSING[i]!) : has ? ACCENT : MISSING;

    fill_rect(
      ctx,
      x + (i % per_row) * pitch,
      y + Math.floor(i / per_row) * pitch,
      size,
      size,
      color,
    );
  }
};

const render_card = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  k: number,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const ctx = engine.ctx;
  const { pixel_ratio: s, dpr } = engine.canvas;
  const pad = C.card_pad * s;
  const inner_w = w - pad * 2;
  const title_font = pixel_font(C.title_font_size, s, dpr, 700);
  const count_font = pixel_font(C.count_font_size, s, dpr, 600);
  const title_y = y + pad + (C.title_height / 2) * s;
  const counter = is_counter_card(k);
  let title: string;
  let count: string;
  let progress: number;
  let done: boolean;

  if (counter) {
    const n = game.achievements.counters[k]!;
    const tier = tier_of(n);

    title = TIER_TITLES[k]![tier]!;
    count = COUNTER_COUNTS[k]!(n);
    progress = tier_progress(n);
    done = tier === LAST_TIER;
  } else {
    const index = k - COUNTERS.length;
    const n = game.achievements.counts[index]!;
    const def = COLLECTIONS[index]!;

    title = def.title;
    done = n === def.size;
    count = done ? COMPLETE : COLLECTION_COUNTS[index]!(n);
    progress = n / def.size;
  }

  fill_stroke_round_rect(ctx, x, y, w, h, C.card_radius * s, CARD, CARD_BORDER, s);
  draw_text(ctx, title, x + pad, title_y, title_font, done ? ACCENT : TEXT, 'start', 'middle');
  draw_volatile_text(
    ctx,
    count,
    x + w - pad,
    title_y,
    count_font,
    done ? ACCENT : TEXT_MUTED,
    'end',
    'middle',
  );

  const bar_y = y + pad + (C.title_height + C.bar_gap) * s;
  const bar_h = C.bar_height * s;

  progress_bar(ctx, x + pad, bar_y, inner_w, bar_h, bar_h / 2, progress, MISSING, ACCENT, bar_h);

  const top = y + values_top(s);

  if (has_chips(k)) {
    render_chips(ctx, game, k, x + pad, top, inner_w, chip_font(engine), s);
  } else {
    render_cells(ctx, game, k, x + pad, top, inner_w, s);
  }
};

const render_cards = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.AchievementsScene,
  cards: Rect,
  view: Rect,
) => {
  const s = engine.canvas.pixel_ratio;
  const w = card_width(engine);
  const x = Math.round(cards.x + (cards.w - w) / 2);
  const gap = C.card_gap * s;

  for (let k = 0; k < CARD_COUNT; k++) {
    const y = cards.y + scene.card_top[k]!;
    const h = scene.card_top[k + 1]! - scene.card_top[k]! - (k + 1 < CARD_COUNT ? gap : 0);

    if (y + h >= view.y && y <= view.y + view.h) {
      render_card(engine, game, k, x, y, w, h);
    }
  }
};

export const render_achievements_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.AchievementsScene,
) => {
  const ctx = engine.ctx;
  const layout = update_layout(ACHIEVEMENTS_LAYOUT, engine, game);
  const view = layout.rects[E.scroll]!;
  const cards = layout.rects[E.cards]!;

  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, BACKGROUND);
  draw_node_text(ctx, layout, E.title, TEXT, 0);
  draw_node_text(ctx, layout, E.done, TEXT_MUTED, 0);
  with_clip(ctx, view.x, view.y, view.w, view.h, () =>
    render_cards(engine, game, scene, cards, view),
  );
  render_scrollbar(ctx, layout, E.scroll);
};
