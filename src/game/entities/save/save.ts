import { GENE_GROUP_KEYS, type BirdGenes, type GeneGroup } from '../birds/bird.generator';
import { is_gift, is_temper, type Gift, type Temper } from '../birds/birds.character';
import { clamp } from '../../utils/math';
import { define_stored, load_stored, save_stored } from '../../../engine/storage';
import { CONFIG } from '../../../config';
import { __opt_prepare_mutations, __opt_remember_shape, FLOAT_ZERO } from '../../../engine/shape';
import { restart_app } from '../../../engine/app_update';

const INTERVAL_MS = CONFIG.save.interval_ms;
const MAX_OFFLINE_MS = CONFIG.save.max_offline_ms;

const SAVE_VERSION = 1;

export type SavedBird = {
  genes: BirdGenes;
  name: string;
  age: number;
  adult_age: number;
  rest_until: number;
  breeds?: number;
  joy?: number;
  suppressed?: GeneGroup;
  dominant?: GeneGroup;
  temper?: Temper;
  gift?: Gift;
};

export type SavedGame = {
  version: number;
  tree_seed: number;
  tree_levels?: number;
  saved_at: number;
  birds: SavedBird[];
};

const is_record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const is_finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const is_saved_bird = (value: unknown): value is SavedBird =>
  is_record(value) &&
  is_record(value.genes) &&
  typeof value.name === 'string' &&
  is_finite(value.age) &&
  is_finite(value.adult_age) &&
  is_finite(value.rest_until) &&
  (value.breeds === undefined || is_finite(value.breeds)) &&
  (value.joy === undefined || is_finite(value.joy)) &&
  (value.suppressed === undefined ||
    (typeof value.suppressed === 'string' && Object.hasOwn(GENE_GROUP_KEYS, value.suppressed))) &&
  (value.dominant === undefined ||
    (typeof value.dominant === 'string' && Object.hasOwn(GENE_GROUP_KEYS, value.dominant))) &&
  (value.temper === undefined || is_temper(value.temper)) &&
  (value.gift === undefined || is_gift(value.gift));

const is_saved_game = (value: unknown): value is SavedGame =>
  is_record(value) &&
  value.version === SAVE_VERSION &&
  is_finite(value.tree_seed) &&
  (value.tree_levels === undefined || is_finite(value.tree_levels)) &&
  is_finite(value.saved_at) &&
  Array.isArray(value.birds) &&
  value.birds.every(is_saved_bird);

const SAVED_GAME = define_stored<SavedGame | null>(
  'birds.save',
  null,
  (value: unknown): value is SavedGame | null => value === null || is_saved_game(value),
);

export const load_game = () => load_stored(SAVED_GAME);

export const offline_since = (at: number) => clamp(Date.now() - at, 0, MAX_OFFLINE_MS);

const save_state_of = (since: number): BIRD.SaveState => ({ since, dirty: false, stopped: false });

export const create_save_state = () => save_state_of(FLOAT_ZERO);

__opt_prepare_mutations(__opt_remember_shape(save_state_of(0.5)), ['since', 'dirty', 'stopped']);

export const request_save = (game: BIRD.GameState) => {
  game.save.dirty = true;
};

const saved_bird = (bird: BIRD.Bird): SavedBird => ({
  genes: bird.behaviour.genes,
  name: bird.name,
  age: bird.age,
  adult_age: bird.adult_age,
  rest_until: bird.rest_until,
  breeds: bird.breeds,
  joy: bird.joy,
  suppressed: bird.suppressed ?? undefined,
  dominant: bird.dominant ?? undefined,
  temper: bird.temper,
  gift: bird.gift,
});

export const write_game = (game: BIRD.GameState) => {
  if (game.save.stopped) {
    return;
  }

  game.save.since = 0;
  game.save.dirty = false;

  save_stored(SAVED_GAME, {
    version: SAVE_VERSION,
    tree_seed: game.primary_scene.tree.seed,
    tree_levels: game.primary_scene.tree.levels,
    saved_at: Date.now(),
    birds: game.birds.map(saved_bird),
  });
};

export const update_save = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const save = game.save;

  save.since += engine.delta;

  if (save.dirty || save.since >= INTERVAL_MS) {
    write_game(game);
  }
};

export const reset_game = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  game.save.stopped = true;

  try {
    localStorage.clear();
  } catch {}

  void engine.resources.persistent.clear().then(() => restart_app());
};
