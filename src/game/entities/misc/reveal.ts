import { clamp01 } from '../../utils/math';
import { CONFIG } from '../../../config';

const REVEAL_MS = CONFIG.reveal_ms;

export const scene_reveal = (engine: BIRD.EngineContext) => {
  const ready_at = engine.resources.tree.ready_at;

  return ready_at < 0 ? 0 : clamp01((performance.now() - ready_at) / REVEAL_MS);
};
