import type { Camera } from '../camera/camera';
import { world_rect } from './birds.bath.renderer';
import { MOTES } from './birds.trail';
import { TAU } from '../../utils/math';
import { CONFIG } from '../../../config';

const T = CONFIG.birds.trail;

const SPARKS = ['#fff6c2', '#ffd65a'];
const PETALS = ['#f7a8c8', '#e9799f'];
const SNOW = ['#ffffff', '#d6e8ff'];
const RAINBOW = Array.from({ length: 12 }, (_, i) => `hsl(${i * 30} 90% 65%)`);

const mote_color = (kind: (typeof MOTES)[number]['kind'], seed: number) => {
  switch (kind) {
    case 'sparks':
      return SPARKS[seed < 0.5 ? 0 : 1]!;
    case 'petals':
      return PETALS[seed < 0.5 ? 0 : 1]!;
    case 'snow':
      return SNOW[seed < 0.5 ? 0 : 1]!;
    case 'rainbow':
      return RAINBOW[Math.floor(seed * RAINBOW.length)]!;
  }
};

export const render_trails = (engine: BIRD.EngineContext, camera: Camera) => {
  const ctx = engine.ctx;
  const alpha = ctx.globalAlpha;

  for (const mote of MOTES) {
    if (!mote.alive) {
      continue;
    }

    const t = mote.age / mote.life;
    const falling = mote.kind === 'petals' || mote.kind === 'snow';
    const sway = falling ? T.sway * Math.sin((mote.age / T.sway_ms + mote.seed) * TAU) : 0;
    const flicker = mote.kind === 'sparks' && (mote.age + mote.seed * 200) % 160 < 50 ? 0.4 : 1;

    const fading = t > T.hold;
    const size = fading ? Math.max(1, T[mote.kind].size - 1) : T[mote.kind].size;
    const x = mote.x + sway - size / 2;
    const y = mote.y - size / 2;
    const color = mote_color(mote.kind, mote.seed);

    ctx.globalAlpha = alpha * (fading ? (1 - t) / (1 - T.hold) : 1) * flicker;

    if (mote.kind === 'sparks' && size >= 3) {
      const mid = (size - 1) / 2;

      world_rect(engine, camera, x, y + mid, size, 1, color);
      world_rect(engine, camera, x + mid, y, 1, size, color);
    } else {
      world_rect(engine, camera, x, y, size, size, color);
    }
  }

  ctx.globalAlpha = alpha;
};
