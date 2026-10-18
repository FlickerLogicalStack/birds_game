import { download_canvas, screenshot_name } from '../engine/screenshot';
import { NO_SAFE_INSETS } from '../engine/engine';
import type { Camera } from './entities/camera/camera';
import { render_frame } from './game.render';
import { CONFIG } from '../config';

const SCREENSHOT_SCALE = CONFIG.screenshot.scale;
const SCREENSHOT_MAX_SIDE = CONFIG.screenshot.max_side;

const current_camera = (game: BIRD.GameState): Camera | null => {
  switch (game.current_scene) {
    case 'loading':
    case 'profile':
    case 'breeding':
    case 'hatch':
    case 'achievements':
      return null;
    case 'primary':
      return game.primary_scene.camera;
    case 'collection':
      return game.collection_scene.camera;
  }
};

export const take_screenshot = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const { width, height, dpr, safe } = engine.canvas;
  const scale = Math.min(SCREENSHOT_SCALE, SCREENSHOT_MAX_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn('Screenshot failed: no 2d context');
    return;
  }

  const camera = current_camera(game);
  const screen_ctx = engine.ctx;
  const zoom = camera?.zoom ?? 1;
  const renders = game.debug_hud.renders;

  engine.ctx = ctx;
  engine.canvas.width = canvas.width;
  engine.canvas.height = canvas.height;
  engine.canvas.pixel_ratio = scale;
  engine.canvas.dpr = 1;
  engine.canvas.safe = NO_SAFE_INSETS;
  if (camera !== null) {
    camera.zoom = zoom * scale;
  }

  try {
    render_frame(engine, game);
  } finally {
    engine.ctx = screen_ctx;
    engine.canvas.width = width;
    engine.canvas.height = height;
    engine.canvas.pixel_ratio = 1;
    engine.canvas.dpr = dpr;
    engine.canvas.safe = safe;
    if (camera !== null) {
      camera.zoom = zoom;
    }
    game.debug_hud.renders = renders;
  }

  download_canvas(canvas, screenshot_name('birds'));
};
