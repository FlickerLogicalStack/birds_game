import type {
  ActionName,
  BirdGenes,
  Eyes,
  GeneGroup,
  Morph,
  Ornament,
  Pattern,
  PlumageColors,
  Rarity,
  SpecialTraits,
  Trail,
  TraitGroup,
} from '../../entities/birds/bird.generator';
import { has_trait, NO_SPECIAL } from '../../entities/birds/bird.generator';
import type { Gift, Temper } from '../../entities/birds/birds.character';

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const MORPH_LABELS: Record<Morph, string> = {
  normal: 'Normal',
  leucistic: 'Leucistic',
  albino: 'Albino',
  melanistic: 'Melanistic',
  golden: 'Golden',
  iridescent: 'Iridescent',
  chimera: 'Chimera',
  sunset: 'Sunset',
};

export const PATTERN_LABELS: Record<Pattern, string> = {
  none: 'None',
  bars: 'Bars',
  mask: 'Mask',
  cap: 'Cap',
};

export const ORNAMENT_LABELS: Record<Ornament, string> = {
  none: 'None',
  streamers: 'Tail streamers',
  plume: 'Plume',
};

export const EYES_LABELS: Record<Eyes, string> = {
  normal: 'Normal',
  heterochromia: 'Heterochromia',
  glowing: 'Glowing',
};

export const TEMPER_LABELS: Record<Temper, string> = {
  none: 'None',
  swimmer: 'Swimmer',
  restless: 'Restless',
  sleepy: 'Sleepy',
  social: 'Social',
  loner: 'Loner',
};

export const GIFT_LABELS: Record<Gift, string> = {
  none: 'None',
  fertile: 'Fertile',
  joyful: 'Always joyful',
  stable: 'Stable',
  wild: 'Wild',
};

export const TRAIL_LABELS: Record<Trail, string> = {
  none: 'None',
  sparks: 'Sparks',
  petals: 'Petals',
  snow: 'Snowflakes',
  rainbow: 'Rainbow',
};

const ACTION_LABELS: Record<ActionName, string> = {
  look: 'looking around',
  peck: 'pecking',
  hop: 'hopping',
  flap: 'flapping',
  preen: 'preening',
  sing: 'singing',
  tail_flick: 'flicking its tail',
  turn: 'turning around',
  crest_raise: 'raising its crest',
  ruffle: 'ruffling feathers',
};

export const BODY_ROWS = [
  { label: 'Size', gene: 'size', words: ['Tiny', 'Small', 'Medium', 'Large', 'Huge'] },
  { label: 'Build', gene: 'form', words: ['Plump', 'Round', 'Neat', 'Slim', 'Slender'] },
  { label: 'Tail', gene: 'tail', words: ['Short', 'Medium', 'Long', 'Fanned'] },
  { label: 'Beak', gene: 'beak', words: ['Stubby', 'Short', 'Long', 'Hooked'] },
  { label: 'Crest', gene: 'crest', words: ['None', 'Small', 'Medium', 'Large'] },
] as const satisfies readonly { label: string; gene: keyof BirdGenes; words: readonly string[] }[];

export const PLUMAGE_ROWS = [
  { label: 'Body', part: 'body', group: 'body_color' },
  { label: 'Belly', part: 'belly', group: 'belly_color' },
  { label: 'Wing', part: 'wing', group: 'wing_color' },
  { label: 'Crest', part: 'crest', group: null },
] as const satisfies readonly {
  label: string;
  part: keyof PlumageColors;
  group: GeneGroup | null;
}[];

export const TRAIT_ROWS = [
  { label: 'Coloring', group: 'morph' },
  { label: 'Pattern', group: 'pattern' },
  { label: 'Ornament', group: 'ornament' },
  { label: 'Aura', group: 'aura' },
  { label: 'Eyes', group: 'eyes' },
  { label: 'Trail', group: 'trail' },
] as const satisfies readonly { label: string; group: TraitGroup }[];

export const BIRD_ROWS = [
  { label: 'Temper', field: 'temper' },
  { label: 'Gift', field: 'gift' },
] as const satisfies readonly { label: string; field: 'temper' | 'gift' }[];

export const shown_trait_rows = (bird: BIRD.Bird) => {
  const special = bird.behaviour.genes.special ?? NO_SPECIAL;
  let count = 0;

  for (const row of TRAIT_ROWS) {
    if (has_trait(special, row.group)) {
      count++;
    }
  }

  for (const row of BIRD_ROWS) {
    if (bird[row.field] !== 'none') {
      count++;
    }
  }

  return count;
};

export const bird_row_text = (bird: BIRD.Bird, field: 'temper' | 'gift') =>
  field === 'temper' ? TEMPER_LABELS[bird.temper] : GIFT_LABELS[bird.gift];

export const trait_text = (special: SpecialTraits, group: TraitGroup) => {
  switch (group) {
    case 'morph':
      return MORPH_LABELS[special.morph];
    case 'pattern':
      return PATTERN_LABELS[special.pattern];
    case 'ornament':
      return ORNAMENT_LABELS[special.ornament];
    case 'aura':
      return special.aura ? 'Yes' : 'No';
    case 'eyes':
      return EYES_LABELS[special.eyes];
    case 'trail':
      return TRAIL_LABELS[special.trail];
  }
};

export const GENE_GROUP_LABELS: Record<GeneGroup, string> = {
  morph: 'Coloring',
  pattern: 'Pattern',
  ornament: 'Ornament',
  aura: 'Aura',
  eyes: 'Eyes',
  trail: 'Trail',
  size: 'Size',
  form: 'Build',
  tail: 'Tail',
  beak: 'Beak',
  crest: 'Crest',
  body_color: 'Body color',
  belly_color: 'Belly color',
  wing_color: 'Wing color',
};

const by_group = (text: (label: string) => string) =>
  Object.fromEntries(
    Object.entries(GENE_GROUP_LABELS).map(([group, label]) => [group, text(label)]),
  ) as Record<GeneGroup, string>;

export const SUPPRESSED_LABELS = by_group(label => `${label} suppressed`);

export const DOMINANT_LABELS = by_group(label => `${label} dominant`);

export const temper_line = (bird: BIRD.Bird) => {
  const { weights, calmness } = bird.behaviour.personality;
  let favorite: ActionName = 'look';

  for (const name of Object.keys(weights) as ActionName[]) {
    if (weights[name] > weights[favorite]) {
      favorite = name;
    }
  }

  const temper = calmness > 1.15 ? 'Calm' : calmness < 0.85 ? 'Lively' : 'Easygoing';

  return `${temper} - loves ${ACTION_LABELS[favorite]}`;
};
