import {
  GENE_STEP,
  HUE_STEP,
  NO_SPECIAL,
  rarity_of,
  type Eyes,
  type Morph,
  type Ornament,
  type Pattern,
  type Rarity,
  type Trail,
} from '../birds/bird.generator';
import type { Gift, Temper } from '../birds/birds.character';
import { push_notice, type NoticeAction } from '../notices/notices';
import {
  EYES_LABELS,
  GIFT_LABELS,
  MORPH_LABELS,
  ORNAMENT_LABELS,
  PATTERN_LABELS,
  RARITY_LABELS,
  TEMPER_LABELS,
  TRAIL_LABELS,
} from '../../scenes/profile/profile.labels';
import { define_stored, load_stored, save_stored } from '../../../engine/storage';
import { mod } from '../../utils/math';
import { okhsv_to_rgb } from '../../utils/okhsv';
import { rgb_css } from '../../utils/color';
import { CONFIG } from '../../../config';

const C = CONFIG.achievements;
export const TIERS = C.tiers;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const TIER_LABELS = TIERS.map(String);
const GENE_VALUES = Math.round(1 / GENE_STEP) + 1;
const HUE_VALUES = Math.round(360 / HUE_STEP);
const MIN_SAT = Math.round(C.min_sat / GENE_STEP);
const MIN_VAL = Math.round(C.min_val / GENE_STEP);
const ACCENT = CONFIG.theme.accent;
const SAVE_VERSION = 1;
const OPEN_ACHIEVEMENTS: NoticeAction = { kind: 'achievements' };

export type ValuesKind = 'cells' | 'hues' | 'chips';

export type CollectionDef = {
  id: string;
  title: string;
  kind: ValuesKind;
  size: number;
  value_of: (bird: BIRD.Bird) => number;
  labels: readonly string[];
};

export type CounterDef = {
  id: string;
  title: string;
  line: (n: number) => string;
};

export type AchievementsState = {
  got: Uint8Array[];
  counts: number[];
  counters: number[];
};

const special_of = (bird: BIRD.Bird) => bird.behaviour.genes.special ?? NO_SPECIAL;

const gene_index = (v: number) => Math.round(v / GENE_STEP);

const hue_index = (h: number) => mod(Math.round(h / HUE_STEP), HUE_VALUES);

const is_plain = (bird: BIRD.Bird) => special_of(bird).morph === 'normal';

const is_colored = (bird: BIRD.Bird) => {
  const g = bird.behaviour.genes;

  return is_plain(bird) && gene_index(g.sat) >= MIN_SAT && gene_index(g.val) >= MIN_VAL;
};

const gene_collection = (
  id: 'size' | 'form' | 'tail' | 'beak' | 'crest',
  title: string,
): CollectionDef => ({
  id,
  title,
  kind: 'cells',
  size: GENE_VALUES,
  value_of: bird => gene_index(bird.behaviour.genes[id]),
  labels: [],
});

const list_collection = <T extends string>(
  id: string,
  title: string,
  labels: Record<T, string>,
  skip: T | null,
  value: (bird: BIRD.Bird) => T,
): CollectionDef => {
  const values = (Object.keys(labels) as T[]).filter(v => v !== skip);

  return {
    id,
    title,
    kind: 'chips',
    size: values.length,
    value_of: bird => values.indexOf(value(bird)),
    labels: values.map(v => labels[v]),
  };
};

export const COLLECTIONS: readonly CollectionDef[] = [
  gene_collection('size', 'Every size'),
  gene_collection('form', 'Every build'),
  gene_collection('tail', 'Every tail'),
  gene_collection('beak', 'Every beak'),
  gene_collection('crest', 'Every crest'),
  {
    id: 'hue',
    title: 'Rainbow',
    kind: 'hues',
    size: HUE_VALUES,
    value_of: bird => (is_colored(bird) ? hue_index(bird.behaviour.genes.hue) : -1),
    labels: [],
  },
  {
    id: 'sat',
    title: 'Every saturation',
    kind: 'cells',
    size: GENE_VALUES,
    value_of: bird => (is_plain(bird) ? gene_index(bird.behaviour.genes.sat) : -1),
    labels: [],
  },
  {
    id: 'val',
    title: 'Every brightness',
    kind: 'cells',
    size: GENE_VALUES,
    value_of: bird => (is_plain(bird) ? gene_index(bird.behaviour.genes.val) : -1),
    labels: [],
  },
  list_collection<Morph>('morph', 'Every morph', MORPH_LABELS, 'normal', bird => {
    return special_of(bird).morph;
  }),
  list_collection<Pattern>('pattern', 'Every pattern', PATTERN_LABELS, 'none', bird => {
    return special_of(bird).pattern;
  }),
  list_collection<Ornament>('ornament', 'Every ornament', ORNAMENT_LABELS, 'none', b => {
    return special_of(b).ornament;
  }),
  list_collection<Eyes>('eyes', 'Every eye', EYES_LABELS, 'normal', bird => {
    return special_of(bird).eyes;
  }),
  list_collection<Trail>('trail', 'Every trail', TRAIL_LABELS, 'none', bird => {
    return special_of(bird).trail;
  }),
  {
    id: 'aura',
    title: 'Aura colors',
    kind: 'hues',
    size: HUE_VALUES,
    value_of: bird => {
      const sp = special_of(bird);

      return sp.aura ? hue_index(sp.aura_hue) : -1;
    },
    labels: [],
  },
  list_collection<Rarity>('rarity', 'Every rarity', RARITY_LABELS, null, bird => {
    return rarity_of(bird.behaviour.genes);
  }),
  list_collection<Temper>('temper', 'Every temper', TEMPER_LABELS, 'none', bird => {
    return bird.temper;
  }),
  list_collection<Gift>('gift', 'Every gift', GIFT_LABELS, 'none', bird => bird.gift),
];

export const BRED = 0;
export const FLOCK = 1;
export const RELEASED = 2;
export const SUPPRESSED = 3;
export const DOMINANT = 4;

export const COUNTERS: readonly CounterDef[] = [
  { id: 'bred', title: 'Breeder', line: n => `${n} birds bred` },
  { id: 'flock', title: 'Big flock', line: n => `${n} birds in the flock` },
  { id: 'released', title: 'Set free', line: n => `${n} birds set free` },
  { id: 'suppressed', title: 'Suppressor', line: n => `${n} genes suppressed` },
  { id: 'dominant', title: 'Dominant', line: n => `${n} genes made dominant` },
];

export const CARD_COUNT = COLLECTIONS.length + COUNTERS.length;

export const ACHIEVEMENT_TOTAL = COLLECTIONS.length + COUNTERS.length * TIERS.length;

const hue_css = (i: number, alpha: number) => {
  const c = okhsv_to_rgb(i * HUE_STEP, C.hue_sat, C.hue_val);

  return rgb_css([c[0], c[1], c[2]], alpha);
};

export const HUE_COLORS = Array.from({ length: HUE_VALUES }, (_, i) => hue_css(i, 1));
export const HUE_COLORS_MISSING = Array.from({ length: HUE_VALUES }, (_, i) =>
  hue_css(i, C.missing_alpha),
);

export const tier_of = (n: number) => {
  let tier = 0;

  while (tier < TIERS.length && n >= TIERS[tier]!) {
    tier++;
  }

  return tier;
};

export const tier_title = (def: CounterDef, tier: number) =>
  tier === 0 ? def.title : `${def.title} ${ROMAN[tier - 1]}`;

export const completed_count = (state: AchievementsState) => {
  let done = 0;

  for (let i = 0; i < COLLECTIONS.length; i++) {
    if (state.counts[i] === COLLECTIONS[i]!.size) {
      done++;
    }
  }

  for (const n of state.counters) {
    done += tier_of(n);
  }

  return done;
};

type StoredAchievements = {
  version: number;
  got: Record<string, number[]>;
  counters?: Record<string, number>;
};

const is_record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const is_stored = (value: unknown): value is StoredAchievements =>
  is_record(value) &&
  value.version === SAVE_VERSION &&
  is_record(value.got) &&
  Object.values(value.got).every(
    list => Array.isArray(list) && list.every(i => Number.isInteger(i)),
  ) &&
  (value.counters === undefined ||
    (is_record(value.counters) && Object.values(value.counters).every(Number.isFinite)));

const STORED = define_stored<StoredAchievements | null>(
  'birds.achievements',
  null,
  (value: unknown): value is StoredAchievements | null => value === null || is_stored(value),
);

export const load_achievements = (): AchievementsState => {
  const stored = load_stored(STORED);
  const got = COLLECTIONS.map(def => new Uint8Array(def.size));
  const counts = COLLECTIONS.map(() => 0);
  const counters = COUNTERS.map(def => stored?.counters?.[def.id] ?? 0);

  COLLECTIONS.forEach((def, i) => {
    for (const v of stored?.got[def.id] ?? []) {
      if (v >= 0 && v < def.size && got[i]![v] === 0) {
        got[i]![v] = 1;
        counts[i]! += 1;
      }
    }
  });

  return { got, counts, counters };
};

const write_achievements = (game: BIRD.GameState) => {
  if (game.save.stopped) {
    return;
  }

  const state = game.achievements;
  const got: Record<string, number[]> = {};
  const counters: Record<string, number> = {};

  COLLECTIONS.forEach((def, i) => {
    const list: number[] = [];

    state.got[i]!.forEach((flag, v) => {
      if (flag === 1) {
        list.push(v);
      }
    });
    got[def.id] = list;
  });
  COUNTERS.forEach((def, i) => {
    counters[def.id] = state.counters[i]!;
  });

  save_stored(STORED, { version: SAVE_VERSION, got, counters });
};

const notify_collection = (game: BIRD.GameState, i: number) => {
  const def = COLLECTIONS[i]!;

  push_notice(
    game,
    `achievement:${def.id}`,
    'Achievement complete!',
    `${def.title} ${def.size} / ${def.size}`,
    ACCENT,
    OPEN_ACHIEVEMENTS,
  );
};

const notify_tier = (game: BIRD.GameState, def: CounterDef, tier: number) => {
  push_notice(
    game,
    `achievement:${def.id}`,
    'Achievement complete!',
    `${tier_title(def, tier)}: ${def.line(TIERS[tier - 1]!)}`,
    ACCENT,
    OPEN_ACHIEVEMENTS,
  );
};

const lift_counter = (game: BIRD.GameState, counter: number, value: number, notify: boolean) => {
  const counters = game.achievements.counters;
  const before = counters[counter]!;

  if (value <= before) {
    return false;
  }

  counters[counter] = value;

  const tier = tier_of(value);

  if (notify && tier > tier_of(before)) {
    notify_tier(game, COUNTERS[counter]!, tier);
  }

  return true;
};

export const record_bird = (game: BIRD.GameState, bird: BIRD.Bird, notify: boolean) => {
  const state = game.achievements;
  let gained = false;

  for (let i = 0; i < COLLECTIONS.length; i++) {
    const def = COLLECTIONS[i]!;
    const v = def.value_of(bird);

    if (v < 0 || v >= def.size || state.got[i]![v] === 1) {
      continue;
    }

    state.got[i]![v] = 1;
    state.counts[i]! += 1;
    gained = true;

    if (notify && state.counts[i] === def.size) {
      notify_collection(game, i);
    }
  }

  if (lift_counter(game, FLOCK, game.birds.length, notify) || gained) {
    write_achievements(game);
  }
};

export const count_achievement = (game: BIRD.GameState, counter: number) => {
  if (lift_counter(game, counter, game.achievements.counters[counter]! + 1, true)) {
    write_achievements(game);
  }
};

export const catch_up_achievements = (game: BIRD.GameState) => {
  let suppressed = 0;
  let dominant = 0;

  for (const bird of game.birds) {
    if (bird.suppressed !== null) {
      suppressed++;
    }

    if (bird.dominant !== null) {
      dominant++;
    }
  }

  const lifted = lift_counter(game, SUPPRESSED, suppressed, false);

  if (lift_counter(game, DOMINANT, dominant, false) || lifted) {
    write_achievements(game);
  }
};
