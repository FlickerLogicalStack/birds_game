import { pan_camera, type Camera } from './camera';
import { CONFIG } from '../../../config';

const GLIDE_VELOCITY_MS = CONFIG.camera.glide_velocity_ms;
const GLIDE_FRICTION_MS = CONFIG.camera.glide_friction_ms;
const GLIDE_MIN_SPEED = CONFIG.camera.glide_min_speed;

export type CameraGlide = {
  vx: number;
  vy: number;
  dragging: boolean;
};

export const create_camera_glide = (): CameraGlide => ({ vx: 0, vy: 0, dragging: false });

export const stop_glide = (glide: CameraGlide) => {
  glide.vx = 0;
  glide.vy = 0;
};

export const track_glide = (
  glide: CameraGlide,
  dragging: boolean,
  pan_x: number,
  pan_y: number,
  dt: number,
) => {
  if (!glide.dragging) {
    stop_glide(glide);
  }

  if (dt > 0 && (dragging || pan_x !== 0 || pan_y !== 0)) {
    const k = 1 - Math.exp(-dt / GLIDE_VELOCITY_MS);

    glide.vx += (pan_x / dt - glide.vx) * k;
    glide.vy += (pan_y / dt - glide.vy) * k;
  }

  glide.dragging = dragging;
};

export const update_glide = (glide: CameraGlide, camera: Camera, dt: number) => {
  glide.dragging = false;

  if (glide.vx === 0 && glide.vy === 0) {
    return;
  }

  pan_camera(camera, glide.vx * dt, glide.vy * dt);

  const friction = Math.exp(-dt / GLIDE_FRICTION_MS);

  glide.vx *= friction;
  glide.vy *= friction;

  if (Math.hypot(glide.vx, glide.vy) < GLIDE_MIN_SPEED) {
    stop_glide(glide);
  }
};

export const stop_glide_at_edges = (
  glide: CameraGlide,
  x_before: number,
  y_before: number,
  camera: Camera,
) => {
  if (camera.x !== x_before) {
    glide.vx = 0;
  }

  if (camera.y !== y_before) {
    glide.vy = 0;
  }
};
