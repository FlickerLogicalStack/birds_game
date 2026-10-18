import { layout_builder } from '../../utils/layout';
import { CONFIG } from '../../../config';

const MARGIN = CONFIG.hatch.margin;
const TITLE_H = CONFIG.hatch.title_height;
const TITLE_FONT_SIZE = CONFIG.hatch.title_font_size;
const NAME_H = CONFIG.hatch.name_height;
const NAME_FONT_SIZE = CONFIG.hatch.name_font_size;
const MIN_STAGE = CONFIG.hatch.min_stage;
const SECTION_GAP = CONFIG.hatch.section_gap;
const BUTTON_W = CONFIG.hatch.button_width;
const BUTTON_H = CONFIG.hatch.button_height;
const BUTTON_FONT_SIZE = CONFIG.hatch.button_font_size;
const BUTTON_GAP = CONFIG.hatch.button_gap;

const HATCHING_LABEL = 'Something is hatching...';
const MEET_LABEL = 'Meet your new bird!';
const PROFILE_LABEL = 'Open Profile';
const TREE_LABEL = 'Show on Tree';
const NEXT_LABEL = 'Next';

const L = layout_builder();
const button = (value: string) =>
  L.text({
    w: BUTTON_W,
    h: BUTTON_H,
    font_size: BUTTON_FONT_SIZE,
    weight: 700,
    value: () => value,
  });

export const HATCH_LAYOUT_ELEMENTS = {
  title: L.text({
    h: TITLE_H,
    font_size: TITLE_FONT_SIZE,
    weight: 700,
    value: game => (game.hatch_scene.hatched ? MEET_LABEL : HATCHING_LABEL),
  }),
  name: L.text({ h: NAME_H, font_size: NAME_FONT_SIZE, weight: 700 }),
  stage: L.square({ min: MIN_STAGE, grow: 1 }),
  profile: button(PROFILE_LABEL),
  tree: button(TREE_LABEL),
  next: button(NEXT_LABEL),
};

const E = HATCH_LAYOUT_ELEMENTS;

export const HATCH_LAYOUT = L.compile(
  L.column({ pad: { x: MARGIN, top: MARGIN / 2, bottom: MARGIN } }, [
    E.title,
    L.fit(
      { grow: 1 },
      L.column({ gap: SECTION_GAP }, [
        E.name,
        E.stage,
        L.column({ gap: BUTTON_GAP }, [E.profile, E.tree, E.next]),
      ]),
    ),
  ]),
);
