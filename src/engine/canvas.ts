export type SpriteCanvas = OffscreenCanvas;

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export const create_canvas = (
  width: number,
  height: number,
): { canvas: SpriteCanvas; ctx: OffscreenCanvasRenderingContext2D } => {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context (OffscreenCanvas.getContext(2d))');
  }

  return { canvas, ctx };
};

export const canvas_from_pixels = (
  pixels: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
): SpriteCanvas => {
  const { canvas, ctx } = create_canvas(width, height);

  ctx.putImageData(new ImageData(pixels, width, height), 0, 0);

  return canvas;
};
