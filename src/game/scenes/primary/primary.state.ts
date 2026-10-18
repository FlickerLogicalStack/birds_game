import { create_camera_glide } from '../../entities/camera/camera.glide';
import { add_bird, create_start_birds, restore_bird } from '../../entities/birds/birds';
import { next_play_pause } from '../../entities/birds/birds.play';
import { next_bath_pause } from '../../entities/birds/birds.bath';
import { create_bird_hover } from '../../entities/birds/birds.hover';
import { create_camera, fit_camera } from '../../entities/camera/camera';
import { create_camera_follow } from '../../entities/camera/camera.follow';
import { create_auto_follow } from '../../entities/camera/camera.auto_follow';
import { pick_spot, type Spot } from '../../entities/platforms/platforms';
import type { SavedGame } from '../../entities/save/save';
import { create_clouds } from '../../entities/sky/clouds';
import { restore_day_cycle } from '../../entities/sky/sky';
import { grow_tree, TREE_PARAMS } from '../../entities/tree/tree';
import { scene_bounds, tree_view } from '../../entities/tree/tree.growth';
import { CONFIG } from '../../../config';

const START_BIRDS = CONFIG.world.start_birds;

export const create_primary_scene = (
  engine: BIRD.EngineContext,
  tree_seed: number,
  tree_levels: number,
  birds: number,
): BIRD.PrimaryScene => {
  const tree = grow_tree(tree_seed, tree_levels, birds, TREE_PARAMS);
  const camera = create_camera();

  fit_camera(camera, tree_view(tree), engine.canvas.width, engine.canvas.height);

  return {
    bounds: scene_bounds(tree),
    camera,
    camera_follow: create_camera_follow(),
    camera_glide: create_camera_glide(),
    auto_follow: create_auto_follow(),
    bird_hover: create_bird_hover(),
    tree,
    next_tree: null,
    day: restore_day_cycle(),
    clouds: create_clouds(),
    plays: [],
    play_pause: next_play_pause(),
    baths: [],
    sand_pause: next_bath_pause('sand'),
    water_pause: next_bath_pause('water'),
  };
};

export const populate_primary_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.PrimaryScene,
  saved: SavedGame | null,
) => {
  const platforms = scene.tree.platforms;
  const taken: Spot[] = [];

  if (saved === null) {
    for (let i = 0; i < START_BIRDS; i++) {
      const spot = pick_spot(platforms, taken, Math.random);

      if (spot === null) {
        break;
      }

      taken.push(spot);
    }

    for (const bird of create_start_birds(scene.tree, taken, Math.random)) {
      add_bird(engine, game, bird, false);
    }

    return;
  }

  for (const saved_bird of saved.birds) {
    const spot = pick_spot(platforms, taken, Math.random) ?? pick_spot(platforms, [], Math.random);

    if (spot === null) {
      break;
    }

    const bird = restore_bird(scene.tree, spot, saved_bird);

    taken.push(spot);
    add_bird(engine, game, bird, false);
  }
};
