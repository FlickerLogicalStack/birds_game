import { rarity_of, RARITY_INFO } from '../../entities/birds/bird.generator';
import { can_breed_bird, not_breedable_reason } from '../../entities/birds/birds.age';
import { render_hover_frame } from '../../entities/birds/birds.hover.renderer';
import { render_bird_at } from '../../entities/birds/birds.renderer';
import {
  is_hovered,
  to_screen_x,
  to_screen_y,
  to_world_y,
  type Rect,
} from '../../entities/camera/camera';
import {
  collection_feet_x,
  collection_feet_y,
  COLLECTION_CELL,
  COLLECTION_ROW,
} from './collection.state';
import {
  chip_active,
  COLLECTION_LAYOUT,
  COLLECTION_LAYOUT_ELEMENTS,
  TOOLBAR_CHIPS,
} from './collection.layout';
import { draw_node_text, fill_node_button, update_layout, type Layout } from '../../utils/layout';
import {
  fill_circle,
  fill_rect,
  fill_round_rect,
  with_clip,
  with_smoothing,
} from '../../utils/draw';
import { render_scrollbar } from '../../entities/ui/scrollbar';
import { place_grid_camera } from './collection.grid';
import {
  draw_text,
  draw_text_fit,
  draw_volatile_text,
  measure_text,
  pixel_font,
  type PixelFont,
  type TextBaseline,
} from '../../utils/pixel_font';
import { GENE_GROUP_LABELS } from '../profile/profile.labels';
import { CONFIG } from '../../../config';

const BACKGROUND = CONFIG.theme.background;
const TOOLBAR_BACKGROUND = CONFIG.theme.background;
const TOOLBAR_BORDER = CONFIG.theme.collection.toolbar_border;
const CHIP = CONFIG.theme.collection.chip;
const CHIP_HOVER = CONFIG.theme.collection.chip_hover;
const CHIP_ACTIVE = CONFIG.theme.active;
const TEXT = CONFIG.theme.text;
const TEXT_DIM = CONFIG.theme.text_dim;
const TEXT_MUTED = CONFIG.theme.text_muted;
const COMMON_NAME = CONFIG.theme.collection.common_name;
const NAME_GAP = CONFIG.collection.name_gap;
const NAME_SIZE = CONFIG.collection.name_size;
const REASON_GAP = CONFIG.collection.reason_gap;
const REASON_SIZE = CONFIG.collection.reason_size;
const SUPPRESSED_GAP = CONFIG.collection.suppressed_gap;
const SUPPRESSED_SIZE = CONFIG.collection.suppressed_size;
const SUPPRESSED_GENE = CONFIG.theme.suppressed_gene;
const DOMINANT_GENE = CONFIG.theme.dominant_gene;
const GENE_MARKS_GAP = '   ';
const FRAME_INSET = CONFIG.collection.frame_inset;
const MIN_NAME_PX = CONFIG.collection.min_name_px;
const CHIP_PAD_X = CONFIG.toolbar.chip_pad_x;
const TOOLBAR_PAD = CONFIG.toolbar.pad;
const DOT_SIZE = CONFIG.toolbar.dot_size;
const TAKEN_ALPHA = 0.3;
const TAKEN_REASON = 'Other parent';

const is_blocked = (bird: BIRD.Bird, taken: BIRD.Bird | null) =>
  bird === taken || !can_breed_bird(bird);

const block_reason = (bird: BIRD.Bird, taken: BIRD.Bird | null) =>
  bird === taken ? TAKEN_REASON : not_breedable_reason(bird)!;

const has_gene_marks = (bird: BIRD.Bird) => bird.suppressed !== null || bird.dominant !== null;

const suppressed_space = (bird: BIRD.Bird) =>
  has_gene_marks(bird) ? SUPPRESSED_GAP + SUPPRESSED_SIZE : 0;

export const draw_gene_marks = (
  ctx: CanvasRenderingContext2D,
  bird: BIRD.Bird,
  x: number,
  y: number,
  font: PixelFont,
  baseline: TextBaseline,
) => {
  if (bird.dominant !== null && bird.suppressed !== null) {
    const dominant = GENE_GROUP_LABELS[bird.dominant];
    const suppressed = GENE_GROUP_LABELS[bird.suppressed];
    const dominant_w = measure_text(dominant, font);
    const gap = measure_text(GENE_MARKS_GAP, font);
    const left = Math.round(x - (dominant_w + gap + measure_text(suppressed, font)) / 2);

    draw_text(ctx, dominant, left, y, font, DOMINANT_GENE, 'start', baseline);
    draw_text(
      ctx,
      suppressed,
      left + dominant_w + gap,
      y,
      font,
      SUPPRESSED_GENE,
      'start',
      baseline,
    );
  } else if (bird.dominant !== null) {
    draw_text(ctx, GENE_GROUP_LABELS[bird.dominant], x, y, font, DOMINANT_GENE, 'center', baseline);
  } else if (bird.suppressed !== null) {
    const label = GENE_GROUP_LABELS[bird.suppressed];

    draw_text(ctx, label, x, y, font, SUPPRESSED_GENE, 'center', baseline);
  }
};

export const name_color = (bird: BIRD.Bird) => {
  const rarity = rarity_of(bird.behaviour.genes);

  return rarity === 'common' ? COMMON_NAME : RARITY_INFO[rarity].color;
};

const draw_pick_line = (
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  handle: number,
  color: string,
  right: number,
) => {
  const rect = layout.rects[handle]!;

  draw_text_fit(
    ctx,
    layout.texts[handle]!,
    rect.x,
    rect.y + rect.h / 2,
    layout.fonts[handle]!,
    color,
    'start',
    'middle',
    right - rect.x,
  );
};

const render_toolbar = (
  engine: BIRD.EngineContext,
  scene: BIRD.CollectionScene,
  layout: Layout,
) => {
  const ctx = engine.ctx;
  const { mouse } = engine.inputs;
  const { rects, fonts, texts, scale } = layout;
  const r = engine.canvas.pixel_ratio;
  const toolbar = rects[COLLECTION_LAYOUT_ELEMENTS.toolbar]!;
  const bottom = toolbar.y + toolbar.h;

  fill_rect(ctx, toolbar.x, 0, toolbar.w, bottom, TOOLBAR_BACKGROUND);
  fill_rect(ctx, toolbar.x, bottom - r, toolbar.w, r, TOOLBAR_BORDER);

  if (layout.visible[COLLECTION_LAYOUT_ELEMENTS.pick_bar] === 1) {
    const { pick_cancel, pick_hint, pick_note } = COLLECTION_LAYOUT_ELEMENTS;
    const cancel = rects[pick_cancel]!;
    const hover = is_hovered(mouse, cancel);
    const right = toolbar.x + toolbar.w - TOOLBAR_PAD * scale[pick_hint]!;

    fill_node_button(ctx, layout, pick_cancel, cancel.h / 2, hover ? CHIP_HOVER : CHIP, 0);
    draw_node_text(ctx, layout, pick_cancel, hover ? TEXT : TEXT_DIM, 0);

    draw_pick_line(ctx, layout, pick_hint, TEXT, right);
    draw_pick_line(ctx, layout, pick_note, TEXT_MUTED, right);
  }

  for (const chip of TOOLBAR_CHIPS) {
    if (layout.visible[chip.handle] === 0) {
      continue;
    }

    const rect = rects[chip.handle]!;
    const s = scale[chip.handle]!;
    const { x, y, w, h } = rect;
    const active = chip_active(scene, chip.action);
    const hover = is_hovered(mouse, rect);
    const center_y = y + h / 2;
    const dot = DOT_SIZE * s;
    let text_x = x + CHIP_PAD_X * s;

    fill_round_rect(ctx, x, y, w, h, h / 2, active ? CHIP_ACTIVE : hover ? CHIP_HOVER : CHIP);

    if (chip.dot !== null) {
      fill_circle(ctx, text_x + dot / 2, center_y, dot / 2, chip.dot);
      text_x += dot + (CHIP_PAD_X / 2) * s;
    }

    draw_text(
      ctx,
      texts[chip.handle]!,
      text_x,
      center_y,
      fonts[chip.handle]!,
      active || hover ? TEXT : TEXT_DIM,
      'start',
      'middle',
    );
  }
};

export const render_collection_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.CollectionScene,
) => {
  const ctx = engine.ctx;
  const layout = update_layout(COLLECTION_LAYOUT, engine, game);
  const view = layout.rects[COLLECTION_LAYOUT_ELEMENTS.grid_scroll]!;

  place_grid_camera(layout, scene);
  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, BACKGROUND);
  with_clip(ctx, view.x, view.y, view.w, view.h, () => render_grid(engine, game, scene, view));
  render_toolbar(engine, scene, layout);
  render_scrollbar(ctx, layout, COLLECTION_LAYOUT_ELEMENTS.grid_scroll);
};

const render_grid = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.CollectionScene,
  view: Rect,
) => {
  const ctx = engine.ctx;
  const camera = scene.camera;
  const shown = scene.shown;
  const breeding = game.breeding_scene;
  const picking = breeding.picking !== -1;
  const taken = picking ? breeding.parents[1 - breeding.picking]! : null;
  const first_row = Math.max(0, Math.floor(to_world_y(camera, view.y) / COLLECTION_ROW));
  const last_row = Math.floor(to_world_y(camera, view.y + view.h) / COLLECTION_ROW);
  const columns = scene.columns;
  const end = Math.min(shown.length, (last_row + 1) * columns);
  const start = first_row * columns;

  with_smoothing(ctx, false, () => {
    for (let i = start; i < end; i++) {
      const bird = shown[i]!;

      ctx.globalAlpha = picking && is_blocked(bird, taken) ? TAKEN_ALPHA : 1;
      render_bird_at(
        engine,
        game,
        camera,
        bird,
        collection_feet_x(i, columns),
        collection_feet_y(i, columns),
      );
    }
  });

  ctx.globalAlpha = 1;

  const name_px = NAME_SIZE * camera.zoom;

  if (name_px >= MIN_NAME_PX) {
    const font = pixel_font(name_px, 1, engine.canvas.dpr, 600);
    const reason_font = pixel_font(REASON_SIZE * camera.zoom, 1, engine.canvas.dpr, 400);
    const suppressed_font = pixel_font(SUPPRESSED_SIZE * camera.zoom, 1, engine.canvas.dpr, 600);

    for (let i = start; i < end; i++) {
      const bird = shown[i]!;
      const feet_y = collection_feet_y(i, columns);
      const x = Math.round(to_screen_x(camera, collection_feet_x(i, columns)));
      const y = Math.round(to_screen_y(camera, feet_y + NAME_GAP));

      draw_text(ctx, bird.name, x, y, font, name_color(bird), 'center', 'top');

      const below_name = feet_y + NAME_GAP + NAME_SIZE;

      if (has_gene_marks(bird)) {
        const gene_y = Math.round(to_screen_y(camera, below_name + SUPPRESSED_GAP));

        draw_gene_marks(ctx, bird, x, gene_y, suppressed_font, 'top');
      }

      if (is_blocked(bird, taken)) {
        const reason_y = Math.round(
          to_screen_y(camera, below_name + suppressed_space(bird) + REASON_GAP),
        );

        draw_volatile_text(
          ctx,
          block_reason(bird, taken),
          x,
          reason_y,
          reason_font,
          TEXT_DIM,
          'center',
          'top',
        );
      }
    }
  }

  if (shown.length === 0) {
    const r = engine.canvas.pixel_ratio;

    draw_text(
      ctx,
      'No birds match these filters',
      engine.canvas.width / 2,
      view.y + 48 * r,
      pixel_font(15, r, engine.canvas.dpr, 400),
      TEXT_DIM,
      'center',
      'alphabetic',
    );
  }

  const hit = scene.hover.hit;
  const hovered =
    hit === null ? -1 : shown[hit.index] === hit.bird ? hit.index : shown.indexOf(hit.bird);

  if (hovered !== -1) {
    const bird = shown[hovered]!;
    const reason_space =
      suppressed_space(bird) + (is_blocked(bird, taken) ? REASON_GAP + REASON_SIZE : 0);
    const left = (hovered % columns) * COLLECTION_CELL + FRAME_INSET;
    const top = Math.floor(hovered / columns) * COLLECTION_ROW + FRAME_INSET;

    render_hover_frame(
      engine,
      Math.round(to_screen_x(camera, left)),
      Math.round(to_screen_y(camera, top)),
      Math.round(to_screen_x(camera, left + COLLECTION_CELL - FRAME_INSET * 2)),
      Math.round(
        to_screen_y(
          camera,
          collection_feet_y(hovered, columns) + NAME_GAP + NAME_SIZE + reason_space + FRAME_INSET,
        ),
      ),
    );
  }
};
