import { layout_builder, number_text } from '../../utils/layout';
import { SCENE_BAR_SPACE } from '../../entities/ui/scene_bar';
import { RARITIES } from '../collection/collection.state';
import { RARITY_LABELS } from '../profile/profile.labels';
import { breed_chances, can_breed } from './breeding.state';
import { CONFIG } from '../../../config';

const MARGIN = CONFIG.breeding.margin;
const TITLE_H = CONFIG.breeding.title_height;
const TITLE_FONT_SIZE = CONFIG.breeding.title_font_size;
const SLOT = CONFIG.breeding.slot_size;
const SLOT_NAME_H = CONFIG.breeding.slot_name_height;
const SLOT_GENE_H = CONFIG.breeding.slot_gene_height;
const SLOT_GAP = CONFIG.breeding.slot_gap;
const SECTION_GAP = CONFIG.breeding.section_gap;
const HINT_H = CONFIG.breeding.hint_height;
const HINT_FONT_SIZE = CONFIG.breeding.hint_font_size;
const BUTTON_W = CONFIG.breeding.button_width;
const BUTTON_H = CONFIG.breeding.button_height;
const BUTTON_FONT_SIZE = CONFIG.breeding.button_font_size;
const CHANCE_GAP = CONFIG.breeding.chance_gap;

export const BREED_LABEL = 'Breed';

const L = layout_builder();

const chance_label = (x: number) => (x >= 10_000 ? `1/${Math.round(x / 1000)}k` : `1/${x}`);

const chances = RARITIES.map(rarity => {
  const text = number_text(x => `${RARITY_LABELS[rarity]} ${chance_label(x)}`);
  const i = RARITIES.indexOf(rarity);

  return L.text({
    h: HINT_H,
    font_size: HINT_FONT_SIZE,
    weight: 600,
    value: game => text(Math.max(1, Math.round(1 / breed_chances(game.breeding_scene)[i]!))),
  });
});

export const BREEDING_LAYOUT_ELEMENTS = {
  title: L.text({
    h: TITLE_H,
    font_size: TITLE_FONT_SIZE,
    weight: 700,
    value: () => 'Breeding',
  }),
  first: L.box({ w: SLOT, h: SLOT + SLOT_NAME_H + SLOT_GENE_H }),
  second: L.box({ w: SLOT, h: SLOT + SLOT_NAME_H + SLOT_GENE_H }),
  hint: L.text({ h: HINT_H, font_size: HINT_FONT_SIZE }),
  chances,
  chance_row: L.when(
    game => can_breed(game.breeding_scene),
    L.column(
      { gap: CHANCE_GAP },
      chances.map((handle, i) =>
        L.when(game => breed_chances(game.breeding_scene)[i]! > 0, handle),
      ),
    ),
  ),
  breed: L.text({
    w: BUTTON_W,
    h: BUTTON_H,
    font_size: BUTTON_FONT_SIZE,
    weight: 700,
    value: () => BREED_LABEL,
  }),
};

const E = BREEDING_LAYOUT_ELEMENTS;

export const PARENT_SLOTS = [E.first, E.second] as const;

export const BREEDING_LAYOUT = L.compile(
  L.column({ pad: { x: MARGIN, top: MARGIN / 2, bottom: SCENE_BAR_SPACE + MARGIN } }, [
    E.title,
    L.fit(
      { grow: 1 },
      L.column({ gap: SECTION_GAP }, [
        E.hint,
        L.row({ gap: SLOT_GAP * 3, align: 'center' }, [E.first, E.second]),
        E.chance_row,
        E.breed,
      ]),
    ),
  ]),
);
