import { define_stored, is_bit, load_stored, save_stored } from '../../../engine/storage';
import { LoopedFloat16Array, LoopedFloat32Array, LoopedSmiArray } from './LoopedArray';

export const DEBUG_HUD_ENABLED = define_stored('birds.debug_hud.enabled', 0, is_bit);

export type DebugHud = {
  enabled: number;
  frames: LoopedSmiArray;
  frame_times: LoopedFloat16Array | LoopedFloat32Array;
  renders: number;
  layers: Map<string, number>;
};

export const create_debug_hud = (): DebugHud => ({
  enabled: load_stored(DEBUG_HUD_ENABLED),
  frames: new LoopedSmiArray(8),
  frame_times: 'Float16Array' in window ? new LoopedFloat16Array(8) : new LoopedFloat32Array(8),
  renders: 0,
  layers: new Map(),
});

export const toggle_debug_hud = (hud: DebugHud) => {
  hud.enabled ^= 1;
  save_stored(DEBUG_HUD_ENABLED, hud.enabled);
};

const LAYER_SMOOTHING = 0.05;

export const layer_clock = (game: BIRD.GameState): number =>
  game.debug_hud.enabled === 1 && !game.is_in_screenshot_mode ? performance.now() : 0;

export const mark_layer = (hud: DebugHud, name: string, since: number): number => {
  if (since === 0) {
    return 0;
  }

  const now = performance.now();
  const ms = now - since;
  const prev = hud.layers.get(name);

  hud.layers.set(name, prev === undefined ? ms : prev + (ms - prev) * LAYER_SMOOTHING);

  return now;
};
