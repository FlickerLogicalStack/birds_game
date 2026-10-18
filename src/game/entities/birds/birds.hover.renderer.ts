import { to_screen_x, to_screen_y, type Camera } from '../camera/camera';
import { scene_reveal } from '../misc/reveal';
import { SPRITE_FEET_Y, SPRITE_SIZE } from './bird.generator';
import type { BirdHover } from './birds.hover';
import { fill_rect } from '../../utils/draw';
import { draw_text, measure_text, pixel_font } from '../../utils/pixel_font';
import { CONFIG } from '../../../config';

const FRAME_PADDING = CONFIG.hover.frame_padding;
const CORNER = CONFIG.hover.corner;
const FRAME_COLOR = CONFIG.theme.hover.frame;
const FRAME_SHADOW = CONFIG.theme.hover.frame_shadow;

const NAME_FONT_SIZE = CONFIG.hover.name_font_size;
const NAME_COLOR = CONFIG.theme.hover.name;
const NAME_PLATE = CONFIG.theme.hover.name_plate;
const NAME_PAD_X = CONFIG.hover.name_pad_x;
const NAME_PAD_Y = CONFIG.hover.name_pad_y;
const NAME_HEIGHT = CONFIG.hover.name_height;
const NAME_GAP = CONFIG.hover.name_gap;

export const render_hover_frame = (
  engine: BIRD.EngineContext,
  left: number,
  top: number,
  right: number,
  bottom: number,
) => {
  const ctx = engine.ctx;
  const corner = Math.min(CORNER, (right - left) / 3, (bottom - top) / 3);

  ctx.beginPath();
  ctx.moveTo(left, top + corner);
  ctx.lineTo(left, top);
  ctx.lineTo(left + corner, top);
  ctx.moveTo(right - corner, top);
  ctx.lineTo(right, top);
  ctx.lineTo(right, top + corner);
  ctx.moveTo(right, bottom - corner);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right - corner, bottom);
  ctx.moveTo(left + corner, bottom);
  ctx.lineTo(left, bottom);
  ctx.lineTo(left, bottom - corner);
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.strokeStyle = FRAME_SHADOW;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.strokeStyle = FRAME_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.lineCap = 'butt';
};

export const render_bird_hover = (engine: BIRD.EngineContext, hover: BirdHover, camera: Camera) => {
  const hit = hover.hit;
  const alpha = scene_reveal(engine);

  if (hit === null || alpha === 0) {
    return;
  }

  const { bird, bounds } = hit;
  const left_px = bird.behaviour.facing_left ? SPRITE_SIZE - 1 - bounds.right : bounds.left;
  const right_px = bird.behaviour.facing_left ? SPRITE_SIZE - 1 - bounds.left : bounds.right;
  const sprite_x = bird.x - SPRITE_SIZE / 2;
  const sprite_y = bird.y - SPRITE_FEET_Y;
  const left = Math.round(to_screen_x(camera, sprite_x + left_px)) - FRAME_PADDING;
  const right = Math.round(to_screen_x(camera, sprite_x + right_px + 1)) + FRAME_PADDING;
  const top = Math.round(to_screen_y(camera, sprite_y + bounds.top)) - FRAME_PADDING;
  const bottom = Math.round(to_screen_y(camera, sprite_y + bounds.bottom + 1)) + FRAME_PADDING;
  const { width, height } = engine.canvas;

  if (right < 0 || bottom < 0 || left > width || top > height) {
    return;
  }

  const ctx = engine.ctx;

  ctx.globalAlpha = alpha;
  render_hover_frame(engine, left, top, right, bottom);

  const font = pixel_font(NAME_FONT_SIZE, 1, engine.canvas.dpr, 600);
  const plate_w = Math.ceil(measure_text(bird.name, font)) + NAME_PAD_X * 2;
  const plate_h = NAME_HEIGHT + NAME_PAD_Y * 2;
  const plate_x = Math.round((left + right) / 2 - plate_w / 2);
  const plate_y = Math.max(0, top - NAME_GAP - plate_h);

  fill_rect(ctx, plate_x, plate_y, plate_w, plate_h, NAME_PLATE);
  draw_text(
    ctx,
    bird.name,
    plate_x + plate_w / 2,
    plate_y + plate_h / 2,
    font,
    NAME_COLOR,
    'center',
    'middle',
  );
  ctx.globalAlpha = 1;
};
