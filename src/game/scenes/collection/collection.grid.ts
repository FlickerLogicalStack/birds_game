import { MIN_ZOOM, to_world_y } from '../../entities/camera/camera';
import { SCENE_BAR_SPACE } from '../../entities/ui/scene_bar';
import { clamp } from '../../utils/math';
import { scroll_to, type Layout } from '../../utils/layout';
import {
  collection_columns,
  collection_height,
  collection_width,
  COLLECTION_ROW,
  GRID_X,
  GRID_Y,
} from './collection.state';
import { COLLECTION_LAYOUT, COLLECTION_LAYOUT_ELEMENTS } from './collection.layout';
import { CONFIG } from '../../../config';

const COLLECTION_MAX_ZOOM = CONFIG.collection.max_zoom;

const E = COLLECTION_LAYOUT_ELEMENTS;

export const fit_collection_grid = (engine: BIRD.EngineContext, scene: BIRD.CollectionScene) => {
  const { width, pixel_ratio, safe } = engine.canvas;
  const view_w = width - safe.left - safe.right;
  const columns = collection_columns(view_w);
  const camera = scene.camera;

  if (columns !== scene.columns) {
    const top = COLLECTION_LAYOUT.rects[E.grid_scroll]!.y;
    const top_row = Math.max(0, Math.floor(to_world_y(camera, top) / COLLECTION_ROW));
    const first = scene.columns === 0 ? 0 : top_row * scene.columns;

    scene.columns = columns;
    camera.zoom = clamp(view_w / collection_width(columns), MIN_ZOOM, COLLECTION_MAX_ZOOM);
    scroll_to(
      COLLECTION_LAYOUT,
      E.grid_scroll,
      first === 0 ? 0 : (Math.floor(first / columns) * COLLECTION_ROW - GRID_Y) * camera.zoom,
    );
  }

  camera.zoom = clamp(view_w / collection_width(columns), MIN_ZOOM, COLLECTION_MAX_ZOOM);
  scene.grid_height = (collection_height(scene.shown.length, columns) * camera.zoom) / pixel_ratio;
};

export const place_grid_camera = (layout: Layout, scene: BIRD.CollectionScene) => {
  const rect = layout.rects[E.grid]!;
  const camera = scene.camera;
  const w = collection_width(scene.columns) * camera.zoom;

  camera.x = GRID_X - (rect.x + (rect.w - w) / 2) / camera.zoom;
  camera.y = GRID_Y - rect.y / camera.zoom;
};

export const show_collection_row = (scene: BIRD.CollectionScene, index: number) => {
  const layout = COLLECTION_LAYOUT;
  const view = layout.rects[E.grid_scroll]!;
  const zoom = scene.camera.zoom;
  const row_h = COLLECTION_ROW * zoom;
  const top = (Math.floor(index / scene.columns) * COLLECTION_ROW - GRID_Y) * zoom;
  const view_h = view.h - SCENE_BAR_SPACE * layout.pixel_ratio;
  const y = layout.scroll_y[E.grid_scroll]!;

  if (top < y || top + row_h > y + view_h) {
    scroll_to(layout, E.grid_scroll, top - (view_h - row_h) / 2);
  }
};
