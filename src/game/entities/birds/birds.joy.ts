import { describe } from '../../utils/math';
import { CONFIG } from '../../../config';

const TEST_STEP = CONFIG.joy.test_step;
const FADE_MS = CONFIG.joy.fade_ms;

const JOY_WORDS = ['Calm', 'Content', 'Happy', 'Joyful'] as const;

export const fade_joy = (bird: BIRD.Bird, delta_ms: number) => {
  bird.joy = bird.gift === 'joyful' ? 1 : Math.max(0, bird.joy - delta_ms / FADE_MS);
};

export const joy_label = (bird: BIRD.Bird) => describe(bird.joy, JOY_WORDS);

export const step_test_joy = (game: BIRD.GameState) => {
  for (const bird of game.birds) {
    bird.joy = bird.joy >= 1 ? 0 : Math.min(1, bird.joy + TEST_STEP);
  }
};
