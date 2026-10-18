export type Vec2 = [number, number];

export const DEG = Math.PI / 180;

export const TAU = Math.PI * 2;

export const FULL_TURN_DEG = 360;

export const MS_PER_SECOND = 1000;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const clamp01 = (v: number) => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const mod = (a: number, m: number) => ((a % m) + m) % m;

export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export const describe = (value: number, words: readonly string[]) =>
  words[clamp(Math.floor(value * words.length), 0, words.length - 1)]!;

export const arc01 = (t: number) => 4 * t * (1 - t);
