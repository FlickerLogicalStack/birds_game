import { hash_text } from '../../../engine/hash';
import { FLOAT_ZERO, __opt_prepare_mutations, __opt_remember_shape } from '../../../engine/shape';
import type { RGBA } from '../../utils/color';
import { okhsv_to_rgb } from '../../utils/okhsv';
import { clamp, clamp01, mod, TAU } from '../../utils/math';
import {
  create_rng,
  hash2,
  hash_string,
  pick,
  random_seed,
  shuffle_in_place,
  type Rng,
} from '../../utils/random';

export const SPRITE_SIZE = 64;
const N = SPRITE_SIZE;
const U = N / 32;
const GROUND = 29 * U;
export const SPRITE_FEET_Y = GROUND + 1;
const SHADOW_COLOR: [number, number, number, number] = [8, 6, 12, 150];

export interface BirdGenes {
  size: number;
  form: number;
  tail: number;
  beak: number;
  crest: number;
  hue: number;
  sat: number;
  val: number;
  belly_hue_shift: number;
  belly_light: number;
  wing_hue_shift: number;
  special?: SpecialTraits;
}

export function make_genes(overrides: Partial<BirdGenes>): BirdGenes {
  const form = overrides.form ?? 0.4;
  return snap_genes({
    size: 0.6,
    form,
    tail: 0.12 + 0.38 * form,
    beak: 0.1 + 0.3 * form,
    crest: 0,
    hue: 96,
    sat: 0.93,
    val: 0.98,
    belly_hue_shift: 7,
    belly_light: 0.5,
    wing_hue_shift: -14,
    ...overrides,
  });
}

export type Morph =
  'normal' | 'leucistic' | 'albino' | 'melanistic' | 'golden' | 'iridescent' | 'chimera' | 'sunset';
export type Pattern = 'none' | 'bars' | 'mask' | 'cap';
export type Ornament = 'none' | 'streamers' | 'plume';
export type Eyes = 'normal' | 'heterochromia' | 'glowing';
export type Trail = 'none' | 'sparks' | 'petals' | 'snow' | 'rainbow';

export interface SpecialTraits {
  morph: Morph;
  pattern: Pattern;
  ornament: Ornament;
  aura: boolean;
  aura_hue: number;
  eyes: Eyes;
  eye_hue: number;
  trail: Trail;
}

const make_special = (
  morph: Morph,
  pattern: Pattern,
  ornament: Ornament,
  aura: boolean,
  aura_hue: number,
  eyes: Eyes,
  eye_hue: number,
  trail: Trail,
): SpecialTraits => ({ morph, pattern, ornament, aura, aura_hue, eyes, eye_hue, trail });

export const NO_SPECIAL: SpecialTraits = make_special(
  'normal',
  'none',
  'none',
  false,
  50,
  'normal',
  50,
  'none',
);

const copy_special = (sp: Readonly<SpecialTraits>) =>
  make_special(
    MORPHS.includes(sp.morph) ? sp.morph : NO_SPECIAL.morph,
    PATTERNS.includes(sp.pattern) ? sp.pattern : NO_SPECIAL.pattern,
    sp.ornament,
    sp.aura,
    sp.aura_hue,
    sp.eyes ?? NO_SPECIAL.eyes,
    sp.eye_hue ?? NO_SPECIAL.eye_hue,
    sp.trail ?? NO_SPECIAL.trail,
  );

function genes_with(
  g: Readonly<BirdGenes>,
  hue: number,
  sat: number,
  special: SpecialTraits | undefined,
): BirdGenes {
  return {
    size: g.size,
    form: g.form,
    tail: g.tail,
    beak: g.beak,
    crest: g.crest,
    hue,
    sat,
    val: g.val,
    belly_hue_shift: g.belly_hue_shift,
    belly_light: g.belly_light,
    wing_hue_shift: g.wing_hue_shift,
    special,
  };
}

const GENES_SAMPLE_BASE: BirdGenes = {
  size: 0.5,
  form: 0.5,
  tail: 0.5,
  beak: 0.5,
  crest: 0.5,
  hue: 0.5,
  sat: 0.5,
  val: 0.5,
  belly_hue_shift: 0.5,
  belly_light: 0.5,
  wing_hue_shift: 0.5,
};
__opt_remember_shape(genes_with(GENES_SAMPLE_BASE, 0.5, 0.5, undefined));
__opt_remember_shape(genes_with(GENES_SAMPLE_BASE, 0.5, 0.5, NO_SPECIAL));

export function copy_genes(g: Readonly<BirdGenes>): BirdGenes {
  const sp = g.special;
  return genes_with(g, g.hue, g.sat, sp ? copy_special(sp) : undefined);
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const RARITY_INFO: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Common', color: '#9aa3ad' },
  uncommon: { name: 'Uncommon', color: '#4caf50' },
  rare: { name: 'Rare', color: '#2f80ed' },
  epic: { name: 'Epic', color: '#9b51e0' },
  legendary: { name: 'Legendary', color: '#f2a20c' },
};

const MORPH_POINTS: Record<Morph, number> = {
  normal: 0,
  leucistic: 2,
  albino: 3,
  melanistic: 3,
  golden: 4,
  iridescent: 5,
  chimera: 5,
  sunset: 3,
};

const EYES_POINTS: Record<Eyes, number> = {
  normal: 0,
  heterochromia: 2,
  glowing: 3,
};

const TRAIL_POINTS = 2;

function special_score(sp: SpecialTraits): number {
  return (
    MORPH_POINTS[sp.morph] +
    (sp.pattern !== 'none' ? 1 : 0) +
    (sp.ornament !== 'none' ? 2 : 0) +
    (sp.aura ? 5 : 0) +
    EYES_POINTS[sp.eyes] +
    (sp.trail !== 'none' ? TRAIL_POINTS : 0)
  );
}

export function rarity_score(g: BirdGenes): number {
  return special_score(g.special ?? NO_SPECIAL);
}

function rarity_of_score(p: number): Rarity {
  return p === 0 ? 'common' : p <= 2 ? 'uncommon' : p <= 4 ? 'rare' : p <= 7 ? 'epic' : 'legendary';
}

export function rarity_of(g: BirdGenes): Rarity {
  return rarity_of_score(rarity_score(g));
}

export const WILD_CHANCES: {
  pattern: number;
  ornament: number;
  morph: Record<Exclude<Morph, 'normal'>, number>;
  aura: number;
  eyes: Record<Exclude<Eyes, 'normal'>, number>;
  trail: number;
} = {
  pattern: 0.09,
  ornament: 0.04,
  morph: {
    leucistic: 0.03,
    albino: 0.01,
    melanistic: 0.01,
    golden: 0.004,
    iridescent: 0.003,
    chimera: 0.002,
    sunset: 0.006,
  },
  aura: 0.002,
  eyes: {
    heterochromia: 0.02,
    glowing: 0.005,
  },
  trail: 0.01,
};

const PATTERNS: readonly Pattern[] = ['bars', 'mask', 'cap'];
const ORNAMENTS: readonly Ornament[] = ['streamers', 'plume'];
const TRAILS: readonly Trail[] = ['sparks', 'petals', 'snow', 'rainbow'];

function roll_variant<T extends string>(
  chances: Readonly<Record<string, number>>,
  none: T,
  rng: Rng,
  k: number,
): T {
  const r = rng();
  let acc = 0;
  for (const [m, p] of Object.entries(chances) as [T, number][]) {
    acc += p * k;
    if (r < acc) return m;
  }
  return none;
}

function roll_special(rng: Rng, k: number): SpecialTraits {
  return make_special(
    roll_variant<Morph>(WILD_CHANCES.morph, 'normal', rng, k),
    rng() < WILD_CHANCES.pattern * k ? pick(PATTERNS, rng, 'bars') : 'none',
    rng() < WILD_CHANCES.ornament * k ? pick(ORNAMENTS, rng, 'plume') : 'none',
    rng() < WILD_CHANCES.aura * k,
    rng() * 360,
    roll_variant<Eyes>(WILD_CHANCES.eyes, 'normal', rng, k),
    rng() * 360,
    rng() < WILD_CHANCES.trail * k ? pick(TRAILS, rng, 'sparks') : 'none',
  );
}

const MORPHS = Object.keys(MORPH_POINTS) as Morph[];
const EYES = Object.keys(EYES_POINTS) as Eyes[];
const MAX_RARITY_ROLLS = 200;

export function roll_special_of(rarity: Rarity, rng: Rng): SpecialTraits {
  if (rarity === 'common') return NO_SPECIAL;
  let sp = NO_SPECIAL;
  for (let n = 0; n < MAX_RARITY_ROLLS; n++) {
    sp = make_special(
      pick(MORPHS, rng, 'normal'),
      rng() < 0.5 ? pick(PATTERNS, rng, 'bars') : 'none',
      rng() < 0.5 ? pick(ORNAMENTS, rng, 'plume') : 'none',
      rng() < 0.25,
      rng() * 360,
      pick(EYES, rng, 'normal'),
      rng() * 360,
      rng() < 0.5 ? pick(TRAILS, rng, 'sparks') : 'none',
    );
    if (rarity_of({ special: sp } as BirdGenes) === rarity) break;
  }
  return sp;
}

const SAME_TRAIT_KEEP = 0.75;
const ONE_TRAIT_KEEP = 0.3;

function inherit_trait<T>(
  trait_a: T,
  trait_b: T,
  none: T,
  rng: Rng,
  spont: () => T,
  lose_a: boolean,
  lose_b: boolean,
  win_a: boolean,
  win_b: boolean,
): T {
  const wa = win_a && trait_a !== none;
  const wb = win_b && trait_b !== none;
  if (wa && wb) return spont();
  if (wa) return trait_a;
  if (wb) return trait_b;
  const a = lose_a ? none : trait_a;
  const b = lose_b ? none : trait_b;
  if (a === b && a !== none) return rng() < SAME_TRAIT_KEEP ? a : spont();
  const candidates = [a, b].filter(x => x !== none);
  if (candidates.length === 2 && rng() < 0.5) candidates.reverse();
  for (const c of candidates) if (rng() < ONE_TRAIT_KEEP) return c;
  return spont();
}

function inherit_special(
  sa: SpecialTraits | undefined,
  sb: SpecialTraits | undefined,
  rng: Rng,
  special_chance: number,
  suppressed_a: GeneGroup | null,
  suppressed_b: GeneGroup | null,
  dominant_a: GeneGroup | null,
  dominant_b: GeneGroup | null,
): SpecialTraits {
  const a = sa ?? NO_SPECIAL;
  const b = sb ?? NO_SPECIAL;
  const spont = () => roll_special(rng, special_chance);
  const aura_a = suppressed_a === 'aura';
  const aura_b = suppressed_b === 'aura';
  const eyes_a = suppressed_a === 'eyes';
  const eyes_b = suppressed_b === 'eyes';
  const aura_win_a = dominant_a === 'aura';
  const aura_win_b = dominant_b === 'aura';
  const eyes_win_a = dominant_a === 'eyes';
  const eyes_win_b = dominant_b === 'eyes';
  return make_special(
    inherit_trait<Morph>(
      a.morph,
      b.morph,
      'normal',
      rng,
      () => spont().morph,
      suppressed_a === 'morph',
      suppressed_b === 'morph',
      dominant_a === 'morph',
      dominant_b === 'morph',
    ),
    inherit_trait<Pattern>(
      a.pattern,
      b.pattern,
      'none',
      rng,
      () => spont().pattern,
      suppressed_a === 'pattern',
      suppressed_b === 'pattern',
      dominant_a === 'pattern',
      dominant_b === 'pattern',
    ),
    inherit_trait<Ornament>(
      a.ornament,
      b.ornament,
      'none',
      rng,
      () => spont().ornament,
      suppressed_a === 'ornament',
      suppressed_b === 'ornament',
      dominant_a === 'ornament',
      dominant_b === 'ornament',
    ),
    inherit_trait(
      a.aura,
      b.aura,
      false,
      rng,
      () => spont().aura,
      aura_a,
      aura_b,
      aura_win_a,
      aura_win_b,
    ),
    inherit_hue(
      a.aura,
      b.aura,
      a.aura_hue,
      b.aura_hue,
      rng,
      aura_a,
      aura_b,
      aura_win_a,
      aura_win_b,
    ),
    inherit_trait<Eyes>(
      a.eyes,
      b.eyes,
      'normal',
      rng,
      () => spont().eyes,
      eyes_a,
      eyes_b,
      eyes_win_a,
      eyes_win_b,
    ),
    inherit_hue(
      a.eyes !== 'normal',
      b.eyes !== 'normal',
      a.eye_hue,
      b.eye_hue,
      rng,
      eyes_a,
      eyes_b,
      eyes_win_a,
      eyes_win_b,
    ),
    inherit_trait<Trail>(
      a.trail,
      b.trail,
      'none',
      rng,
      () => spont().trail,
      suppressed_a === 'trail',
      suppressed_b === 'trail',
      dominant_a === 'trail',
      dominant_b === 'trail',
    ),
  );
}

function inherit_hue(
  had_a: boolean,
  had_b: boolean,
  hue_a: number,
  hue_b: number,
  rng: Rng,
  lose_a: boolean,
  lose_b: boolean,
  win_a: boolean,
  win_b: boolean,
): number {
  const wa = win_a && had_a;
  const wb = win_b && had_b;
  if (wa && wb) return rng() * 360;
  if (wa) return hue_a;
  if (wb) return hue_b;
  const has_a = had_a && !lose_a;
  const has_b = had_b && !lose_b;
  if (has_a && has_b) return rng() < 0.5 ? hue_a : hue_b;
  if (has_a) return hue_a;
  if (has_b) return hue_b;
  return rng() * 360;
}

const MAX_TRAIT_POINTS = 5;
const MAX_SCORE = MORPH_POINTS.chimera + 1 + 2 + 5 + EYES_POINTS.glowing + TRAIL_POINTS;
const RARITY_ORDER = Object.keys(RARITY_INFO) as Rarity[];

function spont_points(points: number, chance: number): Float64Array {
  const out = new Float64Array(MAX_TRAIT_POINTS + 1);
  out[points] = chance;
  out[0] = 1 - chance;
  return out;
}

function spont_variant_points<T extends string>(
  chances: Readonly<Partial<Record<T, number>>>,
  points: Readonly<Record<T, number>>,
  k: number,
): Float64Array {
  const out = new Float64Array(MAX_TRAIT_POINTS + 1);
  let rest = 1;
  for (const [m, p] of Object.entries(chances) as [T, number][]) {
    out[points[m]]! += p * k;
    rest -= p * k;
  }
  out[0]! += rest;
  return out;
}

function trait_points<T>(
  trait_a: T,
  trait_b: T,
  none: T,
  pa: number,
  pb: number,
  spont: Float64Array,
  lose_a: boolean,
  lose_b: boolean,
  win_a: boolean,
  win_b: boolean,
): Float64Array {
  const out = new Float64Array(MAX_TRAIT_POINTS + 1);
  const wa = win_a && trait_a !== none;
  const wb = win_b && trait_b !== none;
  if (wa && wb) {
    out.set(spont);
    return out;
  }
  if (wa || wb) {
    out[wa ? pa : pb] = 1;
    return out;
  }
  const a = lose_a ? none : trait_a;
  const b = lose_b ? none : trait_b;
  let rest: number;
  if (a === b && a !== none) {
    out[pa] = SAME_TRAIT_KEEP;
    rest = 1 - SAME_TRAIT_KEEP;
  } else if (a !== none && b !== none) {
    const each = (ONE_TRAIT_KEEP + (1 - ONE_TRAIT_KEEP) * ONE_TRAIT_KEEP) / 2;
    out[pa]! += each;
    out[pb]! += each;
    rest = (1 - ONE_TRAIT_KEEP) ** 2;
  } else if (a !== none || b !== none) {
    out[a !== none ? pa : pb] = ONE_TRAIT_KEEP;
    rest = 1 - ONE_TRAIT_KEEP;
  } else {
    rest = 1;
  }
  for (let p = 0; p <= MAX_TRAIT_POINTS; p++) out[p]! += rest * spont[p]!;
  return out;
}

export function child_rarity_chances(
  a: BirdGenes,
  b: BirdGenes,
  special_chance: number,
  luck: number,
  suppressed_a: GeneGroup | null,
  suppressed_b: GeneGroup | null,
  dominant_a: GeneGroup | null,
  dominant_b: GeneGroup | null,
  out: Float64Array,
) {
  const sa = a.special ?? NO_SPECIAL;
  const sb = b.special ?? NO_SPECIAL;
  const k = special_chance;
  const traits = [
    trait_points(
      sa.morph,
      sb.morph,
      'normal',
      MORPH_POINTS[sa.morph],
      MORPH_POINTS[sb.morph],
      spont_variant_points<Morph>(WILD_CHANCES.morph, MORPH_POINTS, k),
      suppressed_a === 'morph',
      suppressed_b === 'morph',
      dominant_a === 'morph',
      dominant_b === 'morph',
    ),
    trait_points(
      sa.pattern,
      sb.pattern,
      'none',
      1,
      1,
      spont_points(1, WILD_CHANCES.pattern * k),
      suppressed_a === 'pattern',
      suppressed_b === 'pattern',
      dominant_a === 'pattern',
      dominant_b === 'pattern',
    ),
    trait_points(
      sa.ornament,
      sb.ornament,
      'none',
      2,
      2,
      spont_points(2, WILD_CHANCES.ornament * k),
      suppressed_a === 'ornament',
      suppressed_b === 'ornament',
      dominant_a === 'ornament',
      dominant_b === 'ornament',
    ),
    trait_points(
      sa.aura,
      sb.aura,
      false,
      5,
      5,
      spont_points(5, WILD_CHANCES.aura * k),
      suppressed_a === 'aura',
      suppressed_b === 'aura',
      dominant_a === 'aura',
      dominant_b === 'aura',
    ),
    trait_points(
      sa.eyes,
      sb.eyes,
      'normal',
      EYES_POINTS[sa.eyes],
      EYES_POINTS[sb.eyes],
      spont_variant_points<Eyes>(WILD_CHANCES.eyes, EYES_POINTS, k),
      suppressed_a === 'eyes',
      suppressed_b === 'eyes',
      dominant_a === 'eyes',
      dominant_b === 'eyes',
    ),
    trait_points(
      sa.trail,
      sb.trail,
      'none',
      TRAIL_POINTS,
      TRAIL_POINTS,
      spont_points(TRAIL_POINTS, WILD_CHANCES.trail * k),
      suppressed_a === 'trail',
      suppressed_b === 'trail',
      dominant_a === 'trail',
      dominant_b === 'trail',
    ),
  ];
  let score = new Float64Array(MAX_SCORE + 1);
  score[0] = 1;
  for (const trait of traits) {
    const next = new Float64Array(MAX_SCORE + 1);
    for (let s = 0; s <= MAX_SCORE; s++)
      for (let p = 0; p <= MAX_TRAIT_POINTS && s + p <= MAX_SCORE; p++)
        next[s + p]! += score[s]! * trait[p]!;
    score = next;
  }
  out.fill(0);
  let below = 0;
  for (let s = 0; s <= MAX_SCORE; s++) {
    const upto = below + score[s]!;
    const chance = (1 - luck) * score[s]! + luck * (upto * upto - below * below);
    out[RARITY_ORDER.indexOf(rarity_of_score(s))]! += chance;
    below = upto;
  }
}

export type NumKey = Exclude<keyof BirdGenes, 'special'>;
const GENE_KEYS: readonly NumKey[] = [
  'size',
  'form',
  'tail',
  'beak',
  'crest',
  'hue',
  'sat',
  'val',
  'belly_hue_shift',
  'belly_light',
  'wing_hue_shift',
];
const is_hue_key = (key: NumKey) =>
  key === 'hue' || key === 'belly_hue_shift' || key === 'wing_hue_shift';

export type TraitGroup = 'morph' | 'pattern' | 'ornament' | 'aura' | 'eyes' | 'trail';

export type GeneGroup =
  | TraitGroup
  | 'size'
  | 'form'
  | 'tail'
  | 'beak'
  | 'crest'
  | 'body_color'
  | 'belly_color'
  | 'wing_color';

export const GENE_GROUP_KEYS: Record<GeneGroup, readonly NumKey[]> = {
  morph: [],
  pattern: [],
  ornament: [],
  aura: [],
  eyes: [],
  trail: [],
  size: ['size'],
  form: ['form'],
  tail: ['tail'],
  beak: ['beak'],
  crest: ['crest'],
  body_color: ['hue', 'sat', 'val'],
  belly_color: ['belly_hue_shift', 'belly_light'],
  wing_color: ['wing_hue_shift'],
};

export const GENE_GROUPS = Object.keys(GENE_GROUP_KEYS) as GeneGroup[];

export const has_trait = (special: SpecialTraits, group: TraitGroup) => {
  switch (group) {
    case 'morph':
      return special.morph !== 'normal';
    case 'pattern':
      return special.pattern !== 'none';
    case 'ornament':
      return special.ornament !== 'none';
    case 'aura':
      return special.aura;
    case 'eyes':
      return special.eyes !== 'normal';
    case 'trail':
      return special.trail !== 'none';
  }
};

const is_trait_group = (group: GeneGroup): group is TraitGroup =>
  group === 'morph' ||
  group === 'pattern' ||
  group === 'ornament' ||
  group === 'aura' ||
  group === 'eyes' ||
  group === 'trail';

export const can_suppress = (g: BirdGenes, group: GeneGroup) =>
  is_trait_group(group) ? has_trait(g.special ?? NO_SPECIAL, group) : true;

const NO_SUPPRESSED: readonly NumKey[] = [];

const suppressed_keys = (group: GeneGroup | null) =>
  group === null ? NO_SUPPRESSED : GENE_GROUP_KEYS[group];

function impose_suppressed(
  child: BirdGenes,
  a: Readonly<BirdGenes>,
  b: Readonly<BirdGenes>,
  suppressed_a: GeneGroup | null,
  suppressed_b: GeneGroup | null,
) {
  const keys_a = suppressed_keys(suppressed_a);
  const keys_b = suppressed_keys(suppressed_b);

  for (const key of keys_a) if (!keys_b.includes(key)) child[key] = b[key];
  for (const key of keys_b) if (!keys_a.includes(key)) child[key] = a[key];
}

function impose_dominant(
  child: BirdGenes,
  a: Readonly<BirdGenes>,
  b: Readonly<BirdGenes>,
  dominant_a: GeneGroup | null,
  dominant_b: GeneGroup | null,
) {
  const keys_a = suppressed_keys(dominant_a);
  const keys_b = suppressed_keys(dominant_b);

  for (const key of keys_a) if (!keys_b.includes(key)) child[key] = a[key];
  for (const key of keys_b) if (!keys_a.includes(key)) child[key] = b[key];
}

function locked_source(
  group: GeneGroup,
  suppressed_a: GeneGroup | null,
  suppressed_b: GeneGroup | null,
  dominant_a: GeneGroup | null,
  dominant_b: GeneGroup | null,
): number {
  const win_a = dominant_a === group;
  const win_b = dominant_b === group;
  if (win_a !== win_b) return win_a ? 1 : 2;
  if (win_a) return 0;
  const lose_a = suppressed_a === group;
  const lose_b = suppressed_b === group;
  if (lose_a !== lose_b) return lose_a ? 2 : 1;
  return 0;
}

function align_shift(
  child: BirdGenes,
  src: Readonly<BirdGenes>,
  key: 'belly_hue_shift' | 'wing_hue_shift',
) {
  child[key] = mod(src.hue + src[key] - child.hue, 360);
}

export function impose_locked(
  child: BirdGenes,
  a: Readonly<BirdGenes>,
  b: Readonly<BirdGenes>,
  suppressed_a: GeneGroup | null,
  suppressed_b: GeneGroup | null,
  dominant_a: GeneGroup | null,
  dominant_b: GeneGroup | null,
) {
  impose_suppressed(child, a, b, suppressed_a, suppressed_b);
  impose_dominant(child, a, b, dominant_a, dominant_b);

  const belly = locked_source('belly_color', suppressed_a, suppressed_b, dominant_a, dominant_b);
  const wing = locked_source('wing_color', suppressed_a, suppressed_b, dominant_a, dominant_b);

  if (belly !== 0) align_shift(child, belly === 1 ? a : b, 'belly_hue_shift');
  if (wing !== 0) align_shift(child, wing === 1 ? a : b, 'wing_hue_shift');
}

export const GENE_STEP = 0.05;
export const HUE_STEP = 5;

function snap(v: number, step: number, rng?: Rng): number {
  const x = v / step;
  const lo = Math.floor(x);
  return (rng ? lo + (rng() < x - lo ? 1 : 0) : Math.round(x)) * step;
}

function snap_genes(g: BirdGenes, rng?: Rng): BirdGenes {
  for (const key of GENE_KEYS) {
    if (key === 'hue') g.hue = mod(snap(g.hue, HUE_STEP, rng), 360);
    else if (is_hue_key(key)) g[key] = snap(g[key], HUE_STEP, rng);
    else g[key] = clamp01(snap(g[key], GENE_STEP, rng));
  }
  const sp = g.special;
  if (sp)
    g.special = make_special(
      sp.morph,
      sp.pattern,
      sp.ornament,
      sp.aura,
      mod(snap(sp.aura_hue, HUE_STEP, rng), 360),
      sp.eyes,
      mod(snap(sp.eye_hue, HUE_STEP, rng), 360),
      sp.trail,
    );
  return g;
}

const BODY_KEYS: readonly NumKey[] = ['size', 'form', 'tail', 'beak', 'crest'];
const PLUMAGE_KEYS: readonly NumKey[] = [
  'hue',
  'sat',
  'val',
  'belly_hue_shift',
  'belly_light',
  'wing_hue_shift',
];

type Mutation = {
  body_min: number;
  body_max: number;
  plumage_min: number;
  plumage_max: number;
  extra_max: number;
  extra_half_breeds: number;
  spread: number;
  sat_min: number;
  val_min: number;
  special_chance: number;
};

const int_between = (rng: Rng, min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

function pick_keys(
  keys: readonly NumKey[],
  skip: readonly NumKey[],
  min: number,
  max: number,
  extra_max: number,
  extra_chance: number,
  rng: Rng,
): NumKey[] {
  const pool = keys.filter(key => !skip.includes(key));
  let count = int_between(rng, min, max);

  for (let i = 0; i < extra_max; i++) {
    if (rng() < extra_chance) {
      count++;
    }
  }

  count = Math.min(pool.length, count);
  shuffle_in_place(pool, count, rng);

  return pool.slice(0, count);
}

const gene_range = (key: NumKey) => (is_hue_key(key) ? 360 : 1);

function mutate_gene(key: NumKey, rng: Rng, M: Mutation): number {
  if (key === 'sat') return M.sat_min + rng() * (1 - M.sat_min);
  if (key === 'val') return M.val_min + rng() * (1 - M.val_min);
  return rng() * gene_range(key);
}

function average_gene(key: NumKey, va: number, vb: number, t: number, rng: Rng, M: Mutation) {
  const spread = (rng() * 2 - 1) * M.spread * gene_range(key);

  if (is_hue_key(key)) {
    const d = mod(vb - va + 180, 360) - 180;

    return mod(va + d * t + spread, 360);
  }

  return clamp01(va + (vb - va) * t + spread);
}

export function mix_genes(
  a: BirdGenes,
  b: BirdGenes,
  t: number,
  rng: Rng,
  mutation: Mutation,
  extra_chance: number,
  luck: number,
  suppressed_a: GeneGroup | null,
  suppressed_b: GeneGroup | null,
  dominant_a: GeneGroup | null,
  dominant_b: GeneGroup | null,
  base_shift: number,
): BirdGenes {
  const { extra_max } = mutation;
  const body_min = Math.max(0, mutation.body_min + base_shift);
  const body_max = Math.max(0, mutation.body_max + base_shift);
  const plumage_min = Math.max(0, mutation.plumage_min + base_shift);
  const plumage_max = Math.max(0, mutation.plumage_max + base_shift);
  const child = make_genes({});
  const keys_a = suppressed_keys(suppressed_a);
  const keys_b = suppressed_keys(suppressed_b);
  const win_a = suppressed_keys(dominant_a);
  const win_b = suppressed_keys(dominant_b);
  const skip = [...keys_a, ...keys_b, ...win_a, ...win_b];
  const mutated = [
    ...pick_keys(BODY_KEYS, skip, body_min, body_max, extra_max, extra_chance, rng),
    ...pick_keys(PLUMAGE_KEYS, skip, plumage_min, plumage_max, extra_max, extra_chance, rng),
    ...keys_a.filter(key => keys_b.includes(key)),
    ...win_a.filter(key => win_b.includes(key)),
  ];
  for (const key of GENE_KEYS) {
    child[key] = mutated.includes(key)
      ? mutate_gene(key, rng, mutation)
      : average_gene(key, a[key], b[key], t, rng, mutation);
  }
  const chance = mutation.special_chance;
  const roll = () =>
    inherit_special(
      a.special,
      b.special,
      rng,
      chance,
      suppressed_a,
      suppressed_b,
      dominant_a,
      dominant_b,
    );
  let sp = roll();
  if (rng() < luck) {
    const again = roll();
    if (special_score(again) > special_score(sp)) sp = again;
  }
  if (special_score(sp) > 0) child.special = sp;
  else delete child.special;
  snap_genes(child, rng);
  impose_locked(child, a, b, suppressed_a, suppressed_b, dominant_a, dominant_b);
  return child;
}

interface BirdPose {
  breathe: number;
  blink: number;
  head_dx: number;
  head_dy: number;
  head_flip: boolean;
  lean: number;
  squash: number;
  lift: number;
  wing_lift: number;
  tail_angle: number;
  beak_open: number;
  crest_raise: number;
  sway: number;
  fx_phase: number;
}

__opt_remember_shape<BirdPose>({
  breathe: 0.5,
  blink: 0.5,
  head_dx: 0.5,
  head_dy: 0.5,
  head_flip: false,
  lean: 0.5,
  squash: 0.5,
  lift: 0.5,
  wing_lift: 0.5,
  tail_angle: 0.5,
  beak_open: 0.5,
  crest_raise: 0.5,
  sway: 0.5,
  fx_phase: 0.5,
});

const REST_POSE: Readonly<BirdPose> = {
  breathe: 0,
  blink: 0,
  head_dx: 0,
  head_dy: 0,
  head_flip: false,
  lean: 0,
  squash: 0,
  lift: 0,
  wing_lift: 0,
  tail_angle: 0,
  beak_open: 0,
  crest_raise: 0,
  sway: 0,
  fx_phase: 0,
};

function make_pose(p: Partial<BirdPose>): BirdPose {
  return {
    breathe: p.breathe ?? REST_POSE.breathe,
    blink: p.blink ?? REST_POSE.blink,
    head_dx: p.head_dx ?? REST_POSE.head_dx,
    head_dy: p.head_dy ?? REST_POSE.head_dy,
    head_flip: p.head_flip ?? REST_POSE.head_flip,
    lean: p.lean ?? REST_POSE.lean,
    squash: p.squash ?? REST_POSE.squash,
    lift: p.lift ?? REST_POSE.lift,
    wing_lift: p.wing_lift ?? REST_POSE.wing_lift,
    tail_angle: p.tail_angle ?? REST_POSE.tail_angle,
    beak_open: p.beak_open ?? REST_POSE.beak_open,
    crest_raise: p.crest_raise ?? REST_POSE.crest_raise,
    sway: p.sway ?? REST_POSE.sway,
    fx_phase: p.fx_phase ?? REST_POSE.fx_phase,
  };
}

const pose_with_layers = (
  base: Readonly<BirdPose>,
  breathe: number,
  blink: number,
  sway: number,
  fx_phase: number,
): BirdPose => ({
  breathe,
  blink,
  head_dx: base.head_dx,
  head_dy: base.head_dy,
  head_flip: base.head_flip,
  lean: base.lean,
  squash: base.squash,
  lift: base.lift,
  wing_lift: base.wing_lift,
  tail_angle: base.tail_angle,
  beak_open: base.beak_open,
  crest_raise: base.crest_raise,
  sway,
  fx_phase,
});

const LAYER_SPACE = 512;
const MAX_BASE_POSES = 4096;
const POSE_CODE_SPACE = MAX_BASE_POSES * LAYER_SPACE;

const strip_layers = (p: BirdPose): BirdPose => pose_with_layers(p, 0, 0, 0, 0);

const base_poses: BirdPose[] = [strip_layers(make_pose({}))];
const base_pose_ids = new Map<string, number>([['', 0]]);

function base_pose_string(p: BirdPose): string {
  const q = (v: number) => Math.round(v * 1000);
  return [
    q(p.head_dx),
    q(p.head_dy),
    p.head_flip ? 1 : 0,
    q(p.lean),
    q(p.squash),
    q(p.lift),
    q(p.wing_lift),
    q(p.tail_angle),
    q(p.beak_open),
    q(p.crest_raise),
  ].join('.');
}

export function intern_pose(p: Partial<BirdPose>): number {
  const full = strip_layers(make_pose(p));
  const key = base_pose_string(full);
  const rest_key = base_pose_string(REST_POSE);
  if (key === rest_key) return 0;
  const known = base_pose_ids.get(key);
  if (known !== undefined) return known;
  if (base_poses.length >= MAX_BASE_POSES) throw new Error('bird_gen: too many unique base poses');
  const id = base_poses.length;
  base_poses.push(full);
  base_pose_ids.set(key, id);
  return id;
}

export function pose_code(
  base_id: number,
  breathe: 0 | 1,
  blink: 0 | 1,
  phase8: number,
  sway_index: number,
): number {
  return (
    base_id * LAYER_SPACE +
    ((breathe << 8) | (blink << 7) | ((phase8 & 7) << 4) | (sway_index & 15))
  );
}

export const is_rest_code = (code: number): boolean => code < LAYER_SPACE;

export const pose_table_hash = (): string => hash_text(JSON.stringify(base_poses)).toString(36);

const POSE_FIELDS = 14;

export function pack_poses(poses: readonly Readonly<BirdPose>[]): Float64Array {
  const out = new Float64Array(poses.length * POSE_FIELDS);
  for (let i = 0; i < poses.length; i++) {
    const p = poses[i]!,
      o = i * POSE_FIELDS;
    out[o] = p.breathe;
    out[o + 1] = p.blink;
    out[o + 2] = p.head_dx;
    out[o + 3] = p.head_dy;
    out[o + 4] = p.head_flip ? 1 : 0;
    out[o + 5] = p.lean;
    out[o + 6] = p.squash;
    out[o + 7] = p.lift;
    out[o + 8] = p.wing_lift;
    out[o + 9] = p.tail_angle;
    out[o + 10] = p.beak_open;
    out[o + 11] = p.crest_raise;
    out[o + 12] = p.sway;
    out[o + 13] = p.fx_phase;
  }
  return out;
}

export const packed_pose_count = (packed: Float64Array): number => packed.length / POSE_FIELDS;

export function unpack_pose(packed: Float64Array, i: number): BirdPose {
  const o = i * POSE_FIELDS;
  return {
    breathe: packed[o]!,
    blink: packed[o + 1]!,
    head_dx: packed[o + 2]!,
    head_dy: packed[o + 3]!,
    head_flip: packed[o + 4] === 1,
    lean: packed[o + 5]!,
    squash: packed[o + 6]!,
    lift: packed[o + 7]!,
    wing_lift: packed[o + 8]!,
    tail_angle: packed[o + 9]!,
    beak_open: packed[o + 10]!,
    crest_raise: packed[o + 11]!,
    sway: packed[o + 12]!,
    fx_phase: packed[o + 13]!,
  };
}

const decoded_poses = new Map<number, BirdPose>();

export function decode_pose(code: number): Readonly<BirdPose> {
  const known = decoded_poses.get(code);
  if (known) return known;
  const base = base_poses[Math.floor(code / LAYER_SPACE)] ?? REST_POSE;
  const layers = code % LAYER_SPACE;
  const pose = pose_with_layers(
    base,
    (layers >> 8) & 1,
    (layers >> 7) & 1,
    (layers & 15) / 4 - 1,
    ((layers >> 4) & 7) / 8,
  );
  if (decoded_poses.size > 50000) decoded_poses.clear();
  decoded_poses.set(code, pose);
  return pose;
}

function hsv(h: number, s: number, v: number): RGBA {
  return okhsv_to_rgb(h, s, v);
}

type Tones = [RGBA, RGBA, RGBA, RGBA, RGBA];
interface Ramp {
  t: Tones;
  outline: RGBA;
  soft: RGBA;
}

const tone_color = (r: Ramp, tn: number): RGBA => r.t[tn] ?? r.t[2];

function ramp(h: number, s: number, v: number): Ramp {
  return {
    t: [
      hsv(h - 12, s * 0.5, Math.min(1, v * 1.15 + 0.12)),
      hsv(h - 6, s * 0.78, Math.min(1, v * 1.07 + 0.05)),
      hsv(h, s, v),
      hsv(h + 8, Math.min(1, s + 0.06), v * 0.8),
      hsv(h + 16, Math.min(1, s + 0.12), v * 0.62),
    ],
    outline: hsv(h + 20, Math.min(1, s * 0.85 + 0.25), v * 0.3),
    soft: hsv(h + 18, Math.min(1, s * 0.85 + 0.2), v * 0.45),
  };
}

const ramp_of = (t: Tones, outline: RGBA, soft: RGBA): Ramp => ({ t, outline, soft });

const sheen = (h: number): Ramp =>
  ramp_of(
    [
      hsv(h, 0.65, 0.88),
      hsv(h + 15, 0.6, 0.56),
      hsv(h + 35, 0.3, 0.3),
      hsv(h + 40, 0.25, 0.21),
      hsv(h + 40, 0.25, 0.14),
    ],
    hsv(h + 40, 0.3, 0.06),
    hsv(h + 40, 0.3, 0.11),
  );

const gold = (dv: number): Ramp =>
  ramp_of(
    [
      [255, 250, 226, 255],
      hsv(96, 0.45, 1),
      hsv(85, 0.86, 0.94 - dv),
      hsv(65, 0.91, 0.75 - dv),
      hsv(47, 0.93, 0.53 - dv),
    ],
    hsv(42, 0.88, 0.27),
    hsv(43, 0.91, 0.38),
  );

interface Palette {
  body: Ramp;
  belly: Ramp;
  wing: Ramp;
  crest: Ramp;
  beak: Ramp;
  leg: Ramp;
  pattern: Ramp;
  eye: RGBA;
  eye_hi: RGBA;
  eye_ring: RGBA;
}

const palette_of = (
  body: Ramp,
  belly: Ramp,
  wing: Ramp,
  crest: Ramp,
  beak: Ramp,
  leg: Ramp,
  pattern: Ramp,
  eye: RGBA,
  eye_hi: RGBA,
  eye_ring: RGBA,
): Palette => ({ body, belly, wing, crest, beak, leg, pattern, eye, eye_hi, eye_ring });

function normal_palette(g: BirdGenes): Palette {
  const { hue: h, sat: s, val: v } = g;
  const bh = h + g.belly_hue_shift,
    wh = h + g.wing_hue_shift,
    bl = g.belly_light;
  const pat = g.special?.pattern ?? 'none';
  return palette_of(
    ramp(h, s, v),
    ramp(bh, s * (1 - 0.65 * bl), Math.min(1, v + 0.25 * bl)),
    ramp(wh + 6, Math.min(1, s + 0.1), v * 0.72),
    ramp(h - 25, Math.min(1, s + 0.1), Math.min(1, v * 1.05)),
    g.beak < 0.75 ? ramp(70, 0.88, 0.95) : ramp(92, 0.43, 0.8),
    ramp(48, 0.4, 0.68),
    pat === 'cap'
      ? ramp(h + 180, 0.7, 0.82)
      : ramp(h + 15, Math.min(1, s + 0.15), Math.max(0.14, v * 0.38)),
    [22, 18, 30, 255],
    [255, 255, 255, 255],
    hsv(h, s * 0.22, Math.min(1, v * 0.4 + 0.6)),
  );
}

export type PlumageColors = Readonly<Record<'body' | 'belly' | 'wing' | 'crest', RGBA>>;

const plumage_by_genes = new WeakMap<BirdGenes, PlumageColors>();

export function plumage_colors(g: BirdGenes): PlumageColors {
  const known = plumage_by_genes.get(g);
  if (known !== undefined) return known;
  const P = make_palette(g);
  const colors = {
    body: tone_color(P.body, 2),
    belly: tone_color(P.belly, 2),
    wing: tone_color(P.wing, 2),
    crest: tone_color(P.crest, 2),
  };
  plumage_by_genes.set(g, colors);
  return colors;
}

const special_eye = (sp: SpecialTraits, second: boolean): RGBA =>
  sp.eyes === 'glowing'
    ? hsv(sp.eye_hue, 0.5, 1)
    : hsv(mod(sp.eye_hue + (second ? 150 : 0), 360), 0.75, 0.85);

function make_palette(g: BirdGenes): Palette {
  const P = morph_palette(g);
  const sp = g.special ?? NO_SPECIAL;
  if (sp.eyes === 'normal') return P;
  return palette_of(
    P.body,
    P.belly,
    P.wing,
    P.crest,
    P.beak,
    P.leg,
    P.pattern,
    special_eye(sp, false),
    P.eye_hi,
    P.eye_ring,
  );
}

export type EyeColors = { readonly from: number; readonly to: number; readonly glowing: boolean };

const NO_EYE_COLORS: EyeColors = { from: 0, to: 0, glowing: false };

const pack_rgba = (c: RGBA) => (c[0] | (c[1] << 8) | (c[2] << 16) | (c[3] << 24)) >>> 0;

const eyes_by_genes = new WeakMap<BirdGenes, EyeColors>();

export function eye_colors(g: BirdGenes): EyeColors {
  const sp = g.special ?? NO_SPECIAL;
  if (sp.eyes === 'normal') return NO_EYE_COLORS;
  const known = eyes_by_genes.get(g);
  if (known !== undefined) return known;
  const from = pack_rgba(special_eye(sp, false));
  const colors: EyeColors = {
    from,
    to: sp.eyes === 'heterochromia' ? pack_rgba(special_eye(sp, true)) : from,
    glowing: sp.eyes === 'glowing',
  };
  eyes_by_genes.set(g, colors);
  return colors;
}

function morph_palette(g: BirdGenes): Palette {
  const { hue: h, sat: s, val: v } = g;
  const bh = h + g.belly_hue_shift,
    wh = h + g.wing_hue_shift;
  const base = normal_palette(g);
  switch ((g.special ?? NO_SPECIAL).morph) {
    case 'leucistic':
      return palette_of(
        ramp(h, s * 0.3, Math.min(1, v * 0.45 + 0.55)),
        ramp(bh, s * 0.15, 1),
        ramp(wh + 6, s * 0.35, Math.min(1, v * 0.4 + 0.48)),
        ramp(h - 25, s * 0.35, Math.min(1, v * 0.45 + 0.55)),
        base.beak,
        base.leg,
        ramp(h, s * 0.4, 0.62),
        base.eye,
        base.eye_hi,
        base.eye_ring,
      );
    case 'albino':
      return palette_of(
        ramp(85, 0.04, 0.98),
        ramp(81, 0.02, 1),
        ramp(74, 0.05, 0.91),
        ramp(85, 0.04, 0.98),
        ramp(8, 0.33, 0.98),
        ramp(9, 0.4, 0.92),
        ramp(83, 0.06, 0.86),
        [190, 28, 60, 255],
        base.eye_hi,
        hsv(8, 0.34, 1),
      );
    case 'melanistic':
      return palette_of(
        sheen(h),
        sheen(h + 30),
        sheen(h + 15),
        sheen(h - 20),
        ramp(267, 0.11, 0.43),
        ramp(264, 0.08, 0.39),
        sheen(h + 160),
        base.eye,
        base.eye_hi,
        hsv(h, 0.5, 0.6),
      );
    case 'golden':
      return palette_of(
        gold(0),
        gold(-0.05),
        gold(0.08),
        gold(-0.03),
        base.beak,
        base.leg,
        ramp_of(
          [
            hsv(61, 0.86, 0.72),
            hsv(51, 0.89, 0.56),
            hsv(46, 0.92, 0.43),
            hsv(44, 0.9, 0.34),
            hsv(42, 0.88, 0.27),
          ],
          hsv(39, 0.84, 0.19),
          hsv(42, 0.89, 0.3),
        ),
        base.eye,
        base.eye_hi,
        base.eye_ring,
      );
    default:
      return base;
  }
}

const enum L {
  EMPTY,
  TAIL,
  LEG,
  LEG_FAR,
  BODY,
  BELLY,
  WING,
  HEAD,
  BEAK,
  CREST,
  EYE,
  EYE_RING,
  EYE_HI,
  PATTERN,
  STREAMER,
  PLUME,
  SHADOW,
}

function set_point(poly: Float64Array, k: number, x: number, y: number) {
  poly[k * 2] = x;
  poly[k * 2 + 1] = y;
}

function set_turned_point(
  poly: Float64Array,
  k: number,
  x: number,
  y: number,
  ox: number,
  oy: number,
  cos_a: number,
  sin_a: number,
) {
  const dx = x - ox,
    dy = y - oy;
  set_point(poly, k, ox + (dx * cos_a - dy * sin_a), oy + (dx * sin_a + dy * cos_a));
}

function point_in_poly(x: number, y: number, poly: Float64Array): boolean {
  const n = poly.length;
  let inside = false;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
    const xi = poly[i]!,
      yi = poly[i + 1]!,
      xj = poly[j]!,
      yj = poly[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}

const on_leg = (px: number, py: number, lx: number, body_bottom: number, ground: number) =>
  (px - lx > -1.01 && px - lx < 0.99 && py >= body_bottom - 2 && py <= ground + 1) ||
  (py >= ground && py <= ground + 1 && px >= lx - 2.5 && px <= lx + 3.5);

const world_x = (cx: number, ct: number, st: number, lx: number, ly: number) =>
  cx + lx * ct + ly * st;
const world_y = (cy: number, ct: number, st: number, lx: number, ly: number) =>
  cy - lx * st + ly * ct;

function split_at(a: number, a0: number, b0: number, a1: number, b1: number): number {
  const f = clamp((a - a0) / (a1 - a0), 0, 1);
  return b0 + (b1 - b0) * f;
}

function scallop(u: number, v: number, row_h: number, col_w: number): 0 | 1 | 2 {
  const row = Math.floor(v / row_h);
  const cu = mod(u + (row & 1) * col_w * 0.5, col_w) - col_w / 2;
  const cv = v - row * row_h;
  const edge = row_h - 1 - ((2 * cu) / col_w) ** 2 * row_h * 0.6;
  if (cv >= edge && cv < edge + 1) return 2;
  if (cv >= edge - 1 && cv < edge) return 1;
  return 0;
}

const shade_tone = (sh: number) =>
  sh < -0.78 ? 0 : sh < -0.38 ? 1 : sh < 0.38 ? 2 : sh < 0.75 ? 3 : 4;

function mark_pattern(lab: Uint8Array, tone: Int8Array, i: number, mask: boolean) {
  lab[i] = L.PATTERN;
  tone[i] = mask ? 3 : clamp(tone[i]!, 1, 3);
}

function paint_bars(
  lab: Uint8Array,
  tone: Int8Array,
  cx: number,
  cy: number,
  ct: number,
  st: number,
  hy: number,
  hr: number,
  pivot_x: number,
  pivot_y: number,
) {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x,
        px = x + 0.5,
        py = y + 0.5,
        l = lab[i]!;
      const uy = (px - cx) * st + (py - cy) * ct;
      let hit = false;
      if (l === L.BELLY && py > hy + hr * 0.6) hit = mod(uy, 4) < 1.5;
      else if (l === L.TAIL) hit = mod(Math.hypot(px - pivot_x, py - pivot_y), 4) < 1.5;
      if (hit) mark_pattern(lab, tone, i, false);
    }
}

function paint_mask(
  lab: Uint8Array,
  tone: Int8Array,
  hx: number,
  hy: number,
  hr: number,
  fx: number,
  ex: number,
  ey: number,
  er: number,
) {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x,
        px = x + 0.5,
        py = y + 0.5,
        l = lab[i]!;
      if (l !== L.HEAD && l !== L.BELLY) continue;
      const dy = py - (ey + (px - ex) * fx * 0.12);
      if (Math.abs(dy) <= er + 1.3 && (px - hx) * fx > -hr * 0.95 && py < hy + hr * 0.6)
        mark_pattern(lab, tone, i, true);
    }
}

function paint_cap(
  lab: Uint8Array,
  tone: Int8Array,
  hx: number,
  hy: number,
  hr: number,
  fx: number,
) {
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x,
        px = x + 0.5,
        py = y + 0.5,
        l = lab[i]!;
      if ((l === L.HEAD || l === L.CREST) && py < hy - hr * 0.32 + (px - hx) * fx * 0.2)
        mark_pattern(lab, tone, i, false);
    }
}

function put_orn(
  lab: Uint8Array,
  tone: Int8Array,
  x: number,
  y: number,
  region: number,
  tn: number,
) {
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = y * N + x,
    l = lab[i]!;
  if (l === L.EMPTY || l === region) {
    lab[i] = region;
    tone[i] = Math.max(l === L.EMPTY ? 0 : tone[i]!, tn);
  }
}

function blob(
  lab: Uint8Array,
  tone: Int8Array,
  bcx: number,
  bcy: number,
  ra: number,
  rb: number,
  region: number,
) {
  for (let y = Math.floor(bcy - rb - 1); y <= bcy + rb + 1; y++)
    for (let x = Math.floor(bcx - ra - 1); x <= bcx + ra + 1; x++) {
      const d = Math.hypot((x + 0.5 - bcx) / ra, (y + 0.5 - bcy) / rb);
      if (d <= 1) put_orn(lab, tone, x, y, region, d < 0.5 ? 1 : d < 0.8 ? 2 : 4);
    }
}

const STREAMER_OFFSETS = [-0.16, 0.12];

function paint_streamers(
  lab: Uint8Array,
  tone: Int8Array,
  tip_x: number,
  tip_y: number,
  bx: number,
  by: number,
  tl: number,
  sway: number,
) {
  const d0 = Math.atan2(tip_y - by, tip_x - bx) + sway * 0.22;
  const ls = Math.min(9 * U, 3 * U + tl * 0.8);
  for (let k = 0; k < STREAMER_OFFSETS.length; k++) {
    const a = d0 + STREAMER_OFFSETS[k]! * (1 + 0.3 * sway);
    let end_x = tip_x,
      end_y = tip_y;
    for (let q = 0; q <= ls; q += 0.3) {
      end_x = tip_x + Math.cos(a) * q;
      end_y = tip_y + Math.sin(a) * q + 0.012 * q * q;
      put_orn(lab, tone, Math.floor(end_x), Math.floor(end_y), L.STREAMER, 4);
    }
    blob(lab, tone, end_x, end_y, 1.6, 2.3, L.STREAMER);
  }
}

function paint_plume(
  lab: Uint8Array,
  tone: Int8Array,
  hx: number,
  hy: number,
  hr: number,
  fx: number,
  sway: number,
) {
  const sx = hx + fx * hr * 0.15,
    sy = hy - hr * 0.85;
  const bend = hr * 0.9 * (1 + 0.4 * sway);
  let end_x = sx,
    end_y = sy;
  for (let q = 0; q <= 1; q += 0.02) {
    end_x = sx + fx * bend * q * q;
    end_y = sy - hr * 1.3 * q;
    put_orn(lab, tone, Math.floor(end_x), Math.floor(end_y), L.PLUME, 4);
  }
  const r = Math.max(1.6, hr * 0.28);
  blob(lab, tone, end_x + fx * r * 0.5, end_y + r * 0.2, r * 1.1, r * 0.8, L.PLUME);
}

function paint_pattern(
  lab: Uint8Array,
  tone: Int8Array,
  pattern: Pattern,
  cx: number,
  cy: number,
  ct: number,
  st: number,
  hx: number,
  hy: number,
  hr: number,
  fx: number,
  ex: number,
  ey: number,
  er: number,
  pivot_x: number,
  pivot_y: number,
) {
  switch (pattern) {
    case 'bars':
      paint_bars(lab, tone, cx, cy, ct, st, hy, hr, pivot_x, pivot_y);
      break;
    case 'mask':
      paint_mask(lab, tone, hx, hy, hr, fx, ex, ey, er);
      break;
    case 'cap':
      paint_cap(lab, tone, hx, hy, hr, fx);
      break;
  }
}

function paint_ornament(
  lab: Uint8Array,
  tone: Int8Array,
  ornament: Ornament,
  tip_x: number,
  tip_y: number,
  bx: number,
  by: number,
  tl: number,
  hx: number,
  hy: number,
  hr: number,
  fx: number,
  sway: number,
) {
  if (ornament === 'streamers') paint_streamers(lab, tone, tip_x, tip_y, bx, by, tl, sway);
  else if (ornament === 'plume') paint_plume(lab, tone, hx, hy, hr, fx, sway);
}

function paint_eye_closed(lab: Uint8Array, ex: number, ey: number, er: number) {
  const y = Math.floor(ey + er * 0.3);
  for (let x = Math.floor(ex - er); x <= ex + er; x++)
    if (x >= 0 && x < N && y >= 0 && y < N) lab[y * N + x] = L.EYE;
}

function paint_eye(
  lab: Uint8Array,
  closed: boolean,
  ex: number,
  ey: number,
  er: number,
  hr: number,
) {
  if (closed) paint_eye_closed(lab, ex, ey, er);
  else paint_eye_open(lab, ex, ey, er, hr);
}

function paint_eye_open(lab: Uint8Array, ex: number, ey: number, er: number, hr: number) {
  const ring = hr >= 6;
  for (let y = Math.floor(ey - er - 2); y <= ey + er + 2; y++)
    for (let x = Math.floor(ex - er - 2); x <= ex + er + 2; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const d = Math.hypot(x + 0.5 - ex, y + 0.5 - ey);
      const i = y * N + x,
        l = lab[i]!;
      if (d <= er) lab[i] = L.EYE;
      else if (ring && d <= er + 1 && (l === L.HEAD || l === L.BELLY)) lab[i] = L.EYE_RING;
    }
  const hi_x = Math.floor(ex + er * 0.35),
    hi_y = Math.floor(ey - er * 0.35);
  if (hi_x >= 0 && hi_y >= 0 && hi_x < N && hi_y < N && lab[hi_y * N + hi_x] === L.EYE)
    lab[hi_y * N + hi_x] = L.EYE_HI;
}

function paint_shadow(lab: Uint8Array, cx: number, rx0: number, lift: number) {
  if (lift <= 1.5) return;
  const sr = rx0 * 0.8 * Math.max(0.4, 1 - lift / 24);
  const shadow_cy = SPRITE_FEET_Y + 1.5;
  for (let y = SPRITE_FEET_Y; y <= SPRITE_FEET_Y + 2; y++)
    for (let x = Math.floor(cx - sr); x <= cx + sr + 2; x++) {
      if (x < 0 || x >= N || y >= N) continue;
      const i = y * N + x;
      if (
        lab[i] === L.EMPTY &&
        ((x + 0.5 - cx - 1) / sr) ** 2 + ((y + 0.5 - shadow_cy) / 1.6) ** 2 <= 1
      )
        lab[i] = L.SHADOW;
    }
}

interface Labels {
  lab: Uint8Array;
  tone: Int8Array;
  cx: number;
  cy: number;
  seed: number;
}

function build_labels(g: BirdGenes, fit: number, pose: BirdPose): Labels {
  const s = g.size,
    e = g.form;
  const sp = g.special ?? NO_SPECIAL;

  const R = (4.3 + 2.6 * s) * U * fit;
  const k = 0.92 + 1.05 * e;
  const rx0 = R * Math.sqrt(k),
    ry0 = R / Math.sqrt(k);
  const hr = Math.max(2.4 * U, R * (0.7 - 0.14 * e));
  const t = g.tail;
  const tl = R * (0.45 + 0.9 * Math.min(t, 0.5) * 2 * (0.6 + 0.4 * e));
  const b = g.beak;
  const bl = b <= 0.5 ? hr * (0.55 + 0.9 * Math.min(b, 0.5) * 2) : hr * (1.0 - 0.3 * (b - 0.5) * 2);
  const bt =
    b <= 0.5 ? hr * (0.42 - 0.18 * Math.min(b, 0.5) * 2) : hr * (0.38 + 0.1 * (b - 0.5) * 2);
  const hx_off = rx0 * (0.42 + 0.4 * e);
  const cx = N / 2 - (-rx0 * 0.85 - tl + hx_off + hr * 0.85 + bl) / 2;

  const sq = pose.squash,
    br = pose.breathe;
  const rx = rx0 * (1 + sq * 0.5) * (1 + 0.025 * br);
  const ry = ry0 * (1 - sq) * (1 + 0.06 * br);
  const leg = (1.0 + 1.6 * s + 2.2 * e) * U * (1 - 1.2 * Math.max(0, sq));
  const tilt = -0.05 - 0.22 * e + pose.lean;
  const ground = GROUND - pose.lift;
  const cy = ground - leg - ry * 0.95;
  const head_scale = hr / 8;

  const ct = Math.cos(tilt),
    st = Math.sin(tilt);

  const head_lx = hx_off,
    head_ly = -ry * 0.8 - hr * 0.45 * e;
  const hx = world_x(cx, ct, st, head_lx, head_ly) + pose.head_dx * head_scale,
    hy = world_y(cy, ct, st, head_lx, head_ly) + pose.head_dy * head_scale;
  const fx = pose.head_flip ? -1 : 1;

  const bx = world_x(cx, ct, st, -rx * 0.7, -ry * 0.05),
    by = world_y(cy, ct, st, -rx * 0.7, -ry * 0.05);
  const P1 = 1.5 * U;
  const cos_tail = Math.cos(pose.tail_angle),
    sin_tail = Math.sin(pose.tail_angle);
  const marks = new Float64Array(4);
  let tail: Float64Array;
  if (t <= 0.5) {
    const droop = 0.25 + 0.35 * e;
    const tw = ry * (0.55 - 0.15 * t);
    tail = new Float64Array(8);
    set_turned_point(tail, 0, bx + P1, by - tw, bx, by, cos_tail, sin_tail);
    set_turned_point(tail, 1, bx - tl, by + tl * droop - tw * 0.35, bx, by, cos_tail, sin_tail);
    set_turned_point(
      tail,
      2,
      bx - tl - 0.5 * U,
      by + tl * droop + tw * 0.45,
      bx,
      by,
      cos_tail,
      sin_tail,
    );
    set_turned_point(tail, 3, bx + P1, by + tw, bx, by, cos_tail, sin_tail);
    set_turned_point(marks, 0, bx - tl, by + tl * droop, bx, by, cos_tail, sin_tail);
  } else {
    const up = tl * (0.4 + 0.8 * (t - 0.5) * 2);
    tail = new Float64Array(10);
    set_turned_point(tail, 0, bx + P1, by + ry * 0.4, bx, by, cos_tail, sin_tail);
    set_turned_point(tail, 1, bx - tl * 0.9, by - up * 0.2, bx, by, cos_tail, sin_tail);
    set_turned_point(tail, 2, bx - tl * 0.75, by - up, bx, by, cos_tail, sin_tail);
    set_turned_point(tail, 3, bx - tl * 0.2, by - up * 0.9, bx, by, cos_tail, sin_tail);
    set_turned_point(tail, 4, bx + P1, by - ry * 0.3, bx, by, cos_tail, sin_tail);
    set_turned_point(marks, 0, bx - tl * 0.8, by - up * 0.9, bx, by, cos_tail, sin_tail);
  }
  set_turned_point(marks, 1, bx + 3 * U, by, bx, by, cos_tail, sin_tail);
  const tip_x = marks[0]!,
    tip_y = marks[1]!,
    pivot_x = marks[2]!,
    pivot_y = marks[3]!;
  const feather_step = 3.2 / Math.max(6, tl * 0.75);

  const beak_base_x = hx + fx * hr * 0.75,
    beak_y = hy + hr * 0.15;
  const hooked = b > 0.5;
  const beak_poly = !hooked
    ? Float64Array.of(-U, -bt, bl, bt * 0.15, -U, bt)
    : Float64Array.of(-U, -bt, bl * 0.75, -bt * 0.6, bl, bt * 0.5, bl * 0.7, bt * 0.2, -U, bt);
  const split_a0 = -U,
    split_b0 = bt * 0.25;
  const split_a1 = hooked ? bl * 0.7 : bl,
    split_b1 = hooked ? bt * 0.2 : bt * 0.15;
  const open_up = pose.beak_open * 0.2,
    open_down = pose.beak_open * 0.4;
  const cos_up = Math.cos(open_up),
    sin_up = Math.sin(open_up);
  const cos_down = Math.cos(-open_down),
    sin_down = Math.sin(-open_down);

  let crest: Float64Array | null = null;
  let crest_top = 0;
  if (g.crest > 0.15) {
    const ch = hr * (0.5 + 1.2 * g.crest) * (1 + 0.45 * pose.crest_raise);
    crest = new Float64Array(12);
    set_point(crest, 0, hx + fx * (hr * 0.45), hy + -hr * 0.6);
    set_point(crest, 1, hx + fx * (hr * 0.1), hy + (-hr * 0.9 - ch * 0.55));
    set_point(crest, 2, hx + fx * (-hr * 0.3 - ch * 0.4), hy + (-hr * 0.8 - ch));
    set_point(crest, 3, hx + fx * (-hr * 0.2 - ch * 0.2), hy + (-hr * 0.7 - ch * 0.45));
    set_point(crest, 4, hx + fx * (-hr * 0.9 - ch * 0.3), hy + (-hr * 0.5 - ch * 0.5));
    set_point(crest, 5, hx + fx * (-hr * 0.8), hy + -hr * 0.2);
    crest_top = hy - hr * 0.8 - ch;
  }

  const body_bottom = world_y(cy, ct, st, 0, ry * 0.9);
  const leg_far = Math.floor(cx) + 0.5;
  const leg_near = leg_far + Math.max(4, Math.round(R * 0.4));

  const wrx = rx * 0.7,
    wry = ry * 0.55;
  const wing_detail = wry >= 4;
  const cov_row = Math.max(3, Math.round(wry * 0.42)),
    cov_col = Math.max(4, Math.round(cov_row * 1.5));
  const prim_step = Math.max(3, Math.round(wry * 0.38));
  const shoulder_x = rx * 0.25,
    shoulder_y = -ry * 0.35;
  const wing_angle = pose.wing_lift * 1.3;
  const cos_wing = Math.cos(-wing_angle),
    sin_wing = Math.sin(-wing_angle);
  const wing_raised = pose.wing_lift > 0.05;
  const beak_closed = pose.beak_open < 0.1;
  const pattern = sp.pattern,
    ornament = sp.ornament,
    sway = pose.sway,
    eye_closed = pose.blink > 0.5,
    lift = pose.lift;

  const lab = new Uint8Array(N * N);
  const tone = new Int8Array(N * N);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x,
        px = x + 0.5,
        py = y + 0.5;
      let region: number = L.EMPTY;
      let sh = 0;

      if (point_in_poly(px, py, tail)) region = L.TAIL;
      if (on_leg(px, py, leg_far, body_bottom, ground)) region = L.LEG_FAR;
      if (on_leg(px, py, leg_near, body_bottom, ground)) region = L.LEG;

      const dx = px - cx,
        dy = py - cy;
      const ux = dx * ct - dy * st,
        uy = dx * st + dy * ct;
      const in_body = (ux / rx) ** 2 + (uy / ry) ** 2 <= 1;
      if (in_body) {
        region = L.BODY;
        sh = uy / ry - (0.35 * ux) / rx;
        if (uy > ry * 0.05 - ux * 0.35 && ux > -rx * 0.45) region = L.BELLY;
      }
      const sx = ux - shoulder_x,
        sy = uy - shoulder_y;
      const wux = sx * cos_wing - sy * sin_wing + shoulder_x,
        wuy = sx * sin_wing + sy * cos_wing + shoulder_y;
      const wx = wux + rx * 0.15,
        wy = wuy - ry * 0.08;
      let wing_tip = false;
      if ((wx / wrx) ** 2 + (wy / wry) ** 2 <= 1 && wx < wrx * 0.55 && (in_body || wing_raised)) {
        region = L.WING;
        sh = wy / wry;
      }
      if (
        (wx / (rx * 0.95)) ** 2 + (wy / (ry * 0.45)) ** 2 <= 1 &&
        wux < -rx * 0.5 &&
        wy > -ry * 0.2
      ) {
        region = L.WING;
        sh = 0.6;
        wing_tip = true;
      }

      let throat = false;
      if (((px - hx) / hr) ** 2 + ((py - hy) / hr) ** 2 <= 1) {
        region = L.HEAD;
        sh = (py - hy) / hr - (0.3 * (px - hx)) / hr;
        if (py - hy > hr * 0.35 && (px - hx) * fx > -hr * 0.1) {
          region = L.BELLY;
          throat = true;
        }
      }
      if (crest && point_in_poly(px, py, crest) && (region === L.EMPTY || region === L.HEAD))
        region = L.CREST;

      const ba = (px - beak_base_x) * fx,
        bb = py - beak_y;
      const sa = ba - split_a0,
        sb = bb - split_b0;
      const ua2 = sa * cos_up - sb * sin_up + split_a0,
        ub = sa * sin_up + sb * cos_up + split_b0,
        la2 = sa * cos_down - sb * sin_down + split_a0,
        lb = sa * sin_down + sb * cos_down + split_b0;
      let beak_tone = -1;
      if (
        point_in_poly(ua2, ub, beak_poly) &&
        ub < split_at(ua2, split_a0, split_b0, split_a1, split_b1) + 0.5
      ) {
        beak_tone = ub < -bt * 0.55 ? 0 : 1;
        const f = (ua2 - split_a0) / (split_a1 - split_a0);
        if (
          beak_closed &&
          bt >= 2.5 &&
          Math.abs(ub - split_at(ua2, split_a0, split_b0, split_a1, split_b1)) < 0.5 &&
          f > 0.25 &&
          f <= 1
        )
          beak_tone = 4;
        if (bl >= 5 && Math.abs(ua2 - bl * 0.12) < 0.5 && Math.abs(ub + bt * 0.4) < 0.5)
          beak_tone = 4;
      } else if (
        point_in_poly(la2, lb, beak_poly) &&
        lb >= split_at(la2, split_a0, split_b0, split_a1, split_b1) - 0.5
      ) {
        beak_tone = 3;
      }
      if (beak_tone >= 0) region = L.BEAK;

      lab[i] = region;

      switch (region) {
        case L.BODY:
        case L.HEAD:
          tone[i] = shade_tone(sh);
          break;
        case L.BELLY: {
          let tn = sh > 0.62 ? 3 : sh < -0.3 ? 1 : 2;
          if (!throat && ry >= 6 && scallop(px, py, 5, 7) === 2 && ((x + y) & 1) === 0)
            tn = Math.min(4, tn + 1);
          tone[i] = tn;
          break;
        }
        case L.WING: {
          let tn = sh < -0.45 ? 1 : sh < 0.4 ? 2 : 3;
          if (wing_detail) {
            if (!wing_tip && wx / wrx > -0.15 && wy < wry * 0.7) {
              const sc = scallop(wx, wy + wry, cov_row, cov_col);
              if (sc === 2) tn = 4;
              else if (sc === 1) tn = Math.max(0, tn - 1);
            } else if (mod(wy + wry, prim_step) < 1) {
              tn = 4;
            }
          }
          tone[i] = tn;
          break;
        }
        case L.TAIL: {
          const a = Math.atan2(py - pivot_y, px - pivot_x);
          let tn = 3;
          if (mod(a, feather_step) < feather_step / 3.2) tn = 4;
          else if (!point_in_poly(px + 2 * Math.cos(a), py + 2 * Math.sin(a), tail)) tn = 1;
          tone[i] = tn;
          break;
        }
        case L.BEAK:
          tone[i] = beak_tone;
          break;
        case L.CREST:
          tone[i] = py < crest_top + (hy - crest_top) * 0.35 ? 1 : py < hy - hr * 0.6 ? 2 : 3;
          break;
        case L.LEG:
        case L.LEG_FAR: {
          const lx = region === L.LEG ? leg_near : leg_far;
          let tn = px < lx ? 2 : 3;
          if (py < ground && (y & 1) === 0) tn += 1;
          if (region === L.LEG_FAR) tn += 1;
          tone[i] = Math.min(4, tn);
          break;
        }
      }
    }
  }

  for (let y = 1; y < N - 1; y++)
    for (let x = 1; x < N - 1; x++) {
      const i = y * N + x;
      if (lab[i] !== L.BEAK) continue;
      const behind = lab[i - fx];
      if (behind === L.HEAD || behind === L.BELLY) tone[i] = 3;
    }

  const ex = hx + fx * hr * 0.3,
    ey = hy - hr * 0.15;
  const er = Math.max(1.1, hr * 0.2);
  const seed = Math.floor(g.hue * 1000 + g.size * 7919 + g.form * 104729);

  paint_pattern(lab, tone, pattern, cx, cy, ct, st, hx, hy, hr, fx, ex, ey, er, pivot_x, pivot_y);
  paint_ornament(lab, tone, ornament, tip_x, tip_y, bx, by, tl, hx, hy, hr, fx, sway);
  paint_eye(lab, eye_closed, ex, ey, er, hr);
  paint_shadow(lab, cx, rx0, lift);

  return { lab, tone, cx, cy, seed };
}

function region_ramp(l: number, P: Palette): Ramp {
  switch (l) {
    case L.BELLY:
      return P.belly;
    case L.WING:
    case L.TAIL:
    case L.STREAMER:
      return P.wing;
    case L.CREST:
    case L.PLUME:
      return P.crest;
    case L.BEAK:
      return P.beak;
    case L.LEG:
    case L.LEG_FAR:
      return P.leg;
    case L.PATTERN:
      return P.pattern;
    default:
      return P.body;
  }
}

interface ColorCtx {
  g: BirdGenes;
  P: Palette;
  P2: Palette | null;
  iridescent: boolean;
  sunset: readonly Palette[] | null;
  cx: number;
  cy: number;
  seed: number;
  phase: number;
}

const SUNSET_SHIFT = -80;
const SUNSET_STEP = 10;
const SUNSET_HEAD = 6;
const SUNSET_SPAN = 26;

const sunset_by_genes = new WeakMap<BirdGenes, readonly Palette[]>();

function sunset_palettes(g: BirdGenes): readonly Palette[] {
  const known = sunset_by_genes.get(g);
  if (known !== undefined) return known;
  const sp = g.special ?? NO_SPECIAL;
  const plain = make_special(
    'normal',
    sp.pattern,
    sp.ornament,
    sp.aura,
    sp.aura_hue,
    sp.eyes,
    sp.eye_hue,
    sp.trail,
  );
  const steps = Math.abs(SUNSET_SHIFT / SUNSET_STEP);
  const palettes: Palette[] = [];
  for (let i = 0; i <= steps; i++)
    palettes.push(
      make_palette(genes_with(g, mod(g.hue + (SUNSET_SHIFT * i) / steps, 360), g.sat, plain)),
    );
  sunset_by_genes.set(g, palettes);
  return palettes;
}

const is_plumage = (l: number) => {
  switch (l) {
    case L.BODY:
    case L.HEAD:
    case L.WING:
    case L.TAIL:
    case L.CREST:
    case L.BELLY:
    case L.STREAMER:
    case L.PLUME:
      return true;
    default:
      return false;
  }
};

const iri_cache = new Map<number, Ramp>();
function iridescent_ramp(l: number, x: number, y: number, C: ColorCtx): Ramp | null {
  if (!is_plumage(l)) return null;
  const hq = Math.round(mod(C.g.hue + x * 5.5 + y * 2 + C.phase * 360, 360) / 10) * 10;
  const key = l * 1000 + hq;
  let r = iri_cache.get(key);
  if (!r) {
    r =
      l === L.BELLY
        ? ramp(hq + 30, 0.35, 1)
        : l === L.WING || l === L.TAIL || l === L.STREAMER
          ? ramp(hq + 20, 0.85, 0.72)
          : ramp(hq, 0.78, 0.92);
    iri_cache.set(key, r);
  }
  return r;
}

function ramp_at(l: number, x: number, y: number, C: ColorCtx): Ramp {
  if (C.iridescent) {
    const r = iridescent_ramp(l, x, y, C);
    if (r) return r;
  }
  if (C.sunset !== null && is_plumage(l)) {
    const k = clamp((C.cx + SUNSET_HEAD - x) / SUNSET_SPAN, 0, 1);
    return region_ramp(l, C.sunset[Math.round(k * (C.sunset.length - 1))]!);
  }
  const P = C.P2 && x + 0.5 - C.cx + (y + 0.5 - C.cy) * 0.35 < 0 ? C.P2 : C.P;
  return region_ramp(l, P);
}

const put = (out: Uint8ClampedArray, i: number, c: RGBA) => {
  const o = i * 4;
  out[o] = c[0];
  out[o + 1] = c[1];
  out[o + 2] = c[2];
  out[o + 3] = c[3];
};

const put_rgba = (
  out: Uint8ClampedArray,
  i: number,
  r: number,
  g: number,
  b: number,
  a: number,
) => {
  const o = i * 4;
  out[o] = r;
  out[o + 1] = g;
  out[o + 2] = b;
  out[o + 3] = a;
};

function solid(lab: Uint8Array, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= N || y >= N) return L.EMPTY;
  const l = lab[y * N + x]!;
  return l === L.LEG || l === L.LEG_FAR || l === L.STREAMER || l === L.PLUME || l === L.SHADOW
    ? L.EMPTY
    : l;
}

function colorize(labels: Labels, C: ColorCtx): Uint8ClampedArray {
  const { lab, tone } = labels;
  const { P } = C;
  const sp = C.g.special ?? NO_SPECIAL;
  const out = new Uint8ClampedArray(N * N * 4);
  const golden = sp.morph === 'golden';
  const aura = sp.aura,
    aura_hue = sp.aura_hue;
  const gold_seed = C.seed + 9 + Math.floor(C.phase * 8) * 31;

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = y * N + x,
        l = lab[i]!;
      if (l === L.EMPTY) continue;
      if (l === L.EYE) put(out, i, P.eye);
      else if (l === L.EYE_HI) put(out, i, P.eye_hi);
      else if (l === L.EYE_RING) put(out, i, P.eye_ring);
      else if (l === L.SHADOW) put(out, i, SHADOW_COLOR);
      else {
        let tn = tone[i]!;
        if (
          golden &&
          tn <= 2 &&
          (l === L.BODY || l === L.HEAD || l === L.WING) &&
          hash2(x, y, gold_seed) < 0.035
        )
          tn = 0;
        put(out, i, tone_color(ramp_at(l, x, y, C), tn));
      }
    }

  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const own = lab[y * N + x]!;
      if (own !== L.EMPTY && own !== L.SHADOW) continue;
      const below = solid(lab, x, y + 1);
      let side = solid(lab, x - 1, y);
      if (side === L.EMPTY) side = solid(lab, x + 1, y);
      if (side === L.EMPTY) side = solid(lab, x, y - 1);
      if (side !== L.EMPTY) put(out, y * N + x, ramp_at(side, x, y, C).outline);
      else if (below !== L.EMPTY) put(out, y * N + x, ramp_at(below, x, y, C).soft);
    }

  for (let y = 1; y < N; y++)
    for (let x = 0; x < N; x++) {
      const up = lab[(y - 1) * N + x]!;
      if (lab[y * N + x] === L.WING && (up === L.BODY || up === L.HEAD))
        put(out, y * N + x, ramp_at(L.WING, x, y, C).outline);
    }

  add_aura(out, aura, aura_hue, C.seed, C.phase);
  return out;
}

const STAR_DX = [1, -1, 0, 0];
const STAR_DY = [0, 0, 1, -1];

const alpha_at = (out: Uint8ClampedArray, x: number, y: number): number =>
  x < 0 || y < 0 || x >= N || y >= N ? 0 : out[(y * N + x) * 4 + 3]!;

function add_aura(out: Uint8ClampedArray, on: boolean, hue: number, seed: number, phase: number) {
  if (!on) return;
  const glow = hsv(hue, 0.55, 1);
  const glow_alpha = Math.round(105 + 45 * Math.cos(phase * TAU));
  const ring: number[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (alpha_at(out, x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1; dx++)
          if (alpha_at(out, x + dx, y + dy) === 255) {
            near = true;
            break;
          }
      if (near) ring.push(y * N + x);
    }
  for (let k = 0; k < ring.length; k++)
    put_rgba(out, ring[k]!, glow[0], glow[1], glow[2], glow_alpha);

  const star = hsv(hue, 0.35, 1);
  let placed = 0;
  for (let k = 0; k < 60 && placed < 6; k++) {
    const x = 3 + Math.floor(hash2(k, 1, seed) * (N - 6)),
      y = 3 + Math.floor(hash2(k, 2, seed) * (N - 8));
    let free = true;
    for (let dy = -3; dy <= 3 && free; dy++)
      for (let dx = -3; dx <= 3; dx++)
        if (alpha_at(out, x + dx, y + dy)) {
          free = false;
          break;
        }
    if (!free) continue;
    placed++;
    const v = mod(hash2(k, 4, seed) + phase, 1);
    if (v < 0.25) continue;
    const big = v > 0.5 && v < 0.8;
    put_rgba(out, y * N + x, 255, 255, 240, 255);
    for (let d = 0; d < 4; d++) {
      const dx = STAR_DX[d]!,
        dy = STAR_DY[d]!;
      put_rgba(out, (y + dy) * N + x + dx, star[0], star[1], star[2], 230);
      if (big) put_rgba(out, (y + 2 * dy) * N + x + 2 * dx, star[0], star[1], star[2], 110);
    }
  }
}

function touches_edge(px: Uint8ClampedArray): boolean {
  for (let k = 0; k < N; k++)
    if (
      alpha_at(px, 0, k) > 0 ||
      alpha_at(px, N - 1, k) > 0 ||
      alpha_at(px, k, 0) > 0 ||
      alpha_at(px, k, N - 1) > 0
    )
      return true;
  return false;
}

function special_key(sp: SpecialTraits, qh: (v: number) => number): string {
  const key = [sp.morph, sp.pattern, sp.ornament, sp.aura ? qh(sp.aura_hue) : '-'].join('/');
  if (sp.eyes === 'normal' && sp.trail === 'none') return key;
  return `${key}/${sp.eyes === 'normal' ? '-' : `${sp.eyes}:${qh(sp.eye_hue)}`}/${sp.trail}`;
}

export function genes_key(g: BirdGenes): string {
  const q = (v: number) => Math.round(v / GENE_STEP);
  const qh = (v: number) => Math.round(v / HUE_STEP);
  const sp = g.special;
  return [
    q(g.size),
    q(g.form),
    q(g.tail),
    q(g.beak),
    q(g.crest),
    qh(g.hue),
    q(g.sat),
    q(g.val),
    qh(g.belly_hue_shift),
    q(g.belly_light),
    qh(g.wing_hue_shift),
    sp ? special_key(sp, qh) : '',
  ].join(',');
}

const gene_ids_by_object = new WeakMap<BirdGenes, number>();
const gene_ids_by_key = new Map<string, number>();
let next_gene_id = 1;

function gene_id(g: BirdGenes): number {
  const known = gene_ids_by_object.get(g);
  if (known !== undefined) return known;
  const key = genes_key(g);
  let id = gene_ids_by_key.get(key);
  if (id === undefined) {
    id = next_gene_id++;
    gene_ids_by_key.set(key, id);
  }
  gene_ids_by_object.set(g, id);
  return id;
}

export const sprite_key = (gid: number, code: number): number => gid * POSE_CODE_SPACE + code;

function render_with(g: BirdGenes, fit: number, pose: Readonly<BirdPose>): Uint8ClampedArray {
  const P = make_palette(g);
  const sp = g.special ?? NO_SPECIAL;
  const P2 =
    sp.morph === 'chimera'
      ? make_palette(
          genes_with(
            g,
            mod(g.hue + 150, 360),
            Math.max(g.sat, 0.6),
            make_special(
              'normal',
              sp.pattern,
              sp.ornament,
              sp.aura,
              sp.aura_hue,
              sp.eyes,
              sp.eye_hue,
              sp.trail,
            ),
          ),
        )
      : null;
  const labels = build_labels(g, fit, pose);
  return colorize(labels, {
    g,
    P,
    P2,
    iridescent: sp.morph === 'iridescent',
    sunset: sp.morph === 'sunset' ? sunset_palettes(g) : null,
    cx: labels.cx,
    cy: labels.cy,
    seed: labels.seed,
    phase: pose.fx_phase,
  });
}

const fit_cache = new Map<number, number>();
function fit_for(g: BirdGenes): number {
  const gid = gene_id(g);
  const cached = fit_cache.get(gid);
  if (cached !== undefined) return cached;
  let fit = 1;
  for (let n = 0; n < 12; n++) {
    if (!touches_edge(render_with(g, fit, REST_POSE))) break;
    fit *= 0.97;
  }
  fit_cache.set(gid, fit);
  return fit;
}

export function render_bird_pixels(g: BirdGenes, pose: Readonly<BirdPose>): Uint8ClampedArray {
  return render_with(g, fit_for(g), pose);
}

export interface CacheEntry<T> {
  sprite: T;
  used: number;
  alive: boolean;
}

__opt_prepare_mutations(
  __opt_remember_shape<CacheEntry<null>>({ sprite: null, used: 0, alive: true }),
  ['used', 'alive'],
);

export class BirdSpriteCache<T> {
  private entries = new Map<number, CacheEntry<T>>();
  private tick = 0;
  max_entries: number;

  constructor(
    private min_entries: number,
    private on_evict: (sprite: T) => void,
  ) {
    this.max_entries = min_entries;
  }

  get size(): number {
    return this.entries.size;
  }

  reserve(n: number): void {
    this.max_entries = Math.max(this.min_entries, Math.ceil(n));
  }

  has_code(gid: number, code: number): boolean {
    return this.entries.has(gid * POSE_CODE_SPACE + code);
  }

  entry_by_code(gid: number, code: number): CacheEntry<T> | undefined {
    return this.entries.get(gid * POSE_CODE_SPACE + code);
  }

  touch(entry: CacheEntry<T>): void {
    entry.used = ++this.tick;
  }

  set_code(gid: number, code: number, sprite: T): void {
    const key = gid * POSE_CODE_SPACE + code;
    const old = this.entries.get(key);
    if (old) {
      old.alive = false;
      this.on_evict(old.sprite);
    }
    this.entries.set(key, { sprite, used: ++this.tick, alive: true });
    if (this.entries.size > this.max_entries) this.evict();
  }

  clear(): void {
    for (const e of this.entries.values()) {
      e.alive = false;
      this.on_evict(e.sprite);
    }
    this.entries.clear();
  }

  private evict(): void {
    const used: number[] = [];
    for (const e of this.entries.values()) used.push(e.used);
    used.sort((a, b) => a - b);
    const threshold = used[Math.floor(used.length / 4)] ?? 0;
    for (const [key, e] of this.entries) {
      if (e.used <= threshold) {
        e.alive = false;
        this.entries.delete(key);
        this.on_evict(e.sprite);
      }
    }
  }
}

interface ClipFrame {
  pose: Partial<BirdPose>;
  ms: number;
  turn?: boolean;
}

export type ActionName =
  | 'look'
  | 'peck'
  | 'hop'
  | 'flap'
  | 'preen'
  | 'sing'
  | 'tail_flick'
  | 'turn'
  | 'crest_raise'
  | 'ruffle';

const f = (ms: number, pose: Partial<BirdPose> = {}, turn = false): ClipFrame => ({
  pose,
  ms,
  turn,
});

const CLIPS: Record<ActionName, ClipFrame[]> = {
  look: [
    f(420, { head_dx: 2 }),
    f(260, { head_dx: 2, head_dy: -1 }),
    f(380, { head_dx: -1, head_dy: -1 }),
    f(220, { head_dx: -1 }),
    f(120),
  ],
  peck: [
    f(90, { lean: 0.15, head_dx: 1, head_dy: 1, tail_angle: 0.08 }),
    f(70, { lean: 0.3, head_dx: 3, head_dy: 5, tail_angle: 0.25 }),
    f(90, { lean: 0.45, head_dx: 5, head_dy: 10, tail_angle: 0.35 }),
    f(70, { lean: 0.3, head_dx: 3, head_dy: 5, tail_angle: 0.25 }),
    f(90, { lean: 0.45, head_dx: 5, head_dy: 10, tail_angle: 0.35 }),
    f(110, { lean: 0.3, head_dx: 3, head_dy: 5, tail_angle: 0.2 }),
    f(90, { lean: 0.1, head_dx: 1, head_dy: 1 }),
    f(150),
  ],
  hop: [
    f(90, { squash: 0.14 }),
    f(60, { squash: -0.1, lift: 3, tail_angle: -0.1 }),
    f(80, { squash: -0.05, lift: 7, tail_angle: -0.15, wing_lift: 0.3 }),
    f(110, { lift: 9, tail_angle: -0.1, wing_lift: 0.5 }),
    f(80, { lift: 7, wing_lift: 0.3 }),
    f(60, { lift: 3, squash: -0.05, tail_angle: 0.1 }),
    f(90, { squash: 0.16, tail_angle: 0.3 }),
    f(90, { squash: 0.06, tail_angle: 0.15 }),
    f(100),
  ],
  flap: [
    f(60, { wing_lift: 0.4, squash: 0.04 }),
    f(70, { wing_lift: 1, lift: 1 }),
    f(60, { wing_lift: 0.45 }),
    f(70, { wing_lift: 1, lift: 1 }),
    f(60, { wing_lift: 0.45 }),
    f(70, { wing_lift: 1, lift: 1 }),
    f(70, { wing_lift: 0.35 }),
    f(90, { wing_lift: 0.1 }),
    f(120),
  ],
  preen: [
    f(110, { head_dx: -2, head_dy: 1 }),
    f(140, { head_flip: true, head_dx: -6, head_dy: 3 }),
    f(120, { head_flip: true, head_dx: -7, head_dy: 4 }),
    f(120, { head_flip: true, head_dx: -6, head_dy: 3 }),
    f(120, { head_flip: true, head_dx: -7, head_dy: 5, wing_lift: 0.1 }),
    f(120, { head_flip: true, head_dx: -6, head_dy: 3 }),
    f(140, { head_flip: true, head_dx: -7, head_dy: 4 }),
    f(110, { head_dx: -2, head_dy: 1 }),
    f(150),
  ],
  sing: [
    f(150, { head_dy: -1, breathe: 1 }),
    f(150, { head_dy: -2, beak_open: 1, breathe: 1 }),
    f(110, { head_dy: -2, beak_open: 0.4 }),
    f(150, { head_dy: -2, beak_open: 1, breathe: 1 }),
    f(110, { head_dy: -2, beak_open: 0.4 }),
    f(220, { head_dy: -2, beak_open: 1, breathe: 1 }),
    f(150, { head_dy: -1 }),
    f(120),
  ],
  tail_flick: [
    f(70, { tail_angle: 0.35 }),
    f(70, { tail_angle: -0.08 }),
    f(70, { tail_angle: 0.28 }),
    f(120),
  ],
  turn: [f(80, { squash: 0.1 }), f(80, { squash: 0.06 }, true), f(80)],
  crest_raise: [
    f(70, { crest_raise: 0.5, head_dy: -1 }),
    f(700, { crest_raise: 1, head_dy: -1 }),
    f(90, { crest_raise: 0.5 }),
    f(100),
  ],
  ruffle: [
    f(55, { squash: 0.08, breathe: 1 }),
    f(55, { squash: -0.06, wing_lift: 0.15 }),
    f(55, { squash: 0.08, breathe: 1 }),
    f(55, { squash: -0.06, wing_lift: 0.15 }),
    f(55, { squash: 0.06 }),
    f(120),
  ],
};

interface Personality {
  weights: Record<ActionName, number>;
  speed: number;
  calmness: number;
}

function personality_of(g: BirdGenes, calm_k: number): Personality {
  const seed = hash_string(genes_key(g));
  const e = g.form;
  const base: Record<ActionName, number> = {
    look: 3,
    peck: 2.2,
    hop: 0.6 + 1.8 * e,
    flap: 0.5,
    preen: 0.9 * (1.2 - 0.5 * e),
    sing: 0.8,
    tail_flick: 1.2 + e,
    turn: 0.8,
    crest_raise: g.crest > 0.15 ? 0.9 : 0,
    ruffle: 0.5 * (1.5 - e),
  };
  const weights = { ...base };
  (Object.keys(base) as ActionName[]).forEach((name, i) => {
    weights[name] = base[name] * (0.4 + 1.2 * hash2(i, 7, seed));
  });
  return { weights, speed: 1.3 - 0.45 * g.size, calmness: (1.4 - 0.7 * e) * calm_k };
}

interface CompiledFrame {
  base_id: number;
  ms: number;
  turn: boolean;
  breathe: 0 | 1;
  head_flip: boolean;
  lift: number;
  sway_index: number;
}

const sway_index = (s: number) => Math.round((clamp(Math.round(s * 2) / 2, -1, 1) + 1) * 4);

function compile_clip(frames: readonly ClipFrame[]): CompiledFrame[] {
  return frames.map(fr => {
    const lift = fr.pose.lift ?? 0;
    const squash = fr.pose.squash ?? 0;

    return {
      base_id: intern_pose(fr.pose),
      ms: fr.ms,
      turn: fr.turn ?? false,
      breathe: (fr.pose.breathe ?? 0) > 0.5 ? 1 : 0,
      head_flip: fr.pose.head_flip ?? false,
      lift,
      sway_index: sway_index((lift > 2 ? -0.5 : 0) + (squash > 0.1 ? 0.5 : 0)),
    };
  });
}

const COMPILED_CLIPS = Object.fromEntries(
  (Object.entries(CLIPS) as [ActionName, ClipFrame[]][]).map(([name, frames]) => [
    name,
    compile_clip(frames),
  ]),
) as Record<ActionName, CompiledFrame[]>;

const ACTION_NAMES = Object.keys(CLIPS) as ActionName[];

export class BirdBehaviour {
  facing_left = false;
  readonly personality: Personality;
  readonly gid: number;
  private rng: Rng;
  private time = FLOAT_ZERO;
  private clip: CompiledFrame[] | null = null;
  private clip_name: ActionName | null = null;
  private frame_index = 0;
  private frame_time = FLOAT_ZERO;
  private idle_left: number;
  private blink_left: number;
  private blink_time = FLOAT_ZERO;
  private readonly breath_period: number;
  private readonly has_fx: boolean;
  private readonly has_sway: boolean;
  private readonly weights: Float64Array;
  private readonly weight_total: number;
  private code = 0;
  private frame_lift = FLOAT_ZERO;

  constructor(
    readonly genes: BirdGenes,
    seed: number,
    calm_k: number,
  ) {
    this.gid = gene_id(genes);
    this.rng = create_rng(seed);
    this.personality = personality_of(genes, calm_k);
    this.weights = Float64Array.from(ACTION_NAMES, name => this.personality.weights[name]);
    this.weight_total = this.weights.reduce((acc, w) => acc + w, 0);
    this.breath_period = 1100 + genes.size * 900;
    const sp = genes.special ?? NO_SPECIAL;
    this.has_fx = sp.aura || sp.morph === 'iridescent' || sp.morph === 'golden';
    this.has_sway = sp.ornament !== 'none';
    this.idle_left = this.next_idle();
    this.blink_left = 600 + this.rng() * 3000;
    this.time = this.rng() * 10000;
  }

  get action(): ActionName | null {
    return this.clip_name;
  }
  get pose_code(): number {
    return this.code;
  }
  get lift(): number {
    return this.frame_lift;
  }
  get pose(): Readonly<BirdPose> {
    return decode_pose(this.code);
  }

  trigger(name: ActionName): void {
    this.clip = COMPILED_CLIPS[name];
    this.clip_name = name;
    this.frame_index = 0;
    this.frame_time = 0;
    if (this.clip[0]?.turn) this.facing_left = !this.facing_left;
  }

  update(dt_ms: number): number {
    this.time += dt_ms;

    let frame: CompiledFrame | null = null;
    const clip = this.clip;
    if (clip !== null) {
      this.frame_time += dt_ms * this.personality.speed;
      let index = this.frame_index;
      while (index < clip.length && this.frame_time >= clip[index]!.ms) {
        this.frame_time -= clip[index]!.ms;
        index++;
        if (index < clip.length && clip[index]!.turn) this.facing_left = !this.facing_left;
      }
      this.frame_index = index;
      if (index < clip.length) {
        frame = clip[index]!;
      } else {
        this.clip = null;
        this.clip_name = null;
        this.idle_left = this.next_idle();
      }
    } else {
      this.idle_left -= dt_ms;
      if (this.idle_left <= 0) {
        this.trigger(this.pick_action());
        frame = this.clip![0]!;
      }
    }

    if (this.blink_time > 0) this.blink_time -= dt_ms;
    else {
      this.blink_left -= dt_ms;
      if (this.blink_left <= 0) {
        this.blink_time = 130;
        this.blink_left = this.rng() < 0.2 ? 260 : 1800 + this.rng() * 4500;
      }
    }

    this.frame_lift = frame ? frame.lift : 0;
    const base_id = frame ? frame.base_id : 0;
    const breathe: 0 | 1 = frame
      ? frame.breathe
      : Math.sin((this.time / this.breath_period) * TAU) > 0.2
        ? 1
        : 0;
    const blink: 0 | 1 = this.blink_time > 0 && !frame ? 1 : 0;
    const phase8 = this.has_fx && !frame ? Math.floor(mod(this.time / 2400, 1) * 8) : 0;
    const sway = !this.has_sway
      ? 4
      : frame
        ? frame.sway_index
        : sway_index(Math.sin((this.time / 1500) * TAU) * 0.5);
    this.code = pose_code(base_id, breathe, blink, phase8, sway);
    return this.code;
  }

  get rest_code(): number {
    return pose_code(0, 0, 0, 0, this.has_sway ? 0 : 4);
  }

  all_codes(): number[] {
    const codes = new Set<number>();
    const phases = this.has_fx ? [0, 1, 2, 3, 4, 5, 6, 7] : [0];
    const sways = this.has_sway ? [0, 2, 4, 6, 8] : [4];
    for (const breathe of [0, 1] as const)
      for (const blink of [0, 1] as const)
        for (const phase of phases)
          for (const sway of sways) codes.add(pose_code(0, breathe, blink, phase, sway));
    ACTION_NAMES.forEach((name, i) => {
      if ((this.weights[i] ?? 0) <= 0) return;
      for (const fr of COMPILED_CLIPS[name]) {
        codes.add(pose_code(fr.base_id, fr.breathe, 0, 0, this.has_sway ? fr.sway_index : 4));
      }
    });
    return [...codes];
  }

  private next_idle(): number {
    return (900 + this.rng() * 2600) * this.personality.calmness;
  }

  private pick_action(): ActionName {
    let r = this.rng() * this.weight_total;
    for (let i = 0; i < this.weights.length; i++) {
      r -= this.weights[i] ?? 0;
      if (r <= 0) return ACTION_NAMES[i] ?? 'look';
    }
    return 'look';
  }
}
