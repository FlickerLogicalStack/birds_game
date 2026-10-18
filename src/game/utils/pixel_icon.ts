import { create_canvas, type Ctx2D, type SpriteCanvas } from '../../engine/canvas';
import type { Rect } from '../entities/camera/camera';

export type PixelIcon = {
  rows: readonly string[];
  palette: Readonly<Record<string, string>>;
  scale: number;
};

const icon_canvases = new Map<PixelIcon, SpriteCanvas>();

export const icon_canvas = (icon: PixelIcon): SpriteCanvas => {
  let canvas = icon_canvases.get(icon);

  if (canvas === undefined) {
    const w = icon.rows[0]!.length;
    const created = create_canvas(w, icon.rows.length);

    canvas = created.canvas;
    icon.rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = icon.palette[row[x]!];

        if (color !== undefined) {
          created.ctx.fillStyle = color;
          created.ctx.fillRect(x, y, 1, 1);
        }
      }
    });
    icon_canvases.set(icon, canvas);
  }

  return canvas;
};

const draw_icon = (ctx: Ctx2D, icon: PixelIcon, x: number, y: number, s: number) => {
  const canvas = icon_canvas(icon);
  const px = icon.scale * s;

  ctx.drawImage(canvas, x, y, Math.round(canvas.width * px), Math.round(canvas.height * px));
};

export const draw_icon_centered = (ctx: Ctx2D, icon: PixelIcon, r: Rect, s: number) => {
  const canvas = icon_canvas(icon);
  const px = icon.scale * s;

  draw_icon(
    ctx,
    icon,
    r.x + Math.floor((r.w - canvas.width * px) / 2),
    r.y + Math.floor((r.h - canvas.height * px) / 2),
    s,
  );
};
