import { pick, range } from '../../utils/random';
import { start_follow, type CameraFollow } from './camera.follow';
import type { Camera } from './camera';
import { __opt_prepare_mutations, __opt_remember_shape, FLOAT_ZERO } from '../../../engine/shape';
import { CONFIG } from '../../../config';

const SWITCH_MIN_MS = CONFIG.camera.auto_follow_min_ms;
const SWITCH_MAX_MS = CONFIG.camera.auto_follow_max_ms;

export type AutoFollow = {
  enabled: boolean;
  bird: BIRD.Bird | null;
  switch_in: number;
};

const auto_follow_of = (
  enabled: boolean,
  bird: BIRD.Bird | null,
  switch_in: number,
): AutoFollow => ({
  enabled,
  bird,
  switch_in,
});

__opt_prepare_mutations(__opt_remember_shape(auto_follow_of(false, null, 0.5)), [
  'enabled',
  'bird',
  'switch_in',
]);

export const create_auto_follow = (): AutoFollow => auto_follow_of(false, null, FLOAT_ZERO);

export const toggle_auto_follow = (auto: AutoFollow, follow: CameraFollow) => {
  auto.enabled = !auto.enabled;
  auto.bird = follow.bird;
  auto.switch_in = 0;
};

export const forget_auto_follow_bird = (auto: AutoFollow, bird: BIRD.Bird) => {
  if (auto.bird === bird) {
    auto.bird = null;
    auto.switch_in = 0;
  }
};

const pick_other_bird = (birds: readonly BIRD.Bird[], current: BIRD.Bird | null) => {
  const index = current === null ? -1 : birds.indexOf(current);

  if (index === -1 || birds.length === 1) {
    return pick(birds, Math.random, null);
  }

  return birds[(index + 1 + Math.floor(Math.random() * (birds.length - 1))) % birds.length]!;
};

export const update_auto_follow = (
  auto: AutoFollow,
  follow: CameraFollow,
  camera: Camera,
  birds: readonly BIRD.Bird[],
  delta_ms: number,
) => {
  if (!auto.enabled) {
    return;
  }

  if (follow.bird !== auto.bird) {
    auto.enabled = false;
    auto.bird = null;
    return;
  }

  auto.switch_in -= delta_ms;

  if (auto.switch_in > 0) {
    return;
  }

  const bird = pick_other_bird(birds, auto.bird);

  auto.switch_in = range(Math.random, SWITCH_MIN_MS, SWITCH_MAX_MS);

  if (bird !== null) {
    start_follow(follow, camera, bird);
    auto.bird = bird;
  }
};
