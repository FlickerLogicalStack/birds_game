import { to_screen_x, to_screen_y, zoom_camera_at, type Camera } from './camera';
import { CONFIG } from '../../../config';

const BODY_OFFSET_Y = CONFIG.camera.follow_body_offset_y;
const FOLLOW_LAG_MS = CONFIG.camera.follow_lag_ms;
const FOLLOW_MIN_ZOOM = CONFIG.camera.follow_min_zoom;
const GRAB_RELEASE_PX = CONFIG.camera.grab_release_px;

export type CameraFollow = {
  bird: BIRD.Bird | null;
  zoom_target: number;
  grab: number;
};

export const create_camera_follow = (): CameraFollow => ({ bird: null, zoom_target: 0, grab: 0 });

export const start_follow = (follow: CameraFollow, camera: Camera, bird: BIRD.Bird) => {
  follow.bird = bird;
  follow.zoom_target = camera.zoom < FOLLOW_MIN_ZOOM ? FOLLOW_MIN_ZOOM : 0;
  follow.grab = 0;
};

export const grab_follow = (follow: CameraFollow, screen_dx: number, screen_dy: number) => {
  if (follow.bird === null) {
    return true;
  }

  follow.grab += Math.abs(screen_dx) + Math.abs(screen_dy);

  if (follow.grab < GRAB_RELEASE_PX) {
    return false;
  }

  stop_follow(follow);

  return true;
};

export const stop_follow = (follow: CameraFollow) => {
  follow.bird = null;
  follow.zoom_target = 0;
};

export const release_grab = (follow: CameraFollow) => {
  follow.grab = 0;
};

export const follow_anchor_x = (follow: CameraFollow, camera: Camera, fallback: number) =>
  follow.bird === null ? fallback : to_screen_x(camera, follow.bird.x);

export const follow_anchor_y = (follow: CameraFollow, camera: Camera, fallback: number) =>
  follow.bird === null ? fallback : to_screen_y(camera, follow.bird.y - BODY_OFFSET_Y);

export const stop_follow_zoom = (follow: CameraFollow) => {
  follow.zoom_target = 0;
};

export const update_follow = (
  follow: CameraFollow,
  camera: Camera,
  canvas_width: number,
  canvas_height: number,
  delta: number,
) => {
  const bird = follow.bird;

  if (bird === null) {
    return;
  }

  const k = 1 - Math.exp(-delta / FOLLOW_LAG_MS);
  const target_y = bird.y - BODY_OFFSET_Y;

  if (follow.zoom_target !== 0) {
    const zoom = camera.zoom + (follow.zoom_target - camera.zoom) * k;

    zoom_camera_at(camera, to_screen_x(camera, bird.x), to_screen_y(camera, target_y), zoom);

    if (Math.abs(follow.zoom_target - camera.zoom) < 0.01) {
      follow.zoom_target = 0;
    }
  }

  camera.x += (bird.x - canvas_width / 2 / camera.zoom - camera.x) * k;
  camera.y += (target_y - canvas_height / 2 / camera.zoom - camera.y) * k;
};
