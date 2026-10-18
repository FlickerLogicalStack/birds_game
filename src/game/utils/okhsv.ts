import type { RGBA } from './color';
import { clamp01, mod } from './math';

const oklab_to_linear_srgb = (L: number, a: number, b: number, out: number[]) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
};

const srgb_transfer = (x: number) =>
  x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;

const compute_max_saturation = (a: number, b: number) => {
  let k0: number, k1: number, k2: number, k3: number, k4: number;
  let wl: number, wm: number, ws: number;

  if (-1.88170328 * a - 0.80936493 * b > 1) {
    k0 = 1.19086277;
    k1 = 1.76576728;
    k2 = 0.59662641;
    k3 = 0.75515197;
    k4 = 0.56771245;
    wl = 4.0767416621;
    wm = -3.3077115913;
    ws = 0.2309699292;
  } else if (1.81444104 * a - 1.19445276 * b > 1) {
    k0 = 0.73956515;
    k1 = -0.45954404;
    k2 = 0.08285427;
    k3 = 0.1254107;
    k4 = 0.14503204;
    wl = -1.2684380046;
    wm = 2.6097574011;
    ws = -0.3413193965;
  } else {
    k0 = 1.35733652;
    k1 = -0.00915799;
    k2 = -1.1513021;
    k3 = -0.50559606;
    k4 = 0.00692167;
    wl = -0.0041960863;
    wm = -0.7034186147;
    ws = 1.707614701;
  }

  let S = k0 + k1 * a + k2 * b + k3 * a * a + k4 * a * b;

  const k_l = 0.3963377774 * a + 0.2158037573 * b;
  const k_m = -0.1055613458 * a - 0.0638541728 * b;
  const k_s = -0.0894841775 * a - 1.291485548 * b;

  const l_ = 1 + S * k_l;
  const m_ = 1 + S * k_m;
  const s_ = 1 + S * k_s;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const l_dS = 3 * k_l * l_ * l_;
  const m_dS = 3 * k_m * m_ * m_;
  const s_dS = 3 * k_s * s_ * s_;

  const l_dS2 = 6 * k_l * k_l * l_;
  const m_dS2 = 6 * k_m * k_m * m_;
  const s_dS2 = 6 * k_s * k_s * s_;

  const f = wl * l + wm * m + ws * s;
  const f1 = wl * l_dS + wm * m_dS + ws * s_dS;
  const f2 = wl * l_dS2 + wm * m_dS2 + ws * s_dS2;

  S = S - (f * f1) / (f1 * f1 - 0.5 * f * f2);

  return S;
};

const tmp = [0, 0, 0];

const cusp_st = (a: number, b: number, out: number[]) => {
  const S_cusp = compute_max_saturation(a, b);

  oklab_to_linear_srgb(1, S_cusp * a, S_cusp * b, tmp);

  const L_cusp = Math.cbrt(1 / Math.max(tmp[0]!, tmp[1]!, tmp[2]!));
  const C_cusp = L_cusp * S_cusp;

  out[0] = C_cusp / L_cusp;
  out[1] = C_cusp / (1 - L_cusp);
};

const TOE_K1 = 0.206;
const TOE_K2 = 0.03;
const TOE_K3 = (1 + TOE_K1) / (1 + TOE_K2);

const toe_inv = (x: number) => (x * x + TOE_K1 * x) / (TOE_K3 * (x + TOE_K2));

const S_0 = 0.5;
const st = [0, 0];
const rgb = [0, 0, 0];

export function okhsv_to_rgb(h: number, s: number, v: number): RGBA {
  const sc = clamp01(s);
  const vc = clamp01(v);

  if (vc === 0) {
    return [0, 0, 0, 255];
  }

  const angle = (mod(h, 360) / 180) * Math.PI;
  const a_ = Math.cos(angle);
  const b_ = Math.sin(angle);

  cusp_st(a_, b_, st);

  const S_max = st[0]!;
  const T_max = st[1]!;
  const k = 1 - S_0 / S_max;

  const L_v = 1 - (sc * S_0) / (S_0 + T_max - T_max * k * sc);
  const C_v = (sc * T_max * S_0) / (S_0 + T_max - T_max * k * sc);

  let L = vc * L_v;
  let C = vc * C_v;

  const L_vt = toe_inv(L_v);
  const C_vt = (C_v * L_vt) / L_v;
  const L_new = toe_inv(L);

  C = (C * L_new) / L;
  L = L_new;

  oklab_to_linear_srgb(L_vt, a_ * C_vt, b_ * C_vt, rgb);

  const scale_L = Math.cbrt(1 / Math.max(rgb[0]!, rgb[1]!, rgb[2]!, 0));

  L *= scale_L;
  C *= scale_L;

  oklab_to_linear_srgb(L, C * a_, C * b_, rgb);

  return [
    Math.round(clamp01(srgb_transfer(rgb[0]!)) * 255),
    Math.round(clamp01(srgb_transfer(rgb[1]!)) * 255),
    Math.round(clamp01(srgb_transfer(rgb[2]!)) * 255),
    255,
  ];
}
