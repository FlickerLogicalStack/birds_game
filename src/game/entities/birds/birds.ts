import { FULL_TURN_DEG, lerp } from '../../utils/math';
import { coin, create_rng, pick, random_seed, type Rng } from '../../utils/random';
import { pick_spot, platform_y_at, type Spot } from '../platforms/platforms';
import type { Tree } from '../tree/tree';
import {
  BirdBehaviour,
  copy_genes,
  impose_locked,
  make_genes,
  child_rarity_chances,
  mix_genes,
  plumage_colors,
  roll_special_of,
  type BirdGenes,
  type GeneGroup,
  type PlumageColors,
  type Rarity,
} from './bird.generator';
import { rest_cycles, roll_adult_age } from './birds.age';
import { next_fly_pause } from './birds.flight';
import { clear_bird_hover } from './birds.hover';
import { forget_auto_follow_bird } from '../camera/camera.auto_follow';
import { stop_follow } from '../camera/camera.follow';
import { random_bird_name } from './birds.names';
import { request_save, type SavedBird } from '../save/save';
import { stop_play } from './birds.play';
import { stop_bath } from './birds.bath';
import { taken_spots } from './birds.place';
import { next_walk_pause } from './birds.walk';
import {
  gift_mutation_shift,
  roll_gift,
  roll_temper,
  temper_calm,
  type Gift,
  type Temper,
} from './birds.character';
import { BRED, count_achievement, record_bird, RELEASED } from '../achievements/achievements';
import { CONFIG } from '../../../config';
import { __opt_prepare_mutations, __opt_remember_shape, FLOAT_ZERO } from '../../../engine/shape';

const BREED_FADE = CONFIG.breeding.breed_fade;
const OUTLIER_CHANCE = CONFIG.breeding.outlier_chance;
const OUTLIER_CANDIDATES = CONFIG.breeding.outlier_candidates;
const JOY_LUCK = CONFIG.breeding.joy_luck;
const START_JOY = CONFIG.joy.start;
const EXTRA_HALF_BREEDS = CONFIG.breeding.mutation.extra_half_breeds;
const FLOCK_EXTRA_CYCLES = CONFIG.birds.age.flock_extra_cycles;
const MIN_BIRDS = CONFIG.world.min_birds;
const START_CANDIDATES = CONFIG.world.start_candidates;
const WILD_SAT_MIN = CONFIG.birds.wild.sat_min;
const WILD_VAL_MIN = CONFIG.birds.wild.val_min;
const WILD_DULL_CHANCE = CONFIG.birds.wild.dull_chance;
const BREED_MUTATION = {
  ...CONFIG.breeding.mutation,
  sat_min: WILD_SAT_MIN,
  val_min: WILD_VAL_MIN,
};

const NAME_SALT = 0x6e616d65;
const AGE_SALT = 0x61676521;
const CHARACTER_SALT = 0x63686172;

const random_wild_genes = (
  rng: Rng,
  rarity: Rarity,
  dull_chance: number,
  sat_min: number,
  val_min: number,
) => {
  const dull = rng() < dull_chance;

  return make_genes({
    size: rng(),
    form: rng(),
    tail: rng(),
    beak: rng(),
    crest: rng(),
    hue: rng() * FULL_TURN_DEG,
    sat: dull ? rng() : lerp(sat_min, 1, rng()),
    val: dull ? rng() : lerp(val_min, 1, rng()),
    belly_hue_shift: rng() * FULL_TURN_DEG,
    belly_light: rng(),
    wing_hue_shift: rng() * FULL_TURN_DEG,
    special: rarity === 'common' ? undefined : roll_special_of(rarity, rng),
  });
};

const COLOR_PARTS = ['body', 'belly', 'wing', 'crest'] as const;
const MAX_COLOR_DISTANCE = 255 * Math.sqrt(3);

const genes_distance = (a: BirdGenes, ca: PlumageColors, b: BirdGenes, cb: PlumageColors) => {
  const body =
    (Math.abs(a.size - b.size) +
      Math.abs(a.form - b.form) +
      Math.abs(a.tail - b.tail) +
      Math.abs(a.beak - b.beak) +
      Math.abs(a.crest - b.crest)) /
    5;
  let color = 0;

  for (const part of COLOR_PARTS) {
    const [ar, ag, ab] = ca[part];
    const [br, bg, bb] = cb[part];

    color += Math.hypot(ar - br, ag - bg, ab - bb) / MAX_COLOR_DISTANCE;
  }

  return body + color / COLOR_PARTS.length;
};

const distinct_wild_genes = (count: number, rarity: Rarity, rng: Rng): BirdGenes[] => {
  const pool = Array.from({ length: Math.max(count, START_CANDIDATES, 2) }, () =>
    random_wild_genes(rng, rarity, 0, WILD_SAT_MIN, WILD_VAL_MIN),
  );
  const colors = pool.map(plumage_colors);
  const distance = pool.map((a, i) =>
    pool.map((b, j) => genes_distance(a, colors[i]!, b, colors[j]!)),
  );
  let pair_a = 0;
  let pair_b = 1;

  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      if (distance[i]![j]! > distance[pair_a]![pair_b]!) {
        pair_a = i;
        pair_b = j;
      }
    }
  }

  const chosen = [pair_a, pair_b];

  while (chosen.length < count) {
    let next = -1;
    let next_distance = -1;

    for (let i = 0; i < pool.length; i++) {
      const nearest = chosen.includes(i) ? -1 : Math.min(...chosen.map(c => distance[i]![c]!));

      if (nearest > next_distance) {
        next = i;
        next_distance = nearest;
      }
    }

    chosen.push(next);
  }

  return chosen.slice(0, count).map(i => pool[i]!);
};

const outlier_genes = (
  flock: readonly BIRD.Bird[],
  special: BirdGenes['special'],
  rng: Rng,
): BirdGenes => {
  const flock_colors = flock.map(bird => plumage_colors(bird.behaviour.genes));
  let best: BirdGenes | null = null;
  let best_distance = -1;

  for (let i = 0; i < OUTLIER_CANDIDATES; i++) {
    const genes = random_wild_genes(rng, 'common', 0, WILD_SAT_MIN, WILD_VAL_MIN);
    const colors = plumage_colors(genes);
    let nearest = Infinity;

    for (let j = 0; j < flock.length; j++) {
      nearest = Math.min(
        nearest,
        genes_distance(genes, colors, flock[j]!.behaviour.genes, flock_colors[j]!),
      );
    }

    if (nearest > best_distance) {
      best = genes;
      best_distance = nearest;
    }
  }

  return make_genes({ ...best!, special });
};

const bird_of = (
  behaviour: BirdBehaviour,
  name: string,
  x: number,
  y: number,
  platform: number,
  walk_pause: number,
  fly_pause: number,
  age: number,
  adult_age: number,
  rest_until: number,
  breeds: number,
  joy: number,
  suppressed: GeneGroup | null,
  dominant: GeneGroup | null,
  temper: Temper,
  gift: Gift,
): BIRD.Bird => ({
  behaviour,
  drawn: null,
  drawn_code: -1,
  name,
  x,
  y,
  platform,
  walk_target: null,
  walk_pause,
  flight: null,
  fly_pause,
  playing: false,
  bathing: false,
  age,
  adult_age,
  rest_until,
  breeds,
  joy,
  suppressed,
  dominant,
  temper,
  gift,
});

const bird_sample = __opt_remember_shape(
  bird_of(
    new BirdBehaviour(make_genes({}), 1, 1),
    '',
    0.5,
    0.5,
    0,
    0.5,
    0.5,
    0.5,
    0.5,
    0.5,
    0,
    0.5,
    null,
    null,
    'none',
    'none',
  ),
);

bird_sample.walk_target = 0.5;
__opt_prepare_mutations(bird_sample, [
  'drawn',
  'drawn_code',
  'x',
  'y',
  'platform',
  'walk_target',
  'walk_pause',
  'flight',
  'fly_pause',
  'playing',
  'bathing',
  'age',
  'rest_until',
  'breeds',
  'joy',
  'suppressed',
  'dominant',
]);

const name_of_seed = (seed: number) => random_bird_name(create_rng(seed ^ NAME_SALT));

const make_bird = (
  tree: Tree,
  spot: Spot,
  genes: BirdGenes,
  seed: number,
  name: string,
  facing_left: boolean,
  age: number,
  adult_age: number,
  rest_until: number,
  breeds: number,
  joy: number,
  suppressed: GeneGroup | null,
  dominant: GeneGroup | null,
  temper: Temper,
  gift: Gift,
): BIRD.Bird => {
  const behaviour = new BirdBehaviour(genes, seed, temper_calm(temper));

  behaviour.facing_left = facing_left;

  return bird_of(
    behaviour,
    name,
    spot.x,
    platform_y_at(tree.platforms[spot.platform]!, spot.x),
    spot.platform,
    next_walk_pause(behaviour),
    next_fly_pause(behaviour),
    age,
    adult_age,
    rest_until,
    breeds,
    joy,
    suppressed,
    dominant,
    temper,
    gift,
  );
};

const create_adult_bird = (tree: Tree, spot: Spot, genes: BirdGenes, rng: Rng): BIRD.Bird => {
  const seed = random_seed(rng);
  const facing_left = coin(rng);
  const age_rng = create_rng(seed ^ AGE_SALT);
  const adult_age = roll_adult_age(genes, age_rng);
  const character_rng = create_rng(seed ^ CHARACTER_SALT);

  return make_bird(
    tree,
    spot,
    genes,
    seed,
    name_of_seed(seed),
    facing_left,
    adult_age + age_rng() * FLOCK_EXTRA_CYCLES,
    adult_age,
    FLOAT_ZERO,
    0,
    START_JOY,
    null,
    null,
    roll_temper(character_rng),
    roll_gift(character_rng),
  );
};

export const create_start_birds = (tree: Tree, spots: readonly Spot[], rng: Rng): BIRD.Bird[] => {
  const genes = distinct_wild_genes(spots.length, 'common', rng);

  return spots.map((spot, i) => create_adult_bird(tree, spot, genes[i]!, rng));
};

const breed_weight = (bird: BIRD.Bird) => 1 / (1 + bird.breeds * BREED_FADE);

const breed_share = (a: BIRD.Bird, b: BIRD.Bird) => {
  const wa = breed_weight(a);
  const wb = breed_weight(b);

  return wb / (wa + wb);
};

const extra_mutation_chance = (a: BIRD.Bird, b: BIRD.Bird) => {
  const breeds = a.breeds + b.breeds;

  return breeds / (breeds + EXTRA_HALF_BREEDS);
};

const joy_luck = (a: BIRD.Bird, b: BIRD.Bird) => ((a.joy + b.joy) / 2) * JOY_LUCK;

export const breed_rarity_chances = (a: BIRD.Bird, b: BIRD.Bird, out: Float64Array) =>
  child_rarity_chances(
    a.behaviour.genes,
    b.behaviour.genes,
    BREED_MUTATION.special_chance,
    joy_luck(a, b),
    a.suppressed,
    b.suppressed,
    a.dominant,
    b.dominant,
    out,
  );

export const breed_birds = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  a: BIRD.Bird,
  b: BIRD.Bird,
): BIRD.Bird | null => {
  const tree = game.primary_scene.tree;
  const spot = pick_spot(tree.platforms, taken_spots(game.birds, null), Math.random);

  if (spot === null) {
    return null;
  }

  const mixed = mix_genes(
    a.behaviour.genes,
    b.behaviour.genes,
    breed_share(a, b),
    Math.random,
    BREED_MUTATION,
    extra_mutation_chance(a, b),
    joy_luck(a, b),
    a.suppressed,
    b.suppressed,
    a.dominant,
    b.dominant,
    gift_mutation_shift(a, b),
  );
  const genes =
    Math.random() < OUTLIER_CHANCE ? outlier_genes(game.birds, mixed.special, Math.random) : mixed;

  impose_locked(
    genes,
    a.behaviour.genes,
    b.behaviour.genes,
    a.suppressed,
    b.suppressed,
    a.dominant,
    b.dominant,
  );
  const seed = random_seed(Math.random);
  const child = make_bird(
    tree,
    spot,
    genes,
    seed,
    name_of_seed(seed),
    coin(Math.random),
    FLOAT_ZERO,
    roll_adult_age(genes, Math.random),
    FLOAT_ZERO,
    0,
    START_JOY,
    null,
    null,
    roll_temper(Math.random),
    roll_gift(Math.random),
  );

  add_bird(engine, game, child, true);
  count_achievement(game, BRED);

  a.rest_until = a.age + rest_cycles(a);
  b.rest_until = b.age + rest_cycles(b);
  a.breeds++;
  b.breeds++;

  return child;
};

export const restore_bird = (tree: Tree, spot: Spot, saved: SavedBird): BIRD.Bird =>
  make_bird(
    tree,
    spot,
    copy_genes(saved.genes),
    random_seed(Math.random),
    saved.name,
    coin(Math.random),
    saved.age,
    saved.adult_age,
    saved.rest_until,
    saved.breeds ?? 0,
    saved.joy ?? START_JOY,
    saved.suppressed ?? null,
    saved.dominant ?? null,
    saved.temper ?? roll_temper(Math.random),
    saved.gift ?? roll_gift(Math.random),
  );

export const add_bird = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  bird: BIRD.Bird,
  notify: boolean,
) => {
  game.birds.push(bird);
  engine.resources.bird_sprite_warmer.add(bird.behaviour);
  record_bird(game, bird, notify);
  request_save(game);
};

export const add_wild_bird = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  rarity: Rarity,
): BIRD.Bird | null => {
  const tree = game.primary_scene.tree;
  const spot = pick_spot(tree.platforms, taken_spots(game.birds, null), Math.random);

  if (spot === null) {
    return null;
  }

  const bird = create_adult_bird(
    tree,
    spot,
    random_wild_genes(Math.random, rarity, WILD_DULL_CHANCE, WILD_SAT_MIN, WILD_VAL_MIN),
    Math.random,
  );

  add_bird(engine, game, bird, false);

  return bird;
};

export const can_release_bird = (game: BIRD.GameState) => game.birds.length > MIN_BIRDS;

export const release_bird = (engine: BIRD.EngineContext, game: BIRD.GameState, bird: BIRD.Bird) => {
  const index = game.birds.indexOf(bird);

  if (index === -1) {
    return;
  }

  game.birds.splice(index, 1);
  engine.resources.bird_sprite_warmer.remove(bird.behaviour);
  count_achievement(game, RELEASED);
  request_save(game);

  const primary = game.primary_scene;

  stop_play(game, bird);
  stop_bath(game, bird);

  if (primary.camera_follow.bird === bird) {
    stop_follow(primary.camera_follow);
  }

  forget_auto_follow_bird(primary.auto_follow, bird);

  if (primary.bird_hover.hit?.bird === bird) {
    clear_bird_hover(primary.bird_hover);
  }

  if (game.collection_scene.hover.hit?.bird === bird) {
    clear_bird_hover(game.collection_scene.hover);
  }

  const breeding = game.breeding_scene;

  breeding.parents = [
    breeding.parents[0] === bird ? null : breeding.parents[0],
    breeding.parents[1] === bird ? null : breeding.parents[1],
  ];
};

export const release_random_bird = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const candidates = game.birds.filter(
    bird => bird !== game.profile_scene.bird && bird !== game.hatch_scene.bird,
  );
  const bird = pick(candidates, Math.random, null);

  if (!can_release_bird(game) || bird === null) {
    return;
  }

  release_bird(engine, game, bird);
};
