import { CONFIG } from '../../../config';

const IDLE_ALPHA = CONFIG.scene_bar.icon_idle_alpha;
const HOVER_ALPHA = CONFIG.scene_bar.icon_hover_alpha;
const DISABLED_ALPHA = CONFIG.scene_bar.icon_disabled_alpha;

export const icon_alpha = (active: boolean, hover: boolean, enabled: boolean) =>
  !enabled ? DISABLED_ALPHA : active ? 1 : hover ? HOVER_ALPHA : IDLE_ALPHA;
