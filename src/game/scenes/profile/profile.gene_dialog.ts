import {
  GENE_GROUPS,
  NO_SPECIAL,
  plumage_colors,
  type BirdGenes,
} from '../../entities/birds/bird.generator';
import { in_rect, is_clicked, is_hovered } from '../../entities/camera/camera';
import { rgb_css } from '../../utils/color';
import { fill_rect, fill_round_rect, fill_stroke_round_rect } from '../../utils/draw';
import { describe } from '../../utils/math';
import { draw_text, type PixelFont } from '../../utils/pixel_font';
import { draw_node_text, fill_node_button, update_layout } from '../../utils/layout';
import { BODY_ROWS, PLUMAGE_ROWS, TRAIT_ROWS, trait_text } from './profile.labels';
import { GENE_DIALOG_LAYOUT, GENE_DIALOG_LAYOUT_ELEMENTS } from './profile.gene_dialog.layout';
import { choose_gene, close_gene_dialog, confirm_gene } from './profile.state';
import { CONFIG } from '../../../config';

const ROW_PAD_X = CONFIG.profile.gene_dialog.row_pad_x;

const OVERLAY = CONFIG.theme.profile.overlay;
const PANEL = CONFIG.theme.profile.panel;
const BORDER = CONFIG.theme.profile.border;
const BUTTON = CONFIG.theme.profile.button;
const BUTTON_HOVER = CONFIG.theme.profile.button_hover;
const DANGER = CONFIG.theme.profile.danger;
const DANGER_HOVER = CONFIG.theme.profile.danger_hover;
const DOMINANT = CONFIG.theme.profile.dominant;
const DOMINANT_HOVER = CONFIG.theme.profile.dominant_hover;
const ROW = CONFIG.theme.profile.gene_row;
const ROW_HOVER = CONFIG.theme.profile.gene_row_hover;
const ROW_SELECTED = CONFIG.theme.profile.gene_row_selected;
const ROW_SELECTED_BORDER = CONFIG.theme.profile.gene_row_selected_border;
const TEXT = CONFIG.theme.text;
const TEXT_DIM = CONFIG.theme.text_dim;

const E = GENE_DIALOG_LAYOUT_ELEMENTS;

const ROW_VALUES = GENE_GROUPS.map(group => ({
  trait: TRAIT_ROWS.find(row => row.group === group)?.group ?? null,
  body: BODY_ROWS.find(row => row.gene === group) ?? null,
  part: PLUMAGE_ROWS.find(row => row.group === group)?.part ?? null,
}));

export const handle_gene_dialog_input = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const { kb, mouse } = engine.inputs;
  const scene = game.profile_scene;
  const layout = update_layout(GENE_DIALOG_LAYOUT, engine, game);
  const rects = layout.rects;
  const click = mouse.click;
  let row = -1;

  for (let i = 0; i < E.rows.length; i++) {
    if (is_clicked(mouse, rects[E.rows[i]!]!)) {
      row = i;
    }
  }

  const close =
    kb.Escape ||
    is_clicked(mouse, rects[E.cancel]!) ||
    (click && !in_rect(rects[E.dialog]!, mouse.x, mouse.y));
  const confirm = is_clicked(mouse, rects[E.confirm]!) && scene.gene_choice !== null;

  kb.Escape = false;
  kb.ArrowLeft = false;
  kb.ArrowRight = false;
  mouse.click = false;
  mouse.double_click = false;

  if (close) {
    close_gene_dialog(scene);
  } else if (row !== -1) {
    choose_gene(scene, GENE_GROUPS[row]!);
  } else if (confirm && scene.gene_armed) {
    confirm_gene(game);
  } else if (confirm) {
    scene.gene_armed = true;
  } else if (click) {
    scene.gene_armed = false;
  }
};

const render_row_value = (
  ctx: CanvasRenderingContext2D,
  genes: BirdGenes,
  colors: ReturnType<typeof plumage_colors>,
  i: number,
  right: number,
  mid: number,
  font: PixelFont,
  s: number,
) => {
  const { trait, body, part } = ROW_VALUES[i]!;

  if (trait !== null) {
    const text = trait_text(genes.special ?? NO_SPECIAL, trait);

    draw_text(ctx, text, right, mid, font, TEXT_DIM, 'end', 'middle');
  } else if (body !== null) {
    const value = genes[body.gene];

    draw_text(ctx, describe(value, body.words), right, mid, font, TEXT_DIM, 'end', 'middle');
  } else if (part !== null) {
    const color = colors[part];
    const w = 48 * s;
    const h = 12 * s;

    const css = rgb_css([color[0], color[1], color[2]], 1);

    fill_round_rect(ctx, right - w, mid - h / 2, w, h, 4 * s, css);
  }
};

export const render_gene_dialog = (engine: BIRD.EngineContext, game: BIRD.GameState) => {
  const scene = game.profile_scene;
  const bird = scene.bird;

  if (bird === null) {
    return;
  }

  const ctx = engine.ctx;
  const mouse = engine.inputs.mouse;
  const layout = update_layout(GENE_DIALOG_LAYOUT, engine, game);
  const { rects, fonts, texts } = layout;
  const dialog = rects[E.dialog]!;
  const s = layout.scale[E.dialog]!;
  const genes = bird.behaviour.genes;
  const colors = plumage_colors(genes);

  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, OVERLAY);
  fill_stroke_round_rect(
    ctx,
    dialog.x,
    dialog.y,
    dialog.w,
    dialog.h,
    12 * s,
    PANEL,
    BORDER,
    Math.max(1, s),
  );
  draw_node_text(ctx, layout, E.title, TEXT, 0);
  draw_node_text(ctx, layout, E.note, TEXT_DIM, 0);

  for (let i = 0; i < E.rows.length; i++) {
    const id = E.rows[i]!;
    const rect = rects[id]!;
    const mid = rect.y + rect.h / 2;

    if (layout.visible[id] === 0) {
      continue;
    }

    if (GENE_GROUPS[i] === scene.gene_choice) {
      fill_stroke_round_rect(
        ctx,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        6 * s,
        ROW_SELECTED,
        ROW_SELECTED_BORDER,
        Math.max(1, s),
      );
    } else {
      fill_round_rect(
        ctx,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        6 * s,
        is_hovered(mouse, rect) ? ROW_HOVER : ROW,
      );
    }

    draw_text(ctx, texts[id]!, rect.x + ROW_PAD_X * s, mid, fonts[id]!, TEXT, 'start', 'middle');
    render_row_value(ctx, genes, colors, i, rect.x + rect.w - ROW_PAD_X * s, mid, fonts[id]!, s);
  }

  const cancel = rects[E.cancel]!;
  const confirm = rects[E.confirm]!;
  const chosen = scene.gene_choice !== null;
  const bright = scene.gene_armed || is_hovered(mouse, confirm);
  const confirm_color = !chosen
    ? BUTTON
    : scene.gene_dialog === 'suppress'
      ? bright
        ? DANGER_HOVER
        : DANGER
      : bright
        ? DOMINANT_HOVER
        : DOMINANT;

  fill_node_button(
    ctx,
    layout,
    E.cancel,
    cancel.h / 2,
    is_hovered(mouse, cancel) ? BUTTON_HOVER : BUTTON,
    0,
  );
  draw_node_text(ctx, layout, E.cancel, TEXT, 0);
  fill_node_button(ctx, layout, E.confirm, confirm.h / 2, confirm_color, 0);
  draw_node_text(ctx, layout, E.confirm, chosen ? TEXT : TEXT_DIM, 0);
};
