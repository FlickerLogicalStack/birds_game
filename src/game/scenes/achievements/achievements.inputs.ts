import { scroll_input, update_layout } from '../../utils/layout';
import { ACHIEVEMENTS_LAYOUT, ACHIEVEMENTS_LAYOUT_ELEMENTS } from './achievements.layout';
import { fit_cards } from './achievements.cards';

export const handle_achievements_input = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.AchievementsScene,
) => {
  fit_cards(engine, game, scene);
  scroll_input(ACHIEVEMENTS_LAYOUT, ACHIEVEMENTS_LAYOUT_ELEMENTS.scroll, engine);
  update_layout(ACHIEVEMENTS_LAYOUT, engine, game);
};
