import { is_clicked } from '../../entities/camera/camera';
import { update_layout } from '../../utils/layout';
import { BREEDING_LAYOUT, BREEDING_LAYOUT_ELEMENTS, PARENT_SLOTS } from './breeding.layout';
import { breed, can_breed, start_pick } from './breeding.state';

export const handle_breeding_input = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.BreedingScene,
) => {
  const { kb, mouse } = engine.inputs;
  const { rects } = update_layout(BREEDING_LAYOUT, engine, game);
  const clicked = (handle: number) => is_clicked(mouse, rects[handle]!);
  const breed_pressed = kb.Enter || clicked(BREEDING_LAYOUT_ELEMENTS.breed);
  const slot = PARENT_SLOTS.findIndex(clicked);

  kb.Enter = false;
  mouse.click = false;
  mouse.double_click = false;

  if (slot !== -1) {
    start_pick(game, slot);
  } else if (breed_pressed && can_breed(scene)) {
    breed(engine, game);
  }
};
