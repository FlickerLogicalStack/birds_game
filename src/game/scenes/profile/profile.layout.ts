import { layout_builder } from '../../utils/layout';
import { SCENE_BAR_SPACE } from '../../entities/ui/scene_bar';
import { BODY_ROWS, PLUMAGE_ROWS, shown_trait_rows } from './profile.labels';
import { CONFIG } from '../../../config';

const MARGIN = CONFIG.profile.margin;
const TOP_BAR_H = CONFIG.profile.top_bar_height;
const BUTTON_H = CONFIG.profile.button_height;
const BUTTON_PAD_X = CONFIG.profile.button_pad_x;
const BUTTON_FONT_SIZE = CONFIG.profile.button_font_size;
const NAME_FONT_SIZE = CONFIG.profile.name_font_size;
const PANEL_W = CONFIG.profile.panel_width;
const PANEL_PAD = CONFIG.profile.panel_pad;
const PANEL_GAP = CONFIG.profile.panel_gap;
const MIN_PREVIEW = CONFIG.profile.min_preview;
const HEADER_H = CONFIG.profile.header_height;
const SECTION_GAP = CONFIG.profile.section_gap;
const SECTION_TITLE_H = CONFIG.profile.section_title_height;
const ROW_H = CONFIG.profile.row_height;
const TOOL_SIZE = CONFIG.scene_bar.button_size;
const TOOL_GAP = CONFIG.scene_bar.button_gap;
const TOOLS_PAD = CONFIG.scene_bar.pad;

const BACK_LABEL = '< Collection';
export const SHOW_LABEL = 'Show on Tree';
export const RENAME_LABEL = 'Rename';
export const RELEASE_LABEL = 'Release';
export const RELEASE_BLOCKED_LABEL = `Keep at least ${CONFIG.world.min_birds} birds`;
export const RELEASE_CONFIRM_LABEL = 'Tap again to release';
export const SUPPRESS_LABEL = 'Suppress a gene';
export const DOMINATE_LABEL = 'Make a gene dominant';

const LIFE_ROWS = 4;

const PANEL_BASE_H =
  PANEL_PAD * 2 +
  HEADER_H +
  (SECTION_GAP + SECTION_TITLE_H) * 3 +
  (LIFE_ROWS + BODY_ROWS.length + PLUMAGE_ROWS.length) * ROW_H;

const panel_h = (game: BIRD.GameState) => {
  const bird = game.profile_scene.bird;
  const rows = bird === null ? 0 : shown_trait_rows(bird);

  return PANEL_BASE_H + (rows === 0 ? 0 : SECTION_GAP + SECTION_TITLE_H + rows * ROW_H);
};

let index_bird: BIRD.Bird | null = null;
let index_shown: readonly BIRD.Bird[] | null = null;
let index_value = -1;

const index_of = (game: BIRD.GameState) => {
  const bird = game.profile_scene.bird;
  const shown = game.collection_scene.shown;

  if (bird !== index_bird || shown !== index_shown) {
    index_bird = bird;
    index_shown = shown;
    index_value = bird === null ? -1 : shown.indexOf(bird);
  }

  return index_value;
};

let counter_index = -1;
let counter_total = -1;
let counter_text = '';

const counter_of = (game: BIRD.GameState) => {
  const index = index_of(game);
  const total = game.collection_scene.shown.length;

  if (index !== counter_index || total !== counter_total) {
    counter_index = index;
    counter_total = total;
    counter_text = `${index + 1} / ${total}`;
  }

  return counter_text;
};

const L = layout_builder();
const button = {
  h: BUTTON_H,
  pad_x: BUTTON_PAD_X,
  font_size: BUTTON_FONT_SIZE,
  weight: 600,
};

const leaves = {
  back: L.text({ ...button, value: () => BACK_LABEL }),
  name: L.text({
    h: BUTTON_H,
    font_size: NAME_FONT_SIZE,
    weight: 700,
    grow: 1,
    screen_center: true,
    value: game => game.profile_scene.bird?.name ?? '',
  }),
  prev: L.box({ w: BUTTON_H, h: BUTTON_H }),
  counter: L.text({ ...button, value: counter_of }),
  next: L.box({ w: BUTTON_H, h: BUTTON_H }),
  preview: L.square({ min: MIN_PREVIEW, grow: 1 }),
  panel: L.box({ w: PANEL_W, h: PANEL_BASE_H, h_of: panel_h }),
  show: L.square({ size: TOOL_SIZE }),
  breed: L.square({ size: TOOL_SIZE }),
  rename: L.square({ size: TOOL_SIZE }),
  suppress: L.square({ size: TOOL_SIZE }),
  dominate: L.square({ size: TOOL_SIZE }),
  release: L.square({ size: TOOL_SIZE }),
};

const E = leaves;

const tools = L.device({
  mobile: L.row({ gap: TOOL_GAP, pad: TOOLS_PAD }, [
    E.show,
    E.breed,
    E.rename,
    E.suppress,
    E.dominate,
    E.release,
  ]),
  desktop: L.column({ gap: TOOL_GAP, pad: TOOLS_PAD }, [
    E.show,
    E.breed,
    E.rename,
    E.suppress,
    E.dominate,
    E.release,
  ]),
});

const nav = L.when(game => index_of(game) !== -1, L.row({}, [E.prev, E.counter, E.next]));

const name_row = L.row({ align: 'start', pad: { top: 8, bottom: 24 } }, [E.name]);

const body = L.scroll(
  { grow: 1 },
  L.column({ pad: { bottom: SCENE_BAR_SPACE + MARGIN } }, [
    name_row,
    L.column({ gap: PANEL_GAP }, [E.preview, tools, E.panel]),
  ]),
);

export const PROFILE_LAYOUT_ELEMENTS = { ...leaves, tools, nav, body };

export const PROFILE_LAYOUT = L.compile(
  L.column({ pad: { x: MARGIN, top: MARGIN / 2 } }, [
    L.row({ gap: BUTTON_PAD_X, cross: TOP_BAR_H, justify: 'space-between' }, [E.back, nav]),
    L.device({
      mobile: body,
      desktop: L.column({ grow: 1, pad: { bottom: SCENE_BAR_SPACE + MARGIN } }, [
        name_row,
        L.fit({ grow: 1 }, L.row({ gap: PANEL_GAP }, [E.panel, E.preview, tools])),
      ]),
    }),
  ]),
);
