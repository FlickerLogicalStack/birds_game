import { snap_px, to_screen_x, to_screen_y, type Camera } from '../camera/camera';
import { render_sand_over } from '../misc/background.renderer';
import { sand_surface, shore_x, WATER_LEVEL } from '../misc/shore.sprite';
import { rgb_css } from '../../utils/color';
import { fill_rect } from '../../utils/draw';
import { SPRITE_SIZE } from './bird.generator';
import { bath_of_bird, SPRAY, type Bath } from './birds.bath';
import { CONFIG } from '../../../config';

const C = CONFIG.ground.shore.colors;
const SAND = rgb_css(C.sand, 1);
const SAND_LIGHT = rgb_css(C.sand_light, 1);
const SAND_DARK = rgb_css(C.sand_dark, 1);
const FOAM = rgb_css(C.foam, 1);
const WATER_SURFACE = rgb_css(C.water_surface, 1);
const WATER = CONFIG.birds.water;
const HALF = SPRITE_SIZE / 2;
const RIPPLE_GAP = 6;
const RIPPLE_W = 3;
const RIM_GAP = 4;
const RIM_W = 4;

export const world_rect = (
  engine: BIRD.EngineContext,
  camera: Camera,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) => {
  const sx = snap_px(to_screen_x(camera, x), engine.canvas.dpr);
  const sy = snap_px(to_screen_y(camera, y), engine.canvas.dpr);

  fill_rect(
    engine.ctx,
    sx,
    sy,
    snap_px(to_screen_x(camera, x + w), engine.canvas.dpr) - sx,
    snap_px(to_screen_y(camera, y + h), engine.canvas.dpr) - sy,
    color,
  );
};

const render_rim = (
  engine: BIRD.EngineContext,
  camera: Camera,
  x: number,
  surface_y: number,
  side: number,
  height: number,
) => {
  const near = x + side * RIM_GAP - (side < 0 ? RIM_W : 0);

  world_rect(engine, camera, near, surface_y - 1, RIM_W, 1, SAND);

  if (height > 1) {
    world_rect(engine, camera, near + (side < 0 ? 1 : 0), surface_y - 2, RIM_W - 1, 1, SAND_LIGHT);
  }

  world_rect(engine, camera, near + (side < 0 ? 0 : RIM_W - 1), surface_y - 1, 1, 1, SAND_DARK);
};

const render_in_sand = (engine: BIRD.EngineContext, scene: BIRD.PrimaryScene, bird: BIRD.Bird) => {
  const tree = scene.tree;
  const surface = sand_surface(Math.round(bird.x - shore_x(tree)));
  const surface_y = tree.ground_y + surface;
  const sink = bird.y - surface_y;

  if (sink < 0.5) {
    return;
  }

  render_sand_over(
    engine,
    scene,
    bird.x - HALF,
    bird.x + HALF,
    surface - 2,
    Math.ceil(surface + sink) + 2,
  );

  const height = Math.round(sink / 2);

  render_rim(engine, scene.camera, bird.x, surface_y, -1, height);
  render_rim(engine, scene.camera, bird.x, surface_y, 1, height);
};

const render_ripples = (engine: BIRD.EngineContext, camera: Camera, bath: Bath) => {
  const ctx = engine.ctx;
  const alpha = ctx.globalAlpha;
  const t = (bath.time % WATER.ripple_ms) / WATER.ripple_ms;
  const reach = RIPPLE_GAP + t * WATER.ripple_reach;

  ctx.globalAlpha = alpha * (1 - t);
  world_rect(engine, camera, bath.to_x - reach - RIPPLE_W, bath.water_y, RIPPLE_W, 1, FOAM);
  world_rect(engine, camera, bath.to_x + reach, bath.water_y, RIPPLE_W, 1, FOAM);
  ctx.globalAlpha = alpha;
};

const render_in_water = (engine: BIRD.EngineContext, scene: BIRD.PrimaryScene, bath: Bath) => {
  const bird = bath.bird;
  const depth = bird.y - bath.water_y;

  if (depth < 0.5) {
    return;
  }

  const ctx = engine.ctx;
  const alpha = ctx.globalAlpha;
  const x0 = bird.x - HALF;
  const x1 = bird.x + HALF;

  render_sand_over(engine, scene, x0, x1, WATER_LEVEL, WATER_LEVEL + 1);
  ctx.globalAlpha = alpha * WATER.alpha;
  render_sand_over(engine, scene, x0, x1, WATER_LEVEL + 1, Math.ceil(WATER_LEVEL + depth) + 2);
  ctx.globalAlpha = alpha;

  if (bath.phase === 'bathe') {
    render_ripples(engine, scene.camera, bath);
  }
};

export const render_bird_in_bath = (
  engine: BIRD.EngineContext,
  scene: BIRD.PrimaryScene,
  bird: BIRD.Bird,
) => {
  const bath = bath_of_bird(scene, bird);

  if (bath === null) {
    return;
  }

  if (bath.kind === 'sand') {
    render_in_sand(engine, scene, bird);
  } else {
    render_in_water(engine, scene, bath);
  }
};

export const render_spray = (engine: BIRD.EngineContext, camera: Camera) => {
  for (const drop of SPRAY) {
    if (drop.alive) {
      const light = drop.light ? (drop.kind === 'sand' ? SAND_LIGHT : FOAM) : null;

      world_rect(
        engine,
        camera,
        drop.x,
        drop.y,
        1,
        1,
        light ?? (drop.kind === 'sand' ? SAND : WATER_SURFACE),
      );
    }
  }
};
