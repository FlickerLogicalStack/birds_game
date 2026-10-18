import { feature } from 'bun:bundle';
import { GLYPH_ASCENT, GLYPH_DESCENT, GLYPHS } from './pixel_font.glyphs';
import { create_canvas, type Ctx2D, type SpriteCanvas } from '../../engine/canvas';
import { __opt_prepare_mutations, __opt_remember_shape } from '../../engine/shape';
import { CONFIG } from '../../config';

type Ctx = Ctx2D;

const BASE_SIZE = CONFIG.theme.pixel_font.base_size;
const BOLD_WEIGHT = CONFIG.theme.pixel_font.bold_weight;
const CACHE_W = CONFIG.theme.pixel_font.cache_width;
const CACHE_H = CONFIG.theme.pixel_font.cache_height;
const CACHE_MAX_STRINGS = CONFIG.theme.pixel_font.cache_max_strings;
const VOLATILE_MAX_STRINGS = CONFIG.theme.pixel_font.volatile_cache_max_strings;

const CELL_H = GLYPH_ASCENT + GLYPH_DESCENT;
const FALLBACK = '?';
const CODES = 128;
const CACHE_MIN_USES = 2;
const MAX_DPRS = 16;
const MAX_COLORS = 256;

export type PixelFont = number & { readonly __pixel_font: true };

export type TextAlign = 'start' | 'center' | 'end';
export type TextBaseline = 'top' | 'middle' | 'alphabetic';

const ADVANCE = new Uint8Array(CODES);
const GLYPH_X = new Int8Array(CODES);
const GLYPH_W = new Uint8Array(CODES);
const ATLAS_X = new Uint16Array(CODES);
const HAS_GLYPH = new Uint8Array(CODES);

const ATLAS = (() => {
  const chars = Object.keys(GLYPHS);
  let width = 0;

  for (const char of chars) {
    const glyph = GLYPHS[char]!;
    const code = char.charCodeAt(0);

    ADVANCE[code] = glyph.advance;
    GLYPH_X[code] = glyph.x;
    GLYPH_W[code] = glyph.rows.length === 0 ? 0 : glyph.rows[0]!.length;
    ATLAS_X[code] = width;
    HAS_GLYPH[code] = 1;
    width += GLYPH_W[code]! + 1;
  }

  const { canvas, ctx } = create_canvas(width, CELL_H);

  ctx.fillStyle = '#ffffff';

  for (const char of chars) {
    const code = char.charCodeAt(0);

    GLYPHS[char]!.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === '#') {
          ctx.fillRect(ATLAS_X[code]! + x, y, 1, 1);
        }
      }
    });
  }

  const fallback = FALLBACK.charCodeAt(0);

  for (let code = 0; code < CODES; code++) {
    if (HAS_GLYPH[code] === 0) {
      ADVANCE[code] = ADVANCE[fallback]!;
      GLYPH_X[code] = GLYPH_X[fallback]!;
      GLYPH_W[code] = GLYPH_W[fallback]!;
      ATLAS_X[code] = ATLAS_X[fallback]!;
    }
  }

  return canvas;
})();

const CAP_H = GLYPH_ASCENT - GLYPHS['H']!.rows.findIndex(row => row.includes('#'));

const COLORS = new Map<string, number>();
const tinted: SpriteCanvas[] = [];

const color_index = (color: string) => {
  let index = COLORS.get(color);

  if (index === undefined) {
    if (COLORS.size === MAX_COLORS) {
      if (feature('DEV')) {
        console.warn(`Pixel font: more than ${MAX_COLORS} text colors, color table reset`);
      }

      COLORS.clear();
      tinted.length = 0;
      reset_text_cache(STABLE);
      reset_text_cache(VOLATILE);
    }

    const created = create_canvas(ATLAS.width, ATLAS.height);

    created.ctx.drawImage(ATLAS, 0, 0);
    created.ctx.globalCompositeOperation = 'source-in';
    created.ctx.fillStyle = color;
    created.ctx.fillRect(0, 0, ATLAS.width, ATLAS.height);
    index = tinted.length;
    tinted.push(created.canvas);
    COLORS.set(color, index);
  }

  return index;
};

const warned = new Set<number>();

const code_at = (value: string, i: number) => {
  const code = value.charCodeAt(i);

  if (code < CODES && HAS_GLYPH[code] === 1) {
    return code;
  }

  if (feature('DEV')) {
    if (!warned.has(code)) {
      warned.add(code);
      console.warn(
        `Pixel font: no glyph for ${JSON.stringify(value[i])} in ${JSON.stringify(value)}`,
      );
    }
  }

  return code < CODES ? code : FALLBACK.charCodeAt(0);
};

const DPRS = new Float64Array(MAX_DPRS);
let dpr_count = 0;

const dpr_index = (dpr: number) => {
  for (let i = 0; i < dpr_count; i++) {
    if (DPRS[i] === dpr) {
      return i;
    }
  }

  if (dpr_count === MAX_DPRS) {
    if (feature('DEV')) {
      console.warn(`Pixel font: more than ${MAX_DPRS} device pixel ratios, ratio table reset`);
    }

    dpr_count = 0;
  }

  DPRS[dpr_count] = dpr;

  return dpr_count++;
};

const font_px = (font: PixelFont) => font >> 5;
const font_bold = (font: PixelFont) => (font >> 4) & 1;
const font_dpr = (font: PixelFont) => DPRS[font & 15]!;

const with_px = (font: PixelFont, px: number) =>
  ((px << 5) | (font_bold(font) === 1 && px >= 2 ? 16 : 0) | (font & 15)) as PixelFont;

export const pixel_font = (size: number, s: number, dpr: number, weight: number) => {
  const px = Math.max(1, Math.round((size * s * dpr) / BASE_SIZE));
  const bold = weight >= BOLD_WEIGHT && px >= 2 ? 16 : 0;

  return ((px << 5) | bold | dpr_index(dpr)) as PixelFont;
};

const measure_device = (value: string, font: PixelFont) => {
  let advance = 0;

  for (let i = 0; i < value.length; i++) {
    advance += ADVANCE[code_at(value, i)]!;
  }

  return advance * font_px(font) + font_bold(font) * value.length;
};

export const measure_text = (value: string, font: PixelFont) =>
  measure_device(value, font) / font_dpr(font);

const baseline_offset = (font: PixelFont, baseline: TextBaseline) =>
  baseline === 'top'
    ? GLYPH_ASCENT * font_px(font)
    : baseline === 'middle'
      ? Math.round((CAP_H * font_px(font)) / 2)
      : 0;

const align_offset = (w: number, align: TextAlign) =>
  align === 'center' ? Math.round(w / 2) : align === 'end' ? w : 0;

const draw_glyphs = (
  ctx: Ctx2D,
  atlas: SpriteCanvas,
  value: string,
  pen: number,
  top: number,
  px: number,
  bold: number,
  dpr: number,
  step_x: number,
) => {
  const h = (CELL_H * px) / dpr;

  for (let i = 0; i < value.length; i++) {
    const code = code_at(value, i);
    const w = GLYPH_W[code]!;

    if (w > 0) {
      const x = Math.round(pen + GLYPH_X[code]! * step_x);
      const dw = Math.round(w * step_x) / dpr;

      ctx.drawImage(atlas, ATLAS_X[code]!, 0, w, CELL_H, x / dpr, top, dw, h);

      if (bold === 1) {
        ctx.drawImage(atlas, ATLAS_X[code]!, 0, w, CELL_H, (x + 1) / dpr, top, dw, h);
      }
    }

    pen += ADVANCE[code]! * step_x + bold;
  }
};

type CachedText = { x: number; y: number; w: number; h: number; left: number; uses: number };

const NOT_BAKED = -1;
const NO_ROOM = -2;

const cached_text_of = (
  x: number,
  y: number,
  w: number,
  h: number,
  left: number,
  uses: number,
): CachedText => ({ x, y, w, h, left, uses });

__opt_prepare_mutations(__opt_remember_shape(cached_text_of(NOT_BAKED, 0, 0, 0, 0, 0)), [
  'x',
  'y',
  'w',
  'h',
  'left',
  'uses',
]);

type TextCache = {
  down: boolean;
  edge: number;
  max_strings: number;
  texts: Map<number, Map<string, CachedText>>;
  shelf_x: number[];
  shelf_y: number[];
  shelf_h: number[];
  stats: { strings: number; baked: number; resets: number };
};

const text_cache_of = (down: boolean, max_strings: number): TextCache => ({
  down,
  edge: down ? 0 : CACHE_H,
  max_strings,
  texts: new Map(),
  shelf_x: [],
  shelf_y: [],
  shelf_h: [],
  stats: { strings: 0, baked: 0, resets: 0 },
});

__opt_prepare_mutations(__opt_remember_shape(text_cache_of(true, 0)), ['edge']);

const CACHE = create_canvas(CACHE_W, CACHE_H);
const STABLE = text_cache_of(true, CACHE_MAX_STRINGS);
const VOLATILE = text_cache_of(false, VOLATILE_MAX_STRINGS);

CACHE.ctx.imageSmoothingEnabled = false;

export const text_cache_stats = { stable: STABLE.stats, volatile: VOLATILE.stats };

const text_key = (font: PixelFont, color: number) => ((font >> 4) << 8) | color;

const reset_text_cache = (part: TextCache) => {
  if (part.down) {
    CACHE.ctx.clearRect(0, 0, CACHE_W, part.edge);
  } else {
    CACHE.ctx.clearRect(0, part.edge, CACHE_W, CACHE_H - part.edge);
  }

  part.edge = part.down ? 0 : CACHE_H;
  part.texts.clear();
  part.shelf_x.length = 0;
  part.shelf_y.length = 0;
  part.shelf_h.length = 0;
  part.stats.strings = 0;
  part.stats.baked = 0;
  part.stats.resets += 1;
};

const shelf_for = (part: TextCache, w: number, h: number) => {
  for (let i = 0; i < part.shelf_h.length; i++) {
    if (part.shelf_h[i] === h && part.shelf_x[i]! + w <= CACHE_W) {
      return i;
    }
  }

  if (VOLATILE.edge - STABLE.edge < h) {
    return -1;
  }

  const y = part.down ? part.edge : part.edge - h;

  part.edge = part.down ? y + h + 1 : y - 1;
  part.shelf_x.push(0);
  part.shelf_y.push(y);
  part.shelf_h.push(h);

  return part.shelf_h.length - 1;
};

const bake = (
  part: TextCache,
  entry: CachedText,
  value: string,
  font: PixelFont,
  color: number,
) => {
  const px = font_px(font);
  const bold = font_bold(font);
  let min_x = Number.MAX_SAFE_INTEGER;
  let max_x = Number.MIN_SAFE_INTEGER;
  let pen = 0;

  for (let i = 0; i < value.length; i++) {
    const code = code_at(value, i);
    const w = GLYPH_W[code]!;

    if (w > 0) {
      const x = pen + GLYPH_X[code]! * px;

      min_x = Math.min(min_x, x);
      max_x = Math.max(max_x, x + w * px + bold);
    }

    pen += ADVANCE[code]! * px + bold;
  }

  const w = Math.max(0, max_x - min_x);
  const h = CELL_H * px;

  if (w > CACHE_W || h > CACHE_H) {
    entry.x = NO_ROOM;
    return true;
  }

  if (w === 0) {
    entry.x = 0;
    entry.w = 0;
    return true;
  }

  let shelf = shelf_for(part, w, h);

  if (shelf === -1 && part === STABLE && VOLATILE.shelf_h.length > 0) {
    reset_text_cache(VOLATILE);
    shelf = shelf_for(part, w, h);
  }

  if (shelf === -1) {
    if (part.shelf_h.length === 0) {
      entry.x = NO_ROOM;
      return true;
    }

    reset_text_cache(part);
    return false;
  }

  entry.x = part.shelf_x[shelf]!;
  entry.y = part.shelf_y[shelf]!;
  entry.w = w;
  entry.h = h;
  entry.left = min_x;
  part.shelf_x[shelf]! += w + 1;
  part.stats.baked += 1;

  draw_glyphs(CACHE.ctx, tinted[color]!, value, entry.x - min_x, entry.y, px, bold, 1, px);

  return true;
};

const cached_text = (
  part: TextCache,
  value: string,
  font: PixelFont,
  color: number,
  now: boolean,
) => {
  const key = text_key(font, color);
  let entry = part.texts.get(key)?.get(value);

  if (entry === undefined) {
    if (part.stats.strings >= part.max_strings) {
      reset_text_cache(part);
    }

    let texts = part.texts.get(key);

    if (texts === undefined) {
      texts = new Map();
      part.texts.set(key, texts);
    }

    entry = cached_text_of(NOT_BAKED, 0, 0, 0, 0, 0);
    texts.set(value, entry);
    part.stats.strings += 1;
  }

  if (entry.x === NOT_BAKED) {
    entry.uses += 1;

    if ((entry.uses < CACHE_MIN_USES && !now) || !bake(part, entry, value, font, color)) {
      return null;
    }
  }

  return entry.x === NO_ROOM ? null : entry;
};

const draw_run = (
  ctx: Ctx,
  value: string,
  left: number,
  base: number,
  font: PixelFont,
  color: string,
  squeeze: number,
  part: TextCache,
) => {
  const px = font_px(font);
  const dpr = font_dpr(font);
  const top = (base - GLYPH_ASCENT * px) / dpr;
  const smoothing = ctx.imageSmoothingEnabled;
  const index = color_index(color);
  const bold = font_bold(font);
  const now = bold === 1 && ctx.globalAlpha < 1;
  const entry = squeeze === 1 ? cached_text(part, value, font, index, now) : null;

  ctx.imageSmoothingEnabled = false;

  if (entry === null) {
    draw_glyphs(ctx, tinted[index]!, value, left, top, px, bold, dpr, px * squeeze);
  } else if (entry.w > 0) {
    const { x, y, w, h } = entry;

    ctx.drawImage(CACHE.canvas, x, y, w, h, (left + entry.left) / dpr, top, w / dpr, h / dpr);
  }

  ctx.imageSmoothingEnabled = smoothing;
};

const draw_aligned = (
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  font: PixelFont,
  color: string,
  align: TextAlign,
  baseline: TextBaseline,
  part: TextCache,
) => {
  const dpr = font_dpr(font);
  const offset = align === 'start' ? 0 : align_offset(measure_device(value, font), align);
  const left = Math.round(x * dpr) - offset;
  const base = Math.round(y * dpr) + baseline_offset(font, baseline);

  draw_run(ctx, value, left, base, font, color, 1, part);
};

export const draw_text = (
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  font: PixelFont,
  color: string,
  align: TextAlign,
  baseline: TextBaseline,
) => draw_aligned(ctx, value, x, y, font, color, align, baseline, STABLE);

export const draw_volatile_text = (
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  font: PixelFont,
  color: string,
  align: TextAlign,
  baseline: TextBaseline,
) => draw_aligned(ctx, value, x, y, font, color, align, baseline, VOLATILE);

export const draw_text_fit = (
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  font: PixelFont,
  color: string,
  align: TextAlign,
  baseline: TextBaseline,
  max_w: number,
) => {
  const dpr = font_dpr(font);
  const max = max_w * dpr;
  let fitted = font;
  let w = measure_device(value, fitted);

  while (font_px(fitted) > 1 && w > max) {
    fitted = with_px(fitted, font_px(fitted) - 1);
    w = measure_device(value, fitted);
  }

  const squeeze = w > max ? max / w : 1;
  const left = Math.round(x * dpr) - align_offset(Math.min(w, max), align);
  const base = Math.round(y * dpr) + baseline_offset(fitted, baseline);

  draw_run(ctx, value, left, base, fitted, color, squeeze, STABLE);
};
