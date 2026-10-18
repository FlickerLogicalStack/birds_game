import { lerp } from './math';

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

export const mix_rgb = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const mix_rgb_into = (out: RGB, a: RGB, b: RGB, t: number): RGB => {
  out[0] = lerp(a[0], b[0], t);
  out[1] = lerp(a[1], b[1], t);
  out[2] = lerp(a[2], b[2], t);
  return out;
};

export const rgb_key = (c: RGB) => ((c[0] | 0) << 16) | ((c[1] | 0) << 8) | (c[2] | 0);

export const rgb_css = ([r, g, b]: RGB, alpha: number) =>
  `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${alpha})`;
