import { rarity_of, rarity_score } from '../../entities/birds/bird.generator';
import { can_breed_bird } from '../../entities/birds/birds.age';
import { RARITIES } from './collection.state';
import { CONFIG } from '../../../config';

const GREY_SAT = CONFIG.collection.grey_sat;

const color_key = (bird: BIRD.Bird) => {
  const g = bird.behaviour.genes;

  return g.sat < GREY_SAT ? 360 + g.val : g.hue;
};

const NAME_COLLATOR = new Intl.Collator();
const by_name = (a: BIRD.Bird, b: BIRD.Bird) => NAME_COLLATOR.compare(a.name, b.name);

export const update_shown = (game: BIRD.GameState, scene: BIRD.CollectionScene) => {
  const counts = RARITIES.map(() => 0);
  const of_rarity: BIRD.Bird[] = [];

  for (const bird of game.birds) {
    const index = RARITIES.indexOf(rarity_of(bird.behaviour.genes));

    counts[index]! += 1;

    if ((scene.rarities & (1 << index)) !== 0) {
      of_rarity.push(bird);
    }
  }

  const shown = scene.breedable ? of_rarity.filter(can_breed_bird) : of_rarity.slice();

  switch (scene.sort) {
    case 'age':
      shown.sort((a, b) => a.age - b.age || by_name(a, b));
      break;
    case 'rarity': {
      const score = new Map(shown.map(bird => [bird, rarity_score(bird.behaviour.genes)]));

      shown.sort((a, b) => score.get(b)! - score.get(a)! || by_name(a, b));
      break;
    }
    case 'name':
      shown.sort(by_name);
      break;
    case 'color':
      shown.sort((a, b) => color_key(a) - color_key(b) || by_name(a, b));
      break;
    case 'size':
      shown.sort((a, b) => b.behaviour.genes.size - a.behaviour.genes.size || by_name(a, b));
      break;
  }

  scene.shown = shown;
  scene.of_rarity = of_rarity;
  scene.counts = counts;
  scene.shown_for = game.birds.length;
};

const count_ready = (birds: readonly BIRD.Bird[]) => {
  let ready = 0;

  for (const bird of birds) {
    if (can_breed_bird(bird)) {
      ready += 1;
    }
  }

  return ready;
};

export const handle_collection_gameplay = (game: BIRD.GameState, scene: BIRD.CollectionScene) => {
  if (scene.shown_for !== game.birds.length) {
    update_shown(game, scene);
  }

  const ready = count_ready(scene.of_rarity);

  if (scene.breedable && (ready !== scene.shown.length || !scene.shown.every(can_breed_bird))) {
    update_shown(game, scene);
  }

  scene.breedable_count = ready;
};
