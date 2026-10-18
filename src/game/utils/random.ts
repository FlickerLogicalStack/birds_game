export type Rng = () => number;

const UINT32_RANGE = 4294967296;

export function create_rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export const range = (rng: Rng, min: number, max: number) => min + rng() * (max - min);

export const spread = (rng: Rng, half_width: number) => (rng() - 0.5) * 2 * half_width;

export const coin = (rng: Rng) => rng() < 0.5;

export const random_seed = (rng: Rng) => Math.floor(rng() * 2 ** 31);

export function shuffle_in_place<T>(items: T[], count: number, rng: Rng): void {
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (items.length - i));
    const item = items[i]!;

    items[i] = items[j]!;
    items[j] = item;
  }
}

export const random_sign = (rng: Rng) => (coin(rng) ? -1 : 1);

export function pick<T>(items: readonly T[], rng: Rng, fallback: T): T {
  return items[Math.floor(rng() * items.length)] ?? fallback;
}

export function hash2(x: number, y: number, seed: number): number {
  let h =
    Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / UINT32_RANGE;
}

export function hash_string(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
