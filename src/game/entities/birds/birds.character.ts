import { pick, type Rng } from '../../utils/random';
import { CONFIG } from '../../../config';

const C = CONFIG.birds.character;

export type Temper = 'none' | 'swimmer' | 'restless' | 'sleepy' | 'social' | 'loner';

export type Gift = 'none' | 'fertile' | 'joyful' | 'stable' | 'wild';

const TEMPERS: readonly Temper[] = ['swimmer', 'restless', 'sleepy', 'social', 'loner'];
const GIFTS: readonly Gift[] = ['fertile', 'joyful', 'stable', 'wild'];

export const roll_temper = (rng: Rng): Temper =>
  rng() < C.temper_chance ? pick(TEMPERS, rng, 'swimmer') : 'none';

export const roll_gift = (rng: Rng): Gift =>
  rng() < C.gift_chance ? pick(GIFTS, rng, 'fertile') : 'none';

export const temper_calm = (temper: Temper) =>
  temper === 'restless' ? C.restless_calm : temper === 'sleepy' ? C.sleepy_calm : 1;

export const gift_mutation_shift = (a: BIRD.Bird, b: BIRD.Bird) =>
  gift_shift(a.gift) + gift_shift(b.gift);

const gift_shift = (gift: Gift) => (gift === 'wild' ? 1 : gift === 'stable' ? -1 : 0);

export const is_temper = (value: unknown): value is Temper =>
  value === 'none' || TEMPERS.includes(value as Temper);

export const is_gift = (value: unknown): value is Gift =>
  value === 'none' || GIFTS.includes(value as Gift);
