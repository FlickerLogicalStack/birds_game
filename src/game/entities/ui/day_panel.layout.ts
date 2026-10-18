import { layout_builder } from '../../utils/layout';
import { CONFIG } from '../../../config';

const MARGIN = CONFIG.day_panel.margin;
const PAD = CONFIG.day_panel.pad;
const BUTTON_SIZE = CONFIG.day_panel.button_size;
const GAP = CONFIG.day_panel.gap;

export const DAY_PANEL_VIEW = { open: false, pinned: false };

const L = layout_builder();
const button = () => L.box({ w: BUTTON_SIZE, h: BUTTON_SIZE });

const sun = button();
const moon = button();
const slower = button();
const faster = button();
const pause = button();
const panel = L.row({ gap: GAP, pad: PAD }, [sun, moon, slower, faster, pause]);

const toggle = L.box({ w: BUTTON_SIZE + PAD * 2, h: BUTTON_SIZE + PAD * 2 });

export const DAY_PANEL_LAYOUT_ELEMENTS = {
  sun,
  moon,
  slower,
  faster,
  pause,
  panel,
  toggle,
};

export const DAY_PANEL_LAYOUT = L.compile(
  L.column({ pad: MARGIN, align: 'end' }, [
    L.when(() => !DAY_PANEL_VIEW.open, toggle),
    L.when(() => DAY_PANEL_VIEW.open, panel),
  ]),
);
