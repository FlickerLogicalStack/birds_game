import type { BirdHit } from './birds.pick';
import { CONFIG } from '../../../config';

const HOVER_PICK_MS = CONFIG.hover.pick_interval_ms;

export type BirdHover = {
  hit: BirdHit | null;
  pick_in: number;
  x: number;
  y: number;
};

export const create_bird_hover = (): BirdHover => ({ hit: null, pick_in: 0, x: 0, y: 0 });

export const clear_bird_hover = (hover: BirdHover) => {
  hover.hit = null;
  hover.pick_in = 0;
};

export const update_bird_hover = (
  engine: BIRD.EngineContext,
  hover: BirdHover,
  pick: (screen_x: number, screen_y: number) => BirdHit | null,
) => {
  const mouse = engine.inputs.mouse;

  if (mouse.is_over === false) {
    hover.hit = null;
    return;
  }

  hover.pick_in -= engine.delta;

  if (hover.pick_in > 0 && mouse.x === hover.x && mouse.y === hover.y) {
    return;
  }

  hover.pick_in = HOVER_PICK_MS;
  hover.x = mouse.x;
  hover.y = mouse.y;
  hover.hit = pick(mouse.x, mouse.y);
};
