import { update_bird_hover } from '../../entities/birds/birds.hover';
import { pick_bird } from '../../entities/birds/birds.pick';
import {
  clamp_camera,
  pan_camera,
  WHEEL_ZOOM_SPEED,
  zoom_camera_at,
} from '../../entities/camera/camera';
import {
  follow_anchor_x,
  follow_anchor_y,
  grab_follow,
  release_grab,
  start_follow,
  stop_follow_zoom,
  update_follow,
} from '../../entities/camera/camera.follow';
import {
  stop_glide,
  stop_glide_at_edges,
  track_glide,
  update_glide,
} from '../../entities/camera/camera.glide';

export const handle_primary_input = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  const { mouse } = engine.inputs;
  const camera = scene.camera;
  const follow = scene.camera_follow;
  const glide = scene.camera_glide;
  const dragging = mouse.is_dragging === true;

  if (mouse.double_click === true) {
    const hit = pick_bird(engine, game, camera, mouse.x, mouse.y);

    if (hit !== null) {
      start_follow(follow, camera, hit.bird);
    }
  }

  if (mouse.is_dragging === true || mouse.pan_x !== 0 || mouse.pan_y !== 0) {
    if (grab_follow(follow, mouse.pan_x, mouse.pan_y)) {
      pan_camera(camera, mouse.pan_x, mouse.pan_y);
    }
  } else {
    release_grab(follow);
  }

  if (follow.bird !== null) {
    stop_glide(glide);
    glide.dragging = dragging;
  } else if (dragging || glide.dragging) {
    track_glide(glide, dragging, mouse.pan_x, mouse.pan_y, engine.delta);
  } else if (mouse.pan_x !== 0 || mouse.pan_y !== 0) {
    stop_glide(glide);
  } else {
    update_glide(glide, camera, engine.delta);
  }

  if (mouse.wheel !== 0 || mouse.zoom !== 1) {
    const factor = Math.exp(-mouse.wheel * WHEEL_ZOOM_SPEED) * mouse.zoom;

    stop_follow_zoom(follow);
    zoom_camera_at(
      camera,
      follow_anchor_x(follow, camera, mouse.x),
      follow_anchor_y(follow, camera, mouse.y),
      camera.zoom * factor,
    );
  }

  update_follow(follow, camera, engine.canvas.width, engine.canvas.height, engine.delta);

  const x_before = camera.x;
  const y_before = camera.y;

  clamp_camera(camera, scene.bounds, engine.canvas.width, engine.canvas.height);
  stop_glide_at_edges(glide, x_before, y_before, camera);

  update_bird_hover(engine, scene.bird_hover, (x, y) => pick_bird(engine, game, camera, x, y));
};
