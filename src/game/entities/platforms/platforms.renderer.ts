import { to_screen_x, to_screen_y } from '../camera/camera';
import { CONFIG } from '../../../config';

const PLATFORM_COLOR = CONFIG.theme.debug.platforms;

export const render_platforms_debug = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
) => {
  const ctx = engine.ctx;
  const camera = scene.camera;

  ctx.strokeStyle = PLATFORM_COLOR;
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (const p of scene.tree.platforms) {
    p.points.forEach(([x, y], i) => {
      if (i === 0) {
        ctx.moveTo(to_screen_x(camera, x), to_screen_y(camera, y));
      } else {
        ctx.lineTo(to_screen_x(camera, x), to_screen_y(camera, y));
      }
    });
  }

  ctx.stroke();

  game.debug_hud.renders += 1;
};
