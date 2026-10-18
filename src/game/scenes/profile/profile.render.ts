import {
  has_trait,
  NO_SPECIAL,
  plumage_colors,
  RARITY_INFO,
  rarity_of,
  rarity_score,
  SPRITE_SIZE,
  type GeneGroup,
} from '../../entities/birds/bird.generator';
import {
  age_label,
  breeding_label,
  can_breed_bird,
  growth_of,
  not_breedable_reason,
  stage_label,
} from '../../entities/birds/birds.age';
import { can_release_bird } from '../../entities/birds/birds';
import { joy_label } from '../../entities/birds/birds.joy';
import { draw_bird_sprite } from '../../entities/birds/birds.renderer';
import { is_hovered, type Rect } from '../../entities/camera/camera';
import { __opt_remember_shape } from '../../../engine/shape';
import { rgb_css } from '../../utils/color';
import { describe } from '../../utils/math';
import {
  fill_circle,
  fill_rect,
  fill_round_rect,
  fill_stroke_round_rect,
  fill_tip,
  progress_bar,
  stroke_polyline3,
  tip_width,
  with_clip,
  with_smoothing,
} from '../../utils/draw';
import { draw_text, draw_text_fit, pixel_font, type PixelFont } from '../../utils/pixel_font';
import {
  BIRD_ROWS,
  bird_row_text,
  shown_trait_rows,
  BODY_ROWS,
  PLUMAGE_ROWS,
  RARITY_LABELS,
  DOMINANT_LABELS,
  SUPPRESSED_LABELS,
  temper_line,
  trait_text,
  TRAIT_ROWS,
} from './profile.labels';
import { render_gene_dialog } from './profile.gene_dialog';
import { draw_icon_centered, type PixelIcon } from '../../utils/pixel_icon';
import {
  DOMINATE_ICON,
  RELEASE_ICON,
  RENAME_ICON,
  SHOW_ICON,
  SUPPRESS_ICON,
} from './profile.icons';
import { BREEDING_ICON } from '../../entities/ui/scene_bar.icons';
import { BREED_LABEL } from '../breeding/breeding.layout';
import {
  PROFILE_LAYOUT,
  PROFILE_LAYOUT_ELEMENTS,
  RELEASE_BLOCKED_LABEL,
  RELEASE_CONFIRM_LABEL,
  RELEASE_LABEL,
  RENAME_LABEL,
  SHOW_LABEL,
  SUPPRESS_LABEL,
  DOMINATE_LABEL,
} from './profile.layout';
import {
  draw_node_text,
  fill_node_button,
  node_hovered,
  update_layout,
  type Layout,
} from '../../utils/layout';
import { icon_alpha } from '../../entities/ui/icon_alpha';
import { render_scrollbar } from '../../entities/ui/scrollbar';
import { CONFIG } from '../../../config';

const BACKGROUND = CONFIG.theme.background;
const PANEL = CONFIG.theme.profile.panel;
const BORDER = CONFIG.theme.profile.border;
const BUTTON = CONFIG.theme.profile.button;
const BUTTON_HOVER = CONFIG.theme.profile.button_hover;
const DANGER = CONFIG.theme.profile.danger;
const DANGER_HOVER = CONFIG.theme.profile.danger_hover;
const TOOLS_BACKGROUND = CONFIG.theme.scene_bar.background;
const TOOLS_BORDER = CONFIG.theme.scene_bar.border;
const TOOL_HOVER = CONFIG.theme.scene_bar.button_hover;
const TIP_FONT_SIZE = CONFIG.scene_bar.tip_font_size;
const TIP_PAD_X = CONFIG.scene_bar.tip_pad_x;
const TIP_HEIGHT = CONFIG.scene_bar.tip_height;
const TIP_GAP = CONFIG.scene_bar.tip_gap;
const TEXT = CONFIG.theme.text;
const TEXT_DIM = CONFIG.theme.text_dim;
const SUPPRESSED_LABEL = CONFIG.theme.suppressed_gene;
const DOMINANT_LABEL = CONFIG.theme.dominant_gene;
const SECTION = CONFIG.theme.text_muted;
const BAR_TRACK = CONFIG.theme.background;
const BAR_FILL = CONFIG.theme.accent;

const PANEL_PAD = CONFIG.profile.panel_pad;
const HEADER_H = CONFIG.profile.header_height;
const SECTION_GAP = CONFIG.profile.section_gap;
const SECTION_TITLE_H = CONFIG.profile.section_title_height;
const ROW_H = CONFIG.profile.row_height;
const VALUE_OFFSET = CONFIG.profile.value_offset;

const box = (ctx: CanvasRenderingContext2D, rect: Rect, radius: number, s: number) =>
  fill_stroke_round_rect(
    ctx,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    radius,
    PANEL,
    BORDER,
    Math.max(1, s),
  );

const TOOLS = [
  { id: PROFILE_LAYOUT_ELEMENTS.show, icon: SHOW_ICON },
  { id: PROFILE_LAYOUT_ELEMENTS.breed, icon: BREEDING_ICON },
  { id: PROFILE_LAYOUT_ELEMENTS.rename, icon: RENAME_ICON },
  { id: PROFILE_LAYOUT_ELEMENTS.suppress, icon: SUPPRESS_ICON },
  { id: PROFILE_LAYOUT_ELEMENTS.dominate, icon: DOMINATE_ICON },
  { id: PROFILE_LAYOUT_ELEMENTS.release, icon: RELEASE_ICON },
] as const;

const gene_label_color = (bird: BIRD.Bird, group: GeneGroup | null) =>
  group === null
    ? TEXT_DIM
    : group === bird.suppressed
      ? SUPPRESSED_LABEL
      : group === bird.dominant
        ? DOMINANT_LABEL
        : TEXT_DIM;

const button = (engine: BIRD.EngineContext, layout: Layout, id: number) => {
  const rect = layout.rects[id]!;
  const hover = is_hovered(engine.inputs.mouse, rect);

  fill_node_button(engine.ctx, layout, id, rect.h / 2, hover ? BUTTON_HOVER : BUTTON, 0);
};

const tool = (
  engine: BIRD.EngineContext,
  layout: Layout,
  id: number,
  icon: PixelIcon,
  danger: boolean,
  disabled: boolean,
  s: number,
) => {
  const ctx = engine.ctx;
  const rect = layout.rects[id]!;
  const hover = node_hovered(layout, id, engine.inputs.mouse);
  const scale = Math.max(1, Math.round(icon.scale * s));

  if (danger || (hover && !disabled)) {
    const color = danger ? (hover ? DANGER_HOVER : DANGER) : TOOL_HOVER;

    fill_round_rect(ctx, rect.x, rect.y, rect.w, rect.h, rect.w / 3, color);
  }

  ctx.globalAlpha = icon_alpha(danger, hover, !disabled);
  draw_icon_centered(ctx, icon, rect, scale / icon.scale);
  ctx.globalAlpha = 1;

  return hover;
};

const render_tools = (
  engine: BIRD.EngineContext,
  bird: BIRD.Bird,
  layout: Layout,
  armed: boolean,
  releasable: boolean,
  s: number,
) => {
  const ctx = engine.ctx;
  const E = PROFILE_LAYOUT_ELEMENTS;
  const tools = layout.rects[E.tools]!;
  const show = layout.rects[E.show]!;
  const breedable = can_breed_bird(bird);

  fill_stroke_round_rect(
    ctx,
    tools.x,
    tools.y,
    tools.w,
    tools.h,
    show.w / 3 + (show.x - tools.x),
    TOOLS_BACKGROUND,
    TOOLS_BORDER,
    Math.max(1, s),
  );

  const hovered = with_smoothing(ctx, false, () => {
    let hovered = -1;

    for (const { id, icon } of TOOLS) {
      const danger = id === E.release && armed;
      const disabled =
        id === E.breed
          ? !breedable
          : id === E.release
            ? !releasable
            : id === E.suppress
              ? bird.suppressed !== null
              : id === E.dominate && bird.dominant !== null;

      if (tool(engine, layout, id, icon, danger, disabled, s) && hovered === -1) {
        hovered = id;
      }
    }

    return hovered;
  });
  const tip = armed ? E.release : hovered;

  if (tip === -1) {
    return;
  }

  const label =
    tip === E.show
      ? SHOW_LABEL
      : tip === E.breed
        ? (not_breedable_reason(bird) ?? BREED_LABEL)
        : tip === E.rename
          ? RENAME_LABEL
          : tip === E.suppress
            ? bird.suppressed !== null
              ? SUPPRESSED_LABELS[bird.suppressed]
              : SUPPRESS_LABEL
            : tip === E.dominate
              ? bird.dominant !== null
                ? DOMINANT_LABELS[bird.dominant]
                : DOMINATE_LABEL
              : !releasable
                ? RELEASE_BLOCKED_LABEL
                : armed
                  ? RELEASE_CONFIRM_LABEL
                  : RELEASE_LABEL;
  const rect = layout.rects[tip]!;
  const tip_font = pixel_font(TIP_FONT_SIZE, s, engine.canvas.dpr, 600);
  const tip_w = tip_width(label, tip_font, TIP_PAD_X * s);
  const tip_h = Math.round(TIP_HEIGHT * s);
  const row = tools.w > tools.h;
  const body = layout.rects[E.body]!;
  const tip_x = row
    ? Math.round(
        Math.min(Math.max(rect.x + rect.w / 2 - tip_w / 2, body.x), body.x + body.w - tip_w),
      )
    : Math.round(tools.x - TIP_GAP * s - tip_w);
  const tip_y = row
    ? Math.round(tools.y - TIP_GAP * s - tip_h)
    : Math.round(rect.y + rect.h / 2 - tip_h / 2);

  fill_tip(ctx, label, tip_x, tip_y, tip_w, tip_h, s, tip_font, TOOLS_BACKGROUND, TEXT);
};

const chevron = (ctx: CanvasRenderingContext2D, rect: Rect, dir: -1 | 1, r: number) => {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const d = rect.h * 0.15;
  const tip = (d / 2) * dir;

  stroke_polyline3(ctx, cx - tip, cy - d, cx + tip, cy, cx - tip, cy + d, TEXT, 2 * r);
};

type PanelCursor = {
  y: number;
  left: number;
  right: number;
  value_x: number;
  dot: number;
  s: number;
  dpr: number;
};

const panel_cursor = (rect: Rect, s: number, dpr: number): PanelCursor => {
  const left = rect.x + PANEL_PAD * s;

  return {
    y: rect.y + PANEL_PAD * s,
    left,
    right: rect.x + rect.w - PANEL_PAD * s,
    value_x: left + VALUE_OFFSET * s,
    dot: 10 * s,
    s,
    dpr,
  };
};

__opt_remember_shape(panel_cursor({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 0.5, 0.5));

const panel_section = (ctx: CanvasRenderingContext2D, w: PanelCursor, title: string) => {
  const s = w.s;

  w.y += SECTION_GAP * s;
  draw_text(
    ctx,
    title,
    w.left,
    w.y + (SECTION_TITLE_H * s) / 2,
    pixel_font(11, s, w.dpr, 700),
    SECTION,
    'start',
    'middle',
  );
  w.y += SECTION_TITLE_H * s;
};

const panel_label = (
  ctx: CanvasRenderingContext2D,
  w: PanelCursor,
  label: string,
  color: string,
) => {
  const s = w.s;
  const mid = w.y + (ROW_H * s) / 2;

  draw_text(ctx, label, w.left, mid, pixel_font(14, s, w.dpr, 400), color, 'start', 'middle');
  w.y += ROW_H * s;

  return mid;
};

const panel_bar = (
  ctx: CanvasRenderingContext2D,
  w: PanelCursor,
  label: string,
  label_color: string,
  value: number,
  word: string,
) => {
  const s = w.s;
  const mid = panel_label(ctx, w, label, label_color);
  const bar_w = (w.right - w.value_x) * 0.45;
  const bar_h = 6 * s;

  progress_bar(ctx, w.value_x, mid - bar_h / 2, bar_w, bar_h, 4, value, BAR_TRACK, BAR_FILL, s);
  draw_text(
    ctx,
    word,
    w.value_x + bar_w + 12 * s,
    mid,
    pixel_font(14, s, w.dpr, 600),
    TEXT,
    'start',
    'middle',
  );
};

const panel_row = (
  ctx: CanvasRenderingContext2D,
  w: PanelCursor,
  label: string,
  label_color: string,
  value: string,
  is_set: boolean,
  swatch: string | null,
) => {
  const s = w.s;
  const mid = panel_label(ctx, w, label, label_color);
  let x = w.value_x;

  if (swatch !== null) {
    fill_circle(ctx, x + w.dot / 2, mid, w.dot / 2, swatch);
    x += w.dot + 8 * s;
  }

  draw_text(
    ctx,
    value,
    x,
    mid,
    pixel_font(14, s, w.dpr, is_set ? 600 : 400),
    is_set ? TEXT : TEXT_DIM,
    'start',
    'middle',
  );
};

const render_panel = (
  ctx: CanvasRenderingContext2D,
  bird: BIRD.Bird,
  rect: Rect,
  s: number,
  dpr: number,
) => {
  const g = bird.behaviour.genes;
  const special = g.special ?? NO_SPECIAL;
  const rarity = rarity_of(g);
  const w = panel_cursor(rect, s, dpr);

  box(ctx, rect, 12 * s, s);

  const color = RARITY_INFO[rarity].color;
  const rarity_line = `${RARITY_LABELS[rarity]} - ${rarity_score(g)} pts`;

  fill_circle(ctx, w.left + w.dot / 2, w.y + 10 * s, w.dot / 2, color);
  draw_text(
    ctx,
    rarity_line,
    w.left + w.dot + 8 * s,
    w.y + 10 * s,
    pixel_font(15, s, w.dpr, 600),
    color,
    'start',
    'middle',
  );
  draw_text_fit(
    ctx,
    temper_line(bird),
    w.left,
    w.y + 36 * s,
    pixel_font(13, s, w.dpr, 400),
    TEXT_DIM,
    'start',
    'middle',
    w.right - w.left,
  );
  w.y += HEADER_H * s;

  panel_section(ctx, w, 'LIFE');
  panel_bar(ctx, w, 'Stage', TEXT_DIM, growth_of(bird), stage_label(bird));
  panel_row(ctx, w, 'Age', TEXT_DIM, age_label(bird), true, null);
  panel_row(ctx, w, 'Breeding', TEXT_DIM, breeding_label(bird), can_breed_bird(bird), null);
  panel_bar(ctx, w, 'Joy', TEXT_DIM, bird.joy, joy_label(bird));

  if (shown_trait_rows(bird) > 0) {
    panel_section(ctx, w, 'TRAITS');
  }

  for (const row of TRAIT_ROWS) {
    if (!has_trait(special, row.group)) {
      continue;
    }

    const color = gene_label_color(bird, row.group);
    const hue = row.group === 'aura' ? special.aura_hue : special.eye_hue;
    const has_hue = row.group === 'aura' || row.group === 'eyes';
    const swatch = has_hue ? `hsl(${hue} 90% 65%)` : null;

    panel_row(ctx, w, row.label, color, trait_text(special, row.group), true, swatch);
  }

  for (const row of BIRD_ROWS) {
    if (bird[row.field] !== 'none') {
      panel_row(ctx, w, row.label, TEXT_DIM, bird_row_text(bird, row.field), true, null);
    }
  }

  panel_section(ctx, w, 'BODY');

  for (const row of BODY_ROWS) {
    const value = g[row.gene];

    const color = gene_label_color(bird, row.gene);

    panel_bar(ctx, w, row.label, color, value, describe(value, row.words));
  }

  panel_section(ctx, w, 'PLUMAGE');

  const colors = plumage_colors(g);
  const chip_w = (w.right - w.value_x) * 0.6;
  const chip_h = 14 * s;

  for (const row of PLUMAGE_ROWS) {
    const mid = panel_label(ctx, w, row.label, gene_label_color(bird, row.group));
    const color = colors[row.part];
    const css = rgb_css([color[0], color[1], color[2]], 1);

    fill_round_rect(ctx, w.value_x, mid - chip_h / 2, chip_w, chip_h, 4 * s, css);
  }
};

export const render_profile_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.ProfileScene,
) => {
  const ctx = engine.ctx;
  const r = engine.canvas.pixel_ratio;

  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, BACKGROUND);

  const bird = scene.bird;

  if (bird === null) {
    return;
  }

  const layout = update_layout(PROFILE_LAYOUT, engine, game);
  const { rects, visible, scale: scales } = layout;
  const E = PROFILE_LAYOUT_ELEMENTS;
  const s = scales[E.panel]!;

  button(engine, layout, E.back);
  draw_node_text(ctx, layout, E.back, TEXT, 0);

  if (visible[E.nav] === 1) {
    button(engine, layout, E.prev);
    button(engine, layout, E.next);
    chevron(ctx, rects[E.prev]!, -1, r);
    chevron(ctx, rects[E.next]!, 1, r);
    draw_node_text(ctx, layout, E.counter, TEXT_DIM, 0);
  }

  const content = () => {
    draw_node_text(ctx, layout, E.name, TEXT, 0);

    const preview = rects[E.preview]!;
    const scale = Math.max(1, Math.floor(preview.w / SPRITE_SIZE));
    const sprite = SPRITE_SIZE * scale;

    box(ctx, preview, 16 * s, s);
    with_smoothing(ctx, false, () =>
      draw_bird_sprite(
        engine,
        bird,
        Math.round(preview.x + (preview.w - sprite) / 2),
        Math.round(preview.y + (preview.h - sprite) / 2),
        sprite,
      ),
    );

    render_panel(ctx, bird, rects[E.panel]!, s, engine.canvas.dpr);
    render_tools(engine, bird, layout, scene.release_armed, can_release_bird(game), s);
  };

  if (visible[E.body] === 1) {
    const body = rects[E.body]!;

    with_clip(ctx, body.x, body.y, body.w, body.h, content);
    render_scrollbar(ctx, layout, E.body);
  } else {
    content();
  }

  if (scene.gene_dialog !== null) {
    render_gene_dialog(engine, game);
  }
};
