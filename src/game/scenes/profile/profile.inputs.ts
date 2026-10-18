import { can_release_bird } from '../../entities/birds/birds';
import { is_clicked } from '../../entities/camera/camera';
import { node_clicked, scroll_input, update_layout } from '../../utils/layout';
import { PROFILE_LAYOUT, PROFILE_LAYOUT_ELEMENTS } from './profile.layout';
import { handle_gene_dialog_input } from './profile.gene_dialog';
import {
  breed_profile_bird,
  close_profile,
  open_gene_dialog,
  release_profile_bird,
  rename_profile_bird,
  show_profile_bird,
} from './profile.state';

export const handle_profile_input = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.ProfileScene,
) => {
  const { kb, mouse } = engine.inputs;
  const E = PROFILE_LAYOUT_ELEMENTS;

  if (scene.gene_dialog !== null) {
    handle_gene_dialog_input(engine, game);
    return;
  }

  scroll_input(PROFILE_LAYOUT, E.body, engine);

  const layout = update_layout(PROFILE_LAYOUT, engine, game);
  const rects = layout.rects;
  let step =
    kb.ArrowRight || is_clicked(mouse, rects[E.next]!)
      ? 1
      : kb.ArrowLeft || is_clicked(mouse, rects[E.prev]!)
        ? -1
        : 0;
  const was_armed = scene.release_armed;
  const back = (kb.Escape && !was_armed) || is_clicked(mouse, rects[E.back]!);
  const show = node_clicked(layout, E.show, mouse);
  const breed = node_clicked(layout, E.breed, mouse);
  const rename = node_clicked(layout, E.rename, mouse);
  const release = node_clicked(layout, E.release, mouse) && can_release_bird(game);
  const suppress = node_clicked(layout, E.suppress, mouse);
  const dominate = node_clicked(layout, E.dominate, mouse);

  if (mouse.click || kb.Escape || step !== 0) {
    scene.release_armed = false;
  }

  kb.ArrowLeft = false;
  kb.ArrowRight = false;
  kb.Escape = false;
  mouse.click = false;
  mouse.double_click = false;

  if (scene.bird === null || back) {
    close_profile(game);
    return;
  }

  const shown = game.collection_scene.shown;
  const index = shown.indexOf(scene.bird);

  if (index === -1) {
    step = 0;
  }

  if (step !== 0) {
    scene.bird = shown[(index + step + shown.length) % shown.length]!;
    return;
  }

  if (show) {
    show_profile_bird(game);
  } else if (breed) {
    breed_profile_bird(game);
  } else if (rename) {
    rename_profile_bird(game);
  } else if (release && was_armed) {
    release_profile_bird(engine, game);
  } else if (release) {
    scene.release_armed = true;
  } else if (suppress) {
    open_gene_dialog(scene, 'suppress');
  } else if (dominate) {
    open_gene_dialog(scene, 'dominant');
  }
};
