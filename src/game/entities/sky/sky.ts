import { __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';
import { define_stored, load_stored, save_stored } from '../../../engine/storage';
import { clamp, mod, smoothstep, TAU } from '../../utils/math';
import { CONFIG } from '../../../config';

export const DAY_CYCLE_MS = CONFIG.sky.day_cycle_ms;

const SUNSET_PHASE = CONFIG.sky.sunset_phase;

const START_PHASE = CONFIG.sky.start_phase;
const SKIP_CYCLE_MS = CONFIG.sky.skip_cycle_ms;
const SPEEDS = CONFIG.sky.speeds;

const DAWN_START = CONFIG.sky.dawn_start;
const DAWN_END = CONFIG.sky.dawn_end;

const TWILIGHT_HEIGHT = CONFIG.sky.twilight_height;

export type DayCycle = {
  phase: number;
  speed: number;
  resume_speed: number;
  target: number | null;
};

const create_day_cycle = (phase: number, speed: number, resume_speed: number): DayCycle => ({
  phase,
  speed,
  resume_speed,
  target: null,
});

const day_cycle_sample = __opt_remember_shape(create_day_cycle(0.5, 0.5, 0.5));

day_cycle_sample.target = 0.5;
__opt_prepare_mutations(day_cycle_sample, ['phase', 'speed', 'resume_speed', 'target']);

type StoredDayCycle = { speed: number; paused_phase: number | null };

const stored_day_cycle = (speed: number, paused_phase: number | null): StoredDayCycle => ({
  speed,
  paused_phase,
});

__opt_remember_shape(stored_day_cycle(0.5, null)).paused_phase = 0.5;

const DAY_CYCLE_STORED = define_stored<StoredDayCycle>(
  'birds.day_cycle',
  stored_day_cycle(1, null),
  (value: unknown): value is StoredDayCycle => {
    const v = value as StoredDayCycle | null;
    const phase = v?.paused_phase;

    return (
      typeof v === 'object' &&
      v !== null &&
      SPEEDS.includes(v.speed) &&
      (phase === null || (typeof phase === 'number' && phase >= 0 && phase < 1))
    );
  },
);

export const restore_day_cycle = (): DayCycle => {
  const { speed, paused_phase } = load_stored(DAY_CYCLE_STORED);

  return create_day_cycle(paused_phase ?? START_PHASE, paused_phase === null ? speed : 0, speed);
};

export const save_day_cycle = (cycle: DayCycle) =>
  save_stored(
    DAY_CYCLE_STORED,
    stored_day_cycle(cycle.resume_speed, cycle.speed === 0 ? (cycle.target ?? cycle.phase) : null),
  );

export const update_day_cycle = (cycle: DayCycle, delta_ms: number) => {
  if (cycle.target !== null) {
    const left = mod(cycle.target - cycle.phase, 1);
    const step = delta_ms / SKIP_CYCLE_MS;

    if (step >= left) {
      cycle.phase = cycle.target;
      cycle.target = null;
    } else {
      cycle.phase = mod(cycle.phase + step, 1);
    }

    return;
  }

  cycle.phase = mod(cycle.phase + (delta_ms * cycle.speed) / DAY_CYCLE_MS, 1);
};

export const skip_day_cycle_to = (cycle: DayCycle, phase: number) => {
  cycle.target = mod(phase, 1);
};

export const step_day_speed = (cycle: DayCycle, dir: -1 | 1) => {
  const next = SPEEDS[clamp(SPEEDS.indexOf(cycle.resume_speed) + dir, 0, SPEEDS.length - 1)]!;

  cycle.resume_speed = next;

  if (cycle.speed !== 0) {
    cycle.speed = next;
  }
};

export const can_step_day_speed = (cycle: DayCycle, dir: -1 | 1) => {
  const i = SPEEDS.indexOf(cycle.resume_speed);

  return dir === -1 ? i !== 0 : i !== SPEEDS.length - 1;
};

export const toggle_day_pause = (cycle: DayCycle) => {
  cycle.speed = cycle.speed === 0 ? cycle.resume_speed : 0;
};

export const sun_height = (cycle: DayCycle) => Math.sin(cycle.phase * TAU);

export const sun_progress = (cycle: DayCycle) =>
  cycle.phase < SUNSET_PHASE ? cycle.phase / SUNSET_PHASE : null;

export const moon_progress = (cycle: DayCycle) =>
  cycle.phase >= SUNSET_PHASE ? (cycle.phase - SUNSET_PHASE) / (1 - SUNSET_PHASE) : null;

export const daylight = (cycle: DayCycle) => smoothstep(DAWN_START, DAWN_END, sun_height(cycle));

export const twilight = (cycle: DayCycle) =>
  Math.max(0, 1 - Math.abs(sun_height(cycle)) / TWILIGHT_HEIGHT);
