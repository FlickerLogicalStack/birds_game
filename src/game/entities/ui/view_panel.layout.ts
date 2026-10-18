import { can_fullscreen } from '../../../engine/fullscreen';
import { layout_builder } from '../../utils/layout';
import { CONFIG } from '../../../config';

const MARGIN = CONFIG.day_panel.margin;
const PAD = CONFIG.day_panel.pad;
const BUTTON_SIZE = CONFIG.day_panel.button_size;
const GAP = CONFIG.day_panel.gap;
const CAN_FULLSCREEN = can_fullscreen();

const L = layout_builder();

const follow = L.box({ w: BUTTON_SIZE, h: BUTTON_SIZE });
const fullscreen = L.box({ w: BUTTON_SIZE, h: BUTTON_SIZE });
const debug = L.box({ w: BUTTON_SIZE, h: BUTTON_SIZE });
const panel = L.column({ gap: GAP, pad: PAD }, [
  follow,
  L.when(() => CAN_FULLSCREEN, fullscreen),
  debug,
]);

export const VIEW_PANEL_LAYOUT_ELEMENTS = { follow, fullscreen, debug, panel };

export const VIEW_PANEL_LAYOUT = L.compile(L.column({ pad: MARGIN, align: 'start' }, [panel]));
