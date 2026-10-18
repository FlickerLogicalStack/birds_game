import type { MouseInputs } from '../../../engine/inputs';
import { __opt_remember_shape } from '../../../engine/shape';
import { clamp } from '../../utils/math';
import { CONFIG } from '../../../config';

export const MIN_ZOOM = CONFIG.camera.min_zoom;
export const MAX_ZOOM = CONFIG.camera.max_zoom;
export const WHEEL_ZOOM_SPEED = CONFIG.camera.wheel_zoom_speed;

export type Camera = {
  x: number;
  y: number;
  zoom: number;
};

export const create_camera = (): Camera => ({ x: 0, y: 0, zoom: 1 });

export const to_screen_x = (camera: Camera, world_x: number) => (world_x - camera.x) * camera.zoom;

export const to_screen_y = (camera: Camera, world_y: number) => (world_y - camera.y) * camera.zoom;

export const snap_px = (v: number, dpr: number) => Math.round(v * dpr) / dpr;

export const to_world_x = (camera: Camera, screen_x: number) => screen_x / camera.zoom + camera.x;

export const to_world_y = (camera: Camera, screen_y: number) => screen_y / camera.zoom + camera.y;

export const pan_camera = (camera: Camera, screen_dx: number, screen_dy: number) => {
  camera.x -= screen_dx / camera.zoom;
  camera.y -= screen_dy / camera.zoom;
};

export type Rect = { x: number; y: number; w: number; h: number };

__opt_remember_shape<Rect>({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });

export const in_rect = (rect: Rect, x: number, y: number) =>
  x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h;

export const is_hovered = (mouse: MouseInputs, rect: Rect) =>
  mouse.is_over && in_rect(rect, mouse.x, mouse.y);

export const is_clicked = (mouse: MouseInputs, rect: Rect) =>
  mouse.click && in_rect(rect, mouse.x, mouse.y);

const fit_zoom = (rect: Rect, canvas_width: number, canvas_height: number) =>
  Math.min(canvas_width / rect.w, canvas_height / rect.h);

export const fit_camera = (
  camera: Camera,
  rect: Rect,
  canvas_width: number,
  canvas_height: number,
) => {
  camera.zoom = clamp(fit_zoom(rect, canvas_width, canvas_height), MIN_ZOOM, MAX_ZOOM);
  camera.x = rect.x + rect.w / 2 - canvas_width / 2 / camera.zoom;
  camera.y = rect.y + rect.h / 2 - canvas_height / 2 / camera.zoom;
};

const clamp_axis = (position: number, view: number, start: number, size: number) =>
  view >= size ? start + (size - view) / 2 : clamp(position, start, start + size - view);

export const clamp_camera_position = (
  camera: Camera,
  rect: Rect,
  canvas_width: number,
  canvas_height: number,
) => {
  camera.x = clamp_axis(camera.x, canvas_width / camera.zoom, rect.x, rect.w);
  camera.y = clamp_axis(camera.y, canvas_height / camera.zoom, rect.y, rect.h);
};

export const clamp_camera = (
  camera: Camera,
  rect: Rect,
  canvas_width: number,
  canvas_height: number,
) => {
  camera.zoom = clamp(
    Math.max(fit_zoom(rect, canvas_width, canvas_height), camera.zoom),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  clamp_camera_position(camera, rect, canvas_width, canvas_height);
};

export const zoom_camera_at = (
  camera: Camera,
  screen_x: number,
  screen_y: number,
  zoom: number,
) => {
  const world_x = to_world_x(camera, screen_x);
  const world_y = to_world_y(camera, screen_y);

  camera.zoom = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
  camera.x = world_x - screen_x / camera.zoom;
  camera.y = world_y - screen_y / camera.zoom;
};
