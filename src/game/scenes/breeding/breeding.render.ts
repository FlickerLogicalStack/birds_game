import { RARITY_INFO, SPRITE_SIZE } from '../../entities/birds/bird.generator';
import { draw_bird_sprite } from '../../entities/birds/birds.renderer';
import { is_hovered, type Rect } from '../../entities/camera/camera';
import { fill_rect, fill_stroke_round_rect, with_smoothing } from '../../utils/draw';
import { draw_text, draw_text_fit, pixel_font } from '../../utils/pixel_font';
import { draw_node_text, fill_node_button, update_layout } from '../../utils/layout';
import { draw_gene_marks, name_color } from '../collection/collection.render';
import { BREEDING_LAYOUT, BREEDING_LAYOUT_ELEMENTS, PARENT_SLOTS } from './breeding.layout';
import { can_breed } from './breeding.state';
import { RARITIES } from '../collection/collection.state';
import { CONFIG } from '../../../config';

const BACKGROUND = CONFIG.theme.background;
const TEXT = CONFIG.theme.text;
const TEXT_DIM = CONFIG.theme.text_dim;
const TEXT_MUTED = CONFIG.theme.text_muted;
const SLOT = CONFIG.theme.profile.panel;
const SLOT_BORDER = CONFIG.theme.profile.border;
const SLOT_HOVER_BORDER = CONFIG.theme.breeding.slot_hover_border;
const BUTTON = CONFIG.theme.breeding.button;
const BUTTON_HOVER = CONFIG.theme.breeding.button_hover;
const BUTTON_DISABLED = CONFIG.theme.profile.button;
const SLOT_NAME_FONT_SIZE = CONFIG.breeding.slot_name_font_size;
const SLOT_NAME_H = CONFIG.breeding.slot_name_height;
const SLOT_GENE_H = CONFIG.breeding.slot_gene_height;
const SLOT_GENE_FONT_SIZE = CONFIG.breeding.slot_gene_font_size;

const hint_of = (scene: BIRD.BreedingScene) => {
  if (scene.no_room) {
    return 'No room left on the tree';
  }

  const chosen = (scene.parents[0] === null ? 0 : 1) + (scene.parents[1] === null ? 0 : 1);

  return chosen === 0
    ? 'Choose two birds from your collection'
    : chosen === 1
      ? 'Choose one more bird'
      : 'Ready to breed';
};

const render_slot = (engine: BIRD.EngineContext, rect: Rect, bird: BIRD.Bird | null, s: number) => {
  const ctx = engine.ctx;
  const mouse = engine.inputs.mouse;
  const side = rect.w;
  const hover = is_hovered(mouse, rect);
  const center_x = rect.x + side / 2;
  const font = pixel_font(SLOT_NAME_FONT_SIZE, s, engine.canvas.dpr, 600);

  fill_stroke_round_rect(
    ctx,
    rect.x,
    rect.y,
    side,
    side,
    16 * s,
    SLOT,
    hover ? SLOT_HOVER_BORDER : SLOT_BORDER,
    Math.max(1, s),
  );

  if (bird === null) {
    draw_text(ctx, 'Choose', center_x, rect.y + side / 2, font, TEXT_DIM, 'center', 'middle');
    return;
  }

  const scale = Math.max(1, Math.floor(side / SPRITE_SIZE));
  const sprite = SPRITE_SIZE * scale;

  with_smoothing(ctx, false, () =>
    draw_bird_sprite(
      engine,
      bird,
      Math.round(rect.x + (side - sprite) / 2),
      Math.round(rect.y + (side - sprite) / 2),
      sprite,
    ),
  );

  draw_text_fit(
    ctx,
    bird.name,
    center_x,
    rect.y + side + (SLOT_NAME_H * s) / 2,
    font,
    name_color(bird),
    'center',
    'middle',
    side,
  );

  draw_gene_marks(
    ctx,
    bird,
    center_x,
    rect.y + side + (SLOT_NAME_H + SLOT_GENE_H / 2) * s,
    pixel_font(SLOT_GENE_FONT_SIZE, s, engine.canvas.dpr, 600),
    'middle',
  );
};

export const render_breeding_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.BreedingScene,
) => {
  const ctx = engine.ctx;
  const mouse = engine.inputs.mouse;
  const layout = update_layout(BREEDING_LAYOUT, engine, game);
  const { rects, fonts, scale } = layout;
  const E = BREEDING_LAYOUT_ELEMENTS;
  const s = scale[E.first]!;

  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, BACKGROUND);

  draw_node_text(ctx, layout, E.title, TEXT, 0);

  PARENT_SLOTS.forEach((handle, i) => {
    render_slot(engine, rects[handle]!, scene.parents[i]!, s);
  });

  const hint = rects[E.hint]!;

  draw_text(
    ctx,
    hint_of(scene),
    hint.x + hint.w / 2,
    hint.y + hint.h / 2,
    fonts[E.hint]!,
    TEXT_MUTED,
    'center',
    'middle',
  );

  E.chances.forEach((handle, i) => {
    if (layout.visible[handle] !== 0) {
      draw_node_text(ctx, layout, handle, RARITY_INFO[RARITIES[i]!].color, 0);
    }
  });

  const enabled = can_breed(scene);
  const hover = enabled && is_hovered(mouse, rects[E.breed]!);

  fill_node_button(
    ctx,
    layout,
    E.breed,
    8 * s,
    enabled ? (hover ? BUTTON_HOVER : BUTTON) : BUTTON_DISABLED,
    0,
  );
  draw_node_text(ctx, layout, E.breed, enabled ? TEXT : TEXT_DIM, 0);
};
