import { clamp } from '../../utils/math';
import { SPRITE_SIZE } from '../birds/bird.generator';
import type { Rect } from '../camera/camera';
import {
  EDGE_MARGIN,
  platform_x0,
  platform_x1,
  platform_y_at,
  type Platform,
  type Spot,
} from '../platforms/platforms';
import { SHORE_W, shore_x } from '../misc/shore.sprite';
import { request_save } from '../save/save';
import { grow_tree, TREE_PARAMS, type Tree } from './tree';
import { load_tree_sprite } from './tree.sprite';
import { CONFIG } from '../../../config';
import { is_sprite_ready, reset_lazy_sprite } from '../../../engine/lazy_sprite';

const FREE_SPOTS = CONFIG.tree.growth.free_spots;
const TREE_PADDING = SPRITE_SIZE;
const GROUND_PADDING = CONFIG.world.ground_padding;
const SCENE_SIDE_PADDING = CONFIG.world.side_padding;

export const tree_view = (tree: Tree): Rect => {
  const { x, y, w, h } = tree.bounds;

  return {
    x: x - TREE_PADDING,
    y: y - TREE_PADDING,
    w: w + TREE_PADDING * 2,
    h: h + TREE_PADDING + GROUND_PADDING,
  };
};

export const scene_bounds = (tree: Tree): Rect => {
  const view = tree_view(tree);
  const trunk_x = tree.trunk_x;
  const right = Math.max(view.x + view.w, shore_x(tree) + SHORE_W);
  const x = Math.min(view.x - SCENE_SIDE_PADDING, trunk_x * 2 - right);

  return { ...view, x, w: right - x };
};

const nearest_spot = (platforms: readonly Platform[], x: number, y: number): Spot => {
  let best: Spot = { platform: 0, x: platform_x0(platforms[0]!) };
  let best_distance = Infinity;

  platforms.forEach((p, platform) => {
    const x0 = platform_x0(p);
    const x1 = platform_x1(p);
    const margin = Math.min(EDGE_MARGIN, (x1 - x0) / 2);
    const px = clamp(x, x0 + margin, x1 - margin);
    const distance = Math.hypot(px - x, platform_y_at(p, px) - y);

    if (distance < best_distance) {
      best_distance = distance;
      best = { platform, x: px };
    }
  });

  return best;
};

const reseat_birds = (birds: readonly BIRD.Bird[], tree: Tree) => {
  const platforms = tree.platforms;

  for (const bird of birds) {
    const flight = bird.flight;

    if (flight !== null) {
      const spot = nearest_spot(platforms, flight.to_x, flight.to_y);

      flight.to_platform = spot.platform;
      flight.to_x = spot.x;
      flight.to_y = platform_y_at(platforms[spot.platform]!, spot.x);
    }

    const spot = nearest_spot(platforms, bird.x, bird.y);

    bird.platform = spot.platform;
    bird.walk_target = null;

    if (flight === null && !bird.playing && !bird.bathing) {
      bird.x = spot.x;
      bird.y = platform_y_at(platforms[spot.platform]!, spot.x);
    }
  }
};

export const update_tree_growth = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const scene = game.primary_scene;
  const { resources } = engine;
  const next = scene.next_tree;

  if (next === null) {
    if (is_sprite_ready(resources.tree) && game.birds.length + FREE_SPOTS > scene.tree.capacity) {
      const tree = grow_tree(
        scene.tree.seed,
        scene.tree.levels + 1,
        game.birds.length,
        TREE_PARAMS,
      );

      scene.next_tree = tree;
      reset_lazy_sprite(resources.next_tree);
      load_tree_sprite(engine, tree, resources.next_tree);
    }

    return;
  }

  if (!is_sprite_ready(resources.next_tree)) {
    return;
  }

  resources.tree.canvas = resources.next_tree.canvas;
  reset_lazy_sprite(resources.next_tree);
  scene.tree = next;
  scene.bounds = scene_bounds(next);
  scene.next_tree = null;
  reseat_birds(game.birds, next);
  request_save(game);
};
