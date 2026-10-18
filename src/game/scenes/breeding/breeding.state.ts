import { breed_birds, breed_rarity_chances } from '../../entities/birds/birds';
import { RARITIES } from '../collection/collection.state';
import { can_breed_bird } from '../../entities/birds/birds.age';
import { clear_bird_hover } from '../../entities/birds/birds.hover';
import { open_hatch } from '../hatch/hatch.state';

export const create_breeding_scene = (): BIRD.BreedingScene => ({
  parents: [null, null],
  picking: -1,
  no_room: false,
});

export const can_breed = (scene: BIRD.BreedingScene) =>
  scene.parents[0] !== null && scene.parents[1] !== null;

const chances = new Float64Array(RARITIES.length);
let chances_of: [BIRD.Bird | null, BIRD.Bird | null] = [null, null];
let chances_joy = [NaN, NaN];

export const breed_chances = (scene: BIRD.BreedingScene) => {
  const [a, b] = scene.parents;

  if (a === null || b === null) {
    chances.fill(0);
    chances_of = [null, null];
  } else if (
    a !== chances_of[0] ||
    b !== chances_of[1] ||
    a.joy !== chances_joy[0] ||
    b.joy !== chances_joy[1]
  ) {
    breed_rarity_chances(a, b, chances);
    chances_of = [a, b];
    chances_joy = [a.joy, b.joy];
  }

  return chances;
};

export const start_pick = (game: BIRD.GameState, slot: number) => {
  game.breeding_scene.picking = slot;
  clear_bird_hover(game.collection_scene.hover);
  game.current_scene = 'collection';
};

const set_parent = (game: BIRD.GameState, slot: number, bird: BIRD.Bird) => {
  const scene = game.breeding_scene;

  scene.parents[slot] = bird;
  scene.no_room = false;
  scene.picking = -1;
  game.current_scene = 'breeding';
};

export const pick_parent = (game: BIRD.GameState, bird: BIRD.Bird) => {
  const scene = game.breeding_scene;
  const slot = scene.picking;

  if (slot === -1 || scene.parents[1 - slot] === bird || !can_breed_bird(bird)) {
    return;
  }

  set_parent(game, slot, bird);
};

export const offer_parent = (game: BIRD.GameState, bird: BIRD.Bird) => {
  const parents = game.breeding_scene.parents;

  if (!can_breed_bird(bird)) {
    return;
  }

  const slot = parents[0] === bird ? 0 : parents[1] === bird ? 1 : parents[0] === null ? 0 : 1;

  set_parent(game, slot, bird);
};

export const cancel_pick = (game: BIRD.GameState) => {
  game.breeding_scene.picking = -1;
};

export const back_to_breeding = (game: BIRD.GameState) => {
  cancel_pick(game);
  game.current_scene = 'breeding';
};

export const breed = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const scene = game.breeding_scene;
  const [a, b] = scene.parents;

  if (a === null || b === null) {
    return;
  }

  const child = breed_birds(engine, game, a, b);

  scene.no_room = child === null;

  if (child !== null) {
    scene.parents = [null, null];
    open_hatch(game, child);
  }
};
