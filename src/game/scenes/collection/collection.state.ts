import { FLOAT_ZERO } from '../../../engine/shape';
import { define_stored, load_stored } from '../../../engine/storage';
import { RARITY_INFO, SPRITE_SIZE, type Rarity } from '../../entities/birds/bird.generator';
import { create_bird_hover } from '../../entities/birds/birds.hover';
import { create_camera } from '../../entities/camera/camera';
import { CONFIG } from '../../../config';

const MIN_COLLECTION_COLUMNS = CONFIG.collection.min_columns;
const MAX_COLLECTION_COLUMNS = CONFIG.collection.max_columns;
export const COLLECTION_CELL = SPRITE_SIZE + CONFIG.collection.cell_padding;
const COLLECTION_NAME_SPACE = CONFIG.collection.name_space;
export const COLLECTION_ROW = COLLECTION_CELL + COLLECTION_NAME_SPACE;
const FEET_INSET = CONFIG.collection.feet_inset;
const COLLECTION_Y_PADDING = CONFIG.collection.y_padding;
const COLLECTION_X_PADDING = CONFIG.collection.x_padding;
const MIN_CELL_ZOOM = CONFIG.collection.min_cell_zoom;

export const GRID_X = -COLLECTION_X_PADDING;
export const GRID_Y = -COLLECTION_Y_PADDING;

export const collection_width = (columns: number) =>
  columns * COLLECTION_CELL + COLLECTION_X_PADDING * 2;

export const collection_height = (count: number, columns: number) =>
  Math.max(1, Math.ceil(count / columns)) * COLLECTION_ROW + COLLECTION_Y_PADDING * 2;

export const collection_columns = (screen_width: number) => {
  for (let columns = MAX_COLLECTION_COLUMNS; columns > MIN_COLLECTION_COLUMNS; columns--) {
    if (screen_width / collection_width(columns) >= MIN_CELL_ZOOM) {
      return columns;
    }
  }

  return MIN_COLLECTION_COLUMNS;
};

export const collection_feet_x = (index: number, columns: number) =>
  (index % columns) * COLLECTION_CELL + COLLECTION_CELL / 2;
export const collection_feet_y = (index: number, columns: number) =>
  Math.floor(index / columns) * COLLECTION_ROW + COLLECTION_CELL - FEET_INSET;

export const RARITIES = Object.keys(RARITY_INFO) as Rarity[];
export const ALL_RARITIES = (1 << RARITIES.length) - 1;

export type CollectionSort = 'age' | 'rarity' | 'name' | 'color' | 'size';
export const COLLECTION_SORTS: readonly CollectionSort[] = [
  'age',
  'rarity',
  'name',
  'color',
  'size',
];

export const COLLECTION_RARITIES = define_stored(
  'birds.collection.rarities',
  ALL_RARITIES,
  (value: unknown): value is number =>
    Number.isInteger(value) && (value as number) > 0 && (value as number) <= ALL_RARITIES,
);
export const COLLECTION_BREEDABLE = define_stored(
  'birds.collection.breedable',
  false,
  (value: unknown): value is boolean => typeof value === 'boolean',
);
export const COLLECTION_SORT = define_stored(
  'birds.collection.sort',
  'age' as CollectionSort,
  (value: unknown): value is CollectionSort => COLLECTION_SORTS.includes(value as CollectionSort),
);

export const create_collection_scene = (): BIRD.CollectionScene => ({
  camera: create_camera(),
  columns: 0,
  rarities: load_stored(COLLECTION_RARITIES),
  breedable: load_stored(COLLECTION_BREEDABLE),
  sort: load_stored(COLLECTION_SORT),
  shown: [],
  of_rarity: [],
  shown_for: -1,
  counts: RARITIES.map(() => 0),
  breedable_count: 0,
  grid_height: FLOAT_ZERO,
  hover: create_bird_hover(),
});
