import {
  CARD_COUNT,
  COLLECTIONS,
  COUNTERS,
  TIER_LABELS,
  type CollectionDef,
} from '../../entities/achievements/achievements';
import { measure_text, pixel_font, type PixelFont } from '../../utils/pixel_font';
import { CONFIG } from '../../../config';

const C = CONFIG.achievements;
export const UNKNOWN_LABEL = '???';
export const DIAMOND = 7;

export const is_counter_card = (k: number) => k < COUNTERS.length;

export const collection_of = (k: number): CollectionDef => COLLECTIONS[k - COUNTERS.length]!;

export const chip_font = (engine: BIRD.EngineContext) =>
  pixel_font(C.chip_font_size, engine.canvas.pixel_ratio, engine.canvas.dpr, 600);

export const card_width = (engine: BIRD.EngineContext) => {
  const { width, pixel_ratio: s, safe } = engine.canvas;

  return Math.min(width - safe.left - safe.right - C.card_gap * 2 * s, C.max_width * s);
};

export const cells_per_row = (inner_w: number, s: number) =>
  Math.max(1, Math.floor((inner_w + C.cell_gap * s) / ((C.cell + C.cell_gap) * s)));

export const chip_label = (game: BIRD.GameState, k: number, i: number) => {
  if (is_counter_card(k)) {
    return TIER_LABELS[i]!;
  }

  const index = k - COUNTERS.length;

  return game.achievements.got[index]![i] === 1 ? COLLECTIONS[index]!.labels[i]! : UNKNOWN_LABEL;
};

export const chip_lead = (k: number, s: number) =>
  (is_counter_card(k) ? DIAMOND + C.chip_pad_x / 2 : 0) * s + C.chip_pad_x * s;

export const chip_width = (
  game: BIRD.GameState,
  k: number,
  i: number,
  font: PixelFont,
  s: number,
) => Math.ceil(chip_lead(k, s) + measure_text(chip_label(game, k, i), font) + C.chip_pad_x * s);

export const value_count = (k: number) =>
  is_counter_card(k) ? TIER_LABELS.length : collection_of(k).size;

export const has_chips = (k: number) => is_counter_card(k) || collection_of(k).kind === 'chips';

const values_height = (
  game: BIRD.GameState,
  k: number,
  inner_w: number,
  font: PixelFont,
  s: number,
) => {
  const n = value_count(k);

  if (!has_chips(k)) {
    const rows = Math.ceil(n / cells_per_row(inner_w, s));

    return rows * (C.cell + C.cell_gap) * s - C.cell_gap * s;
  }

  let x = 0;
  let rows = 1;

  for (let i = 0; i < n; i++) {
    const w = chip_width(game, k, i, font, s);

    if (x > 0 && x + w > inner_w) {
      rows++;
      x = 0;
    }

    x += w + C.chip_gap * s;
  }

  return rows * (C.chip_height + C.chip_gap) * s - C.chip_gap * s;
};

export const values_top = (s: number) =>
  (C.card_pad + C.title_height + C.bar_gap + C.bar_height + C.values_gap) * s;

export const fit_cards = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.AchievementsScene,
) => {
  const s = engine.canvas.pixel_ratio;
  const inner_w = card_width(engine) - C.card_pad * 2 * s;
  const font = chip_font(engine);
  let y = 0;

  for (let k = 0; k < CARD_COUNT; k++) {
    scene.card_top[k] = y;
    y += values_top(s) + values_height(game, k, inner_w, font, s) + (C.card_pad + C.card_gap) * s;
  }

  scene.card_top[CARD_COUNT] = y - C.card_gap * s;
  scene.content_height = scene.card_top[CARD_COUNT]! / s;
};
