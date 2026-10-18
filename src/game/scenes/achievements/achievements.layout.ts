import { completed_count, ACHIEVEMENT_TOTAL } from '../../entities/achievements/achievements';
import { layout_builder, number_text } from '../../utils/layout';
import { SCENE_BAR_SPACE } from '../../entities/ui/scene_bar';
import { CONFIG } from '../../../config';

const C = CONFIG.achievements;

const L = layout_builder();
const done_text = number_text(n => `${n} / ${ACHIEVEMENT_TOTAL} complete`);
const cards = L.box({ w: 0, h: 0, grow: 1, h_of: game => game.achievements_scene.content_height });

export const ACHIEVEMENTS_LAYOUT_ELEMENTS = {
  title: L.text({
    h: 30,
    font_size: 22,
    weight: 700,
    value: () => 'Achievements',
  }),
  done: L.text({
    h: 18,
    font_size: C.count_font_size,
    weight: 600,
    value: game => done_text(completed_count(game.achievements)),
  }),
  cards,
  scroll: L.scroll(
    { grow: 1 },
    L.column({ pad: { x: C.card_gap, top: C.card_gap, bottom: SCENE_BAR_SPACE + 24 } }, [cards]),
  ),
};

const E = ACHIEVEMENTS_LAYOUT_ELEMENTS;

export const ACHIEVEMENTS_LAYOUT = L.compile(
  L.column({}, [
    L.column({ pad: { top: C.card_pad, x: C.card_pad, bottom: C.card_pad } }, [E.title, E.done]),
    E.scroll,
  ]),
);
