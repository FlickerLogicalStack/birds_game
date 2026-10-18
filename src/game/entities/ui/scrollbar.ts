import { clamp01 } from '../../utils/math';
import { fill_round_rect } from '../../utils/draw';
import type { Layout } from '../../utils/layout';
import { CONFIG } from '../../../config';

const WIDTH = CONFIG.scrollbar.width;
const OFFSET = CONFIG.scrollbar.offset;
const MIN_HEIGHT = CONFIG.scrollbar.min_height;
const SHOW_MS = CONFIG.scrollbar.show_ms;
const FADE_MS = CONFIG.scrollbar.fade_ms;
const COLOR = CONFIG.theme.scrollbar;

export const render_scrollbar = (ctx: CanvasRenderingContext2D, layout: Layout, id: number) => {
  const max = layout.scroll_max[id]!;
  const alpha = clamp01(1 - (layout.scroll_idle[id]! - SHOW_MS) / FADE_MS);

  if (layout.visible[id] === 0 || max <= 0 || alpha <= 0) {
    return;
  }

  const s = layout.pixel_ratio;
  const rect = layout.rects[id]!;
  const w = Math.max(1, Math.round(WIDTH * s));
  const h = Math.max(MIN_HEIGHT * s, (rect.h * rect.h) / (rect.h + max));
  const y = rect.y + ((rect.h - h) * layout.scroll_y[id]!) / max;

  ctx.globalAlpha = alpha;
  fill_round_rect(
    ctx,
    Math.round(rect.x + rect.w + OFFSET * s - w),
    Math.round(y),
    w,
    h,
    w / 2,
    COLOR,
  );
  ctx.globalAlpha = 1;
};
