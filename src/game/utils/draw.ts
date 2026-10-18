import { draw_text, measure_text, type PixelFont } from './pixel_font';
import type { Ctx2D } from '../../engine/canvas';
import { TAU } from './math';

type Ctx = Ctx2D;

export const with_smoothing = <T>(ctx: Ctx, enabled: boolean, draw: () => T): T => {
  const prev = ctx.imageSmoothingEnabled;

  ctx.imageSmoothingEnabled = enabled;

  const result = draw();

  ctx.imageSmoothingEnabled = prev;

  return result;
};

export const with_clip = <T>(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  draw: () => T,
): T => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  const result = draw();

  ctx.restore();

  return result;
};

export const fill_rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

export const fill_round_rect = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: string,
) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
};

export const fill_stroke_round_rect = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: string,
  stroke: string,
  line_width: number,
) => {
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = line_width;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
};

export const fill_circle = (ctx: Ctx, cx: number, cy: number, radius: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
};

export const stroke_polyline3 = (
  ctx: Ctx,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  line_width: number,
) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = line_width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
};

export const progress_bar = (
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  value: number,
  track: string,
  fill: string,
  min_w: number,
) => {
  ctx.fillStyle = track;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();

  if (value > 0) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(min_w, Math.round(w * value)), h, radius);
    ctx.fill();
  }
};

export const tip_width = (label: string, font: PixelFont, pad_x: number) =>
  Math.ceil(measure_text(label, font) + pad_x * 2);

export const fill_tip = (
  ctx: Ctx,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  s: number,
  font: PixelFont,
  background: string,
  color: string,
) => {
  fill_round_rect(ctx, x, y, w, h, 6 * s, background);
  draw_text(ctx, label, x + w / 2, y + h / 2, font, color, 'center', 'middle');
};
