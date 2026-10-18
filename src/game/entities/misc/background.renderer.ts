import { snap_px, to_screen_x, to_screen_y } from '../camera/camera';
import { canvas_from_pixels, type SpriteCanvas } from '../../../engine/canvas';
import { rgb_css } from '../../utils/color';
import { fill_rect, with_smoothing } from '../../utils/draw';
import { DEEP_SOIL, GROUND_RISE, GROUND_STRIP_H, render_ground_pixels } from './ground.sprite';
import { render_shore_pixels, SHORE_W, shore_x } from './shore.sprite';

const DEEP = rgb_css(DEEP_SOIL, 1);

type GroundCache = {
  x: number;
  land_w: number;
  pattern: CanvasPattern;
  matrix: DOMMatrix;
  shore: SpriteCanvas;
};

let ground: GroundCache | null = null;

const ground_cache = (ctx: BIRD.EngineContext['ctx'], x: number, land_w: number) => {
  if (ground === null || ground.x !== x || ground.land_w !== land_w) {
    const strip = canvas_from_pixels(render_ground_pixels(land_w), land_w, GROUND_STRIP_H);
    const pattern = ctx.createPattern(strip, 'repeat-x');

    if (pattern === null) {
      throw new Error('No pattern (createPattern)');
    }

    const shore = canvas_from_pixels(render_shore_pixels(land_w), SHORE_W, GROUND_STRIP_H);

    ground = { x, land_w, pattern, matrix: new DOMMatrix(), shore };
  }

  return ground;
};

export const render_background = (engine: BIRD.EngineContext, scene: BIRD.PrimaryScene) => {
  const ctx = engine.ctx;
  const { width, height, dpr } = engine.canvas;
  const camera = scene.camera;
  const strip_y = scene.tree.ground_y - GROUND_RISE;
  const top = snap_px(to_screen_y(camera, strip_y), dpr);
  const bottom = snap_px(to_screen_y(camera, strip_y + GROUND_STRIP_H), dpr);

  if (top >= height) {
    return;
  }

  if (bottom > 0) {
    const x = scene.bounds.x;
    const shore_at = shore_x(scene.tree);
    const { pattern, matrix, shore } = ground_cache(ctx, x, Math.ceil(shore_at - x));
    const strip_h = bottom - top;
    const shore_left = snap_px(to_screen_x(camera, shore_at), dpr);
    const shore_end = snap_px(to_screen_x(camera, shore_at + SHORE_W), dpr);

    with_smoothing(ctx, false, () => {
      if (shore_left > 0) {
        matrix.a = camera.zoom;
        matrix.d = strip_h / GROUND_STRIP_H;
        matrix.e = snap_px(to_screen_x(camera, x), dpr);
        matrix.f = top;
        pattern.setTransform(matrix);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, top, Math.min(width, shore_left), strip_h);
      }

      if (shore_left < width && shore_end > 0) {
        ctx.drawImage(shore, shore_left, top, shore_end - shore_left, strip_h);
      }

      if (shore_end < width) {
        const sx = SHORE_W - 1;

        ctx.drawImage(shore, sx, 0, 1, GROUND_STRIP_H, shore_end, top, width - shore_end, strip_h);
      }
    });
  }

  if (bottom < height) {
    const from = Math.max(0, bottom);

    fill_rect(ctx, 0, from, width, height - from, DEEP);
  }
};

export const render_sand_over = (
  engine: BIRD.EngineContext,
  scene: BIRD.PrimaryScene,
  x0: number,
  x1: number,
  gy0: number,
  gy1: number,
) => {
  if (ground === null) {
    return;
  }

  const camera = scene.camera;
  const dpr = engine.canvas.dpr;
  const strip_y = scene.tree.ground_y - GROUND_RISE;
  const top = snap_px(to_screen_y(camera, strip_y), dpr);
  const bottom = snap_px(to_screen_y(camera, strip_y + GROUND_STRIP_H), dpr);
  const shore_at = shore_x(scene.tree);
  const left = snap_px(to_screen_x(camera, shore_at), dpr);
  const right = snap_px(to_screen_x(camera, shore_at + SHORE_W), dpr);
  const kx = (right - left) / SHORE_W;
  const ky = (bottom - top) / GROUND_STRIP_H;
  const sx0 = Math.max(0, Math.floor(x0 - shore_at));
  const sx1 = Math.min(SHORE_W, Math.ceil(x1 - shore_at));
  const sy0 = Math.max(0, gy0 + GROUND_RISE);
  const sy1 = Math.min(GROUND_STRIP_H, gy1 + GROUND_RISE);

  if (sx1 <= sx0 || sy1 <= sy0) {
    return;
  }

  engine.ctx.drawImage(
    ground.shore,
    sx0,
    sy0,
    sx1 - sx0,
    sy1 - sy0,
    left + sx0 * kx,
    top + sy0 * ky,
    (sx1 - sx0) * kx,
    (sy1 - sy0) * ky,
  );
};
