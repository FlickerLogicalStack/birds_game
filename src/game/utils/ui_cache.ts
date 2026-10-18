import { feature } from 'bun:bundle';
import { create_canvas, type SpriteCanvas } from '../../engine/canvas';
import { __opt_prepare_mutations, __opt_remember_shape, FLOAT_ZERO } from '../../engine/shape';
import type { Rect } from '../entities/camera/camera';

const MARGIN = 1;

export type UiCache = {
  canvas: SpriteCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  x: number;
  y: number;
  w: number;
  h: number;
  dpr: number;
  keys: number[];
  count: number;
  dirty: boolean;
  left: number;
  top: number;
};

export const ui_cache_stats = { redraws: 0 };

const ui_cache_of = (canvas: SpriteCanvas, ctx: OffscreenCanvasRenderingContext2D): UiCache => ({
  canvas,
  ctx,
  x: FLOAT_ZERO,
  y: FLOAT_ZERO,
  w: FLOAT_ZERO,
  h: FLOAT_ZERO,
  dpr: FLOAT_ZERO,
  keys: [],
  count: 0,
  dirty: true,
  left: 0,
  top: 0,
});

{
  const { canvas, ctx } = create_canvas(1, 1);

  __opt_prepare_mutations(__opt_remember_shape(ui_cache_of(canvas, ctx)), [
    'x',
    'y',
    'w',
    'h',
    'dpr',
    'count',
    'dirty',
    'left',
    'top',
  ]);
}

export const create_ui_cache = (): UiCache => {
  const { canvas, ctx } = create_canvas(1, 1);

  return ui_cache_of(canvas, ctx);
};

export const ui_cache_begin = (cache: UiCache, engine: BIRD.EngineContext, rect: Rect) => {
  const dpr = engine.canvas.dpr;

  cache.count = 0;
  cache.dirty =
    cache.x !== rect.x ||
    cache.y !== rect.y ||
    cache.w !== rect.w ||
    cache.h !== rect.h ||
    cache.dpr !== dpr;

  if (cache.dirty) {
    cache.x = rect.x;
    cache.y = rect.y;
    cache.w = rect.w;
    cache.h = rect.h;
    cache.dpr = dpr;
  }
};

const warned = new WeakSet<UiCache>();

export const ui_cache_key = (cache: UiCache, value: number) => {
  const key = (value << 1) >> 1;
  const i = cache.count++;

  if (feature('DEV')) {
    if (key !== value && !warned.has(cache)) {
      warned.add(cache);
      console.warn(
        `UI cache: key #${i} = ${value} is not a 31-bit integer (cut to ${key}); ` +
          'quantize fractions, use small numbers',
      );
    }
  }

  if (i === cache.keys.length) {
    cache.keys.push(key);
    cache.dirty = true;
  } else if (cache.keys[i] !== key) {
    cache.keys[i] = key;
    cache.dirty = true;
  }
};

export const ui_cache_redraw = (cache: UiCache): OffscreenCanvasRenderingContext2D | null => {
  if (cache.count !== cache.keys.length) {
    cache.keys.length = cache.count;
    cache.dirty = true;
  }

  if (!cache.dirty) {
    return null;
  }

  cache.dirty = false;
  ui_cache_stats.redraws += 1;

  const { canvas, ctx, dpr } = cache;

  cache.left = Math.floor((cache.x - MARGIN) * dpr);
  cache.top = Math.floor((cache.y - MARGIN) * dpr);

  const width = Math.ceil((cache.x + cache.w + MARGIN) * dpr) - cache.left;
  const height = Math.ceil((cache.y + cache.h + MARGIN) * dpr) - cache.top;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  } else {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
  }

  ctx.globalAlpha = 1;
  ctx.setTransform(dpr, 0, 0, dpr, -cache.left, -cache.top);

  return ctx;
};

export const draw_ui_cache = (ctx: CanvasRenderingContext2D, cache: UiCache) => {
  const dpr = cache.dpr;

  if (dpr === 0) {
    return;
  }

  const smoothing = ctx.imageSmoothingEnabled;

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    cache.canvas,
    cache.left / dpr,
    cache.top / dpr,
    cache.canvas.width / dpr,
    cache.canvas.height / dpr,
  );
  ctx.imageSmoothingEnabled = smoothing;
};
