import { snap_px, to_screen_x, to_screen_y, to_world_x, to_world_y } from '../camera/camera';
import { scene_reveal } from '../misc/reveal';
import { with_smoothing } from '../../utils/draw';

export const render_tree = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  const sprite = engine.resources.tree.canvas;
  const alpha = scene_reveal(engine);

  if (alpha === 0) {
    return;
  }
  const ctx = engine.ctx;
  const camera = scene.camera;
  const { x: bx, y: by, w, h } = scene.tree.bounds;

  const sx0 = Math.max(0, Math.floor(to_world_x(camera, 0) - bx));
  const sy0 = Math.max(0, Math.floor(to_world_y(camera, 0) - by));
  const sx1 = Math.min(w, Math.ceil(to_world_x(camera, engine.canvas.width) - bx));
  const sy1 = Math.min(h, Math.ceil(to_world_y(camera, engine.canvas.height) - by));

  if (sx1 <= sx0 || sy1 <= sy0) {
    return;
  }

  ctx.globalAlpha = alpha;
  with_smoothing(ctx, false, () =>
    ctx.drawImage(
      sprite,
      sx0,
      sy0,
      sx1 - sx0,
      sy1 - sy0,
      snap_px(to_screen_x(camera, bx + sx0), engine.canvas.dpr),
      snap_px(to_screen_y(camera, by + sy0), engine.canvas.dpr),
      (sx1 - sx0) * camera.zoom,
      (sy1 - sy0) * camera.zoom,
    ),
  );
  ctx.globalAlpha = 1;

  game.debug_hud.renders += 1;
};
