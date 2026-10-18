import { save_stored } from '../../../engine/storage';
import { in_rect, is_clicked, to_world_x, to_world_y } from '../../entities/camera/camera';
import { clear_bird_hover, update_bird_hover } from '../../entities/birds/birds.hover';
import { hit_bird_at, pick_radius, type BirdHit } from '../../entities/birds/birds.pick';
import { update_shown } from './collection.gameplay';
import {
  ALL_RARITIES,
  COLLECTION_CELL,
  collection_feet_x,
  collection_feet_y,
  COLLECTION_BREEDABLE,
  COLLECTION_RARITIES,
  COLLECTION_SORT,
  COLLECTION_ROW,
  COLLECTION_SORTS,
} from './collection.state';
import {
  COLLECTION_LAYOUT,
  COLLECTION_LAYOUT_ELEMENTS,
  TOOLBAR_CHIPS,
  type ToolbarAction,
} from './collection.layout';
import { reset_scroll, scroll_input, update_layout } from '../../utils/layout';
import { fit_collection_grid, place_grid_camera } from './collection.grid';
import { open_profile } from '../profile/profile.state';
import { back_to_breeding, pick_parent } from '../breeding/breeding.state';

const apply_action = (scene: BIRD.CollectionScene, action: ToolbarAction) => {
  switch (action.kind) {
    case 'all':
      scene.rarities = ALL_RARITIES;
      scene.breedable = false;
      break;
    case 'rarity': {
      const bit = 1 << action.rarity;
      const next = scene.rarities === ALL_RARITIES ? bit : scene.rarities ^ bit;

      scene.rarities = next === 0 ? ALL_RARITIES : next;
      break;
    }
    case 'breedable':
      scene.breedable = !scene.breedable;
      break;
    case 'sort': {
      const index = COLLECTION_SORTS.indexOf(scene.sort);

      scene.sort = COLLECTION_SORTS[(index + 1) % COLLECTION_SORTS.length]!;
      save_stored(COLLECTION_SORT, scene.sort);
      break;
    }
  }

  save_stored(COLLECTION_RARITIES, scene.rarities);
  save_stored(COLLECTION_BREEDABLE, scene.breedable);
  scene.shown_for = -1;
  reset_scroll(COLLECTION_LAYOUT, COLLECTION_LAYOUT_ELEMENTS.grid_scroll);
};

const cell_at = (scene: BIRD.CollectionScene, screen_x: number, screen_y: number) => {
  const column = Math.floor(to_world_x(scene.camera, screen_x) / COLLECTION_CELL);
  const row = Math.floor(to_world_y(scene.camera, screen_y) / COLLECTION_ROW);
  const index = row * scene.columns + column;

  return column < 0 || column >= scene.columns || row < 0 || index >= scene.shown.length
    ? -1
    : index;
};

const pick_collection_bird = (
  engine: BIRD.EngineContext,
  scene: BIRD.CollectionScene,
  screen_x: number,
  screen_y: number,
): BirdHit | null => {
  const index = cell_at(scene, screen_x, screen_y);

  if (index === -1) {
    return null;
  }

  const bird = scene.shown[index]!;
  const bounds = hit_bird_at(
    engine,
    bird,
    collection_feet_x(index, scene.columns),
    collection_feet_y(index, scene.columns),
    to_world_x(scene.camera, screen_x),
    to_world_y(scene.camera, screen_y),
    pick_radius(scene.camera),
  );

  return bounds === null ? null : { bird, bounds, index };
};

export const handle_collection_input = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.CollectionScene,
) => {
  const { kb, mouse } = engine.inputs;
  const E = COLLECTION_LAYOUT_ELEMENTS;
  const picking = game.breeding_scene.picking !== -1;

  if (scene.shown_for !== game.birds.length) {
    update_shown(game, scene);
  }

  fit_collection_grid(engine, scene);
  scroll_input(COLLECTION_LAYOUT, E.grid_scroll, engine);

  const layout = update_layout(COLLECTION_LAYOUT, engine, game);
  const rects = layout.rects;
  const in_grid = in_rect(rects[E.grid_scroll]!, mouse.x, mouse.y);

  place_grid_camera(layout, scene);

  const cancel = picking && (kb.Escape || is_clicked(mouse, rects[E.pick_cancel]!));

  kb.Escape = false;

  if (cancel) {
    back_to_breeding(game);
  } else if (mouse.click === true) {
    const chip = TOOLBAR_CHIPS.find(chip => in_rect(rects[chip.handle]!, mouse.x, mouse.y));

    if (chip !== undefined) {
      apply_action(scene, chip.action);
    } else if (in_grid) {
      const bird = pick_collection_bird(engine, scene, mouse.x, mouse.y)?.bird;

      if (bird !== undefined && picking) {
        pick_parent(game, bird);
      } else if (bird !== undefined) {
        open_profile(game, bird);
      }
    }
  }

  if (in_grid) {
    update_bird_hover(engine, scene.hover, (x, y) => pick_collection_bird(engine, scene, x, y));
  } else {
    clear_bird_hover(scene.hover);
  }
};
