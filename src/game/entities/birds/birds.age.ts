import { rarity_of, type BirdGenes } from './bird.generator';
import type { Rng } from '../../utils/random';
import { CONFIG } from '../../../config';

const CYCLE_MS = CONFIG.birds.age.cycle_ms;
const ADULT_CYCLES = CONFIG.birds.age.adult_cycles;
const ADULT_RARITY_FACTOR = CONFIG.birds.age.adult_rarity_factor;
const ADULT_SPREAD = CONFIG.birds.age.adult_spread;
const COOLDOWN_CYCLES = CONFIG.breeding.cooldown_cycles;
const COOLDOWN_RARITY_FACTOR = CONFIG.breeding.cooldown_rarity_factor;
const FERTILE_REST = CONFIG.birds.character.fertile_rest;

export const age_bird = (bird: BIRD.Bird, delta_ms: number) => {
  bird.age += delta_ms / CYCLE_MS;
};

export const roll_adult_age = (genes: BirdGenes, rng: Rng) =>
  ADULT_CYCLES * ADULT_RARITY_FACTOR[rarity_of(genes)] * (1 + (rng() * 2 - 1) * ADULT_SPREAD);

export const is_adult = (bird: BIRD.Bird) => bird.age >= bird.adult_age;

export const rest_cycles = (bird: BIRD.Bird) =>
  COOLDOWN_CYCLES *
  COOLDOWN_RARITY_FACTOR[rarity_of(bird.behaviour.genes)] *
  (bird.gift === 'fertile' ? FERTILE_REST : 1);

export const is_resting = (bird: BIRD.Bird) => bird.age < bird.rest_until;

export const can_breed_bird = (bird: BIRD.Bird) => is_adult(bird) && !is_resting(bird);

export const not_breedable_reason = (bird: BIRD.Bird) =>
  !is_adult(bird)
    ? `Too young for ${(bird.adult_age - bird.age).toFixed(1)} cycles`
    : is_resting(bird)
      ? `Resting ${(bird.rest_until - bird.age).toFixed(1)} cycles`
      : null;

export const breeding_label = (bird: BIRD.Bird) =>
  is_adult(bird) ? (not_breedable_reason(bird) ?? 'Ready') : 'Too young';

export const growth_of = (bird: BIRD.Bird) => Math.min(1, bird.age / bird.adult_age);

export const stage_label = (bird: BIRD.Bird) =>
  is_adult(bird) ? 'Adult' : growth_of(bird) < 0.5 ? 'Chick' : 'Juvenile';

export const age_label = (bird: BIRD.Bird) => {
  const cycles = Math.floor(bird.age);

  return is_adult(bird)
    ? `${cycles} ${cycles === 1 ? 'cycle' : 'cycles'}`
    : `${cycles} / ${bird.adult_age.toFixed(1)} cycles`;
};
