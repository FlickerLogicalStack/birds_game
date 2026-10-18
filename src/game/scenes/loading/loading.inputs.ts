import { is_clicked } from '../../entities/camera/camera';
import { update_layout } from '../../utils/layout';
import { LOADING_LAYOUT_ELEMENTS, LOADING_LAYOUT } from './loading.layout';

export const handle_loading_input = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const { kb, mouse } = engine.inputs;
  const button = update_layout(LOADING_LAYOUT, engine, game).rects[LOADING_LAYOUT_ELEMENTS.skip]!;
  const clicked = is_clicked(mouse, button);

  if (clicked || kb.Space || kb.Enter) {
    kb.Space = false;
    kb.Enter = false;
    game.current_scene = 'primary';
  }
};
