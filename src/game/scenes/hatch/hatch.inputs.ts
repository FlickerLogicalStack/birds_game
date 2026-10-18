import { is_clicked } from '../../entities/camera/camera';
import { update_layout } from '../../utils/layout';
import { back_to_breeding } from '../breeding/breeding.state';
import { open_profile, show_bird_on_tree } from '../profile/profile.state';
import { HATCH_LAYOUT, HATCH_LAYOUT_ELEMENTS } from './hatch.layout';
import { is_hatch_done, skip_hatch } from './hatch.state';

export const handle_hatch_input = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.HatchScene,
) => {
  const { kb, mouse } = engine.inputs;
  const { rects } = update_layout(HATCH_LAYOUT, engine, game);
  const bird = scene.bird;
  const enter = kb.Enter;
  const escape = kb.Escape;
  const click = mouse.click;
  const to_profile = is_clicked(mouse, rects[HATCH_LAYOUT_ELEMENTS.profile]!);
  const to_tree = is_clicked(mouse, rects[HATCH_LAYOUT_ELEMENTS.tree]!);
  const to_next = is_clicked(mouse, rects[HATCH_LAYOUT_ELEMENTS.next]!);

  kb.Enter = false;
  kb.Escape = false;
  mouse.click = false;
  mouse.double_click = false;

  if (bird === null || escape) {
    back_to_breeding(game);
  } else if (!is_hatch_done(scene)) {
    if (enter || click) {
      skip_hatch(engine, scene);
    }
  } else if (to_profile || enter) {
    open_profile(game, bird);
  } else if (to_tree) {
    show_bird_on_tree(game, bird);
  } else if (to_next) {
    back_to_breeding(game);
  }
};
