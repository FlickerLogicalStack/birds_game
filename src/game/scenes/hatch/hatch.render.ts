import type { Ctx2D } from '../../../engine/canvas';
import { FLOAT_ZERO } from '../../../engine/shape';
import { RARITY_INFO, SPRITE_SIZE, rarity_of } from '../../entities/birds/bird.generator';
import { draw_bird_sprite } from '../../entities/birds/birds.renderer';
import { is_hovered } from '../../entities/camera/camera';
import { BREEDING_ICON } from '../../entities/ui/scene_bar.icons';
import { fill_circle, fill_rect, with_smoothing } from '../../utils/draw';
import {
  DEG,
  FULL_TURN_DEG,
  MS_PER_SECOND,
  arc01,
  clamp01,
  lerp,
  mod,
  smoothstep,
} from '../../utils/math';
import { draw_text_fit } from '../../utils/pixel_font';
import { icon_canvas } from '../../utils/pixel_icon';
import { create_rng, range, spread } from '../../utils/random';
import { draw_node_text, fill_node_button, update_layout } from '../../utils/layout';
import { name_color } from '../collection/collection.render';
import { HATCH_LAYOUT, HATCH_LAYOUT_ELEMENTS } from './hatch.layout';
import { BIRD_AT, BUTTONS_AT, DONE_AT, NAME_AT, hatch_time } from './hatch.state';
import { CONFIG } from '../../../config';

const BACKGROUND = CONFIG.theme.background;
const TEXT = CONFIG.theme.text;
const TEXT_DIM = CONFIG.theme.text_dim;
const MAIN_BUTTON = CONFIG.theme.breeding.button;
const MAIN_BUTTON_HOVER = CONFIG.theme.breeding.button_hover;
const BUTTON = CONFIG.theme.profile.button;
const BUTTON_HOVER = CONFIG.theme.profile.button_hover;
const FLASH = CONFIG.theme.hatch.flash;
const SPARKLE = CONFIG.theme.hatch.sparkle;
const MARGIN = CONFIG.hatch.margin;
const FADE_IN_MS = CONFIG.hatch.fade_in_ms;
const FLASH_MS = CONFIG.hatch.flash_ms;
const POP_MS = CONFIG.hatch.pop_ms;
const UI_MS = CONFIG.hatch.ui_ms;
const EGG_SIZE = CONFIG.hatch.egg_size;
const WOBBLE = CONFIG.hatch.wobble_deg * DEG;
const WOBBLE_MS = CONFIG.hatch.wobble_ms;
const RAYS = CONFIG.hatch.rays;
const RAY_TURN_MS = CONFIG.hatch.ray_turn_s * MS_PER_SECOND;
const RAY_ALPHA = CONFIG.hatch.ray_alpha;
const GLOW_ALPHA = CONFIG.hatch.glow_alpha;
const GLOW_MS = CONFIG.hatch.glow_ms;
const SPARKLES = CONFIG.hatch.sparkles;
const RISE_MS = CONFIG.hatch.sparkle_rise_ms;
const TWINKLE_MS = CONFIG.hatch.sparkle_twinkle_ms;
const SHARDS = CONFIG.hatch.shards;

const TURN = FULL_TURN_DEG * DEG;
const DIM_POWER = 0.45;
const RAYS_REACH = 1.5;
const SPARKLES_W = 1.6;
const SPARKLES_H = 1.4;
const SHARDS_REACH = 0.45;
const SHARDS_FALL = 0.3;
const SHARDS_MS = FLASH_MS + POP_MS;
const POP_FROM = 0.3;
const SLIDE = 8;
const BUTTON_RADIUS = 8;
const SHELL = [BREEDING_ICON.palette.w!, BREEDING_ICON.palette.W!, BREEDING_ICON.palette.s!];

const ease_out = (k: number) => 1 - (1 - k) * (1 - k);

const ease_out_back = (k: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * (k - 1) ** 3 + c1 * (k - 1) ** 2;
};

const rng = create_rng(0x4a7c);
const sparkle_x = new Float32Array(SPARKLES);
const sparkle_speed = new Float32Array(SPARKLES);
const sparkle_phase = new Float32Array(SPARKLES);
const sparkle_twinkle = new Float32Array(SPARKLES);
const sparkle_cross = new Uint8Array(SPARKLES);
const shard_angle = new Float32Array(SHARDS);
const shard_reach = new Float32Array(SHARDS);
const shard_size = new Uint8Array(SHARDS);
const shard_color = new Uint8Array(SHARDS);

for (let i = 0; i < SPARKLES; i++) {
  sparkle_x[i] = spread(rng, 1);
  sparkle_speed[i] = range(rng, 0.5, 1.5);
  sparkle_phase[i] = rng();
  sparkle_twinkle[i] = rng() * TURN;
  sparkle_cross[i] = rng() < 0.3 ? 1 : 0;
}

for (let i = 0; i < SHARDS; i++) {
  shard_angle[i] = ((i + spread(rng, 0.3)) / SHARDS) * TURN;
  shard_reach[i] = range(rng, 0.6, 1);
  shard_size[i] = rng() < 0.5 ? 1 : 2;
  shard_color[i] = Math.floor(rng() * SHELL.length);
}

type Fade = { color: string; radius: number; gradient: CanvasGradient | null };

const RAYS_FADE: Fade = { color: '', radius: FLOAT_ZERO, gradient: null };
const GLOW_FADE: Fade = { color: '', radius: FLOAT_ZERO, gradient: null };

const fading = (ctx: Ctx2D, fade: Fade, color: string, radius: number) => {
  if (fade.gradient === null || fade.color !== color || fade.radius !== radius) {
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);

    gradient.addColorStop(0, color);
    gradient.addColorStop(1, `${color}00`);
    fade.gradient = gradient;
    fade.color = color;
    fade.radius = radius;
  }

  return fade.gradient;
};

const render_backdrop = (
  ctx: Ctx2D,
  elapsed: number,
  power: number,
  cx: number,
  cy: number,
  side: number,
  color: string,
  s: number,
) => {
  const reach = side * RAYS_REACH;
  const step = TURN / RAYS;
  const pulse = 0.75 + 0.25 * Math.sin((elapsed / GLOW_MS) * TURN);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((elapsed / RAY_TURN_MS) * TURN);
  ctx.globalAlpha = RAY_ALPHA * power;
  ctx.fillStyle = fading(ctx, RAYS_FADE, color, reach);
  ctx.beginPath();

  for (let i = 0; i < RAYS; i++) {
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, reach, i * step, i * step + step / 2);
    ctx.closePath();
  }

  ctx.fill();
  ctx.globalAlpha = GLOW_ALPHA * power * pulse;
  ctx.fillStyle = fading(ctx, GLOW_FADE, color, side / 2);
  ctx.beginPath();
  ctx.arc(0, 0, side / 2, 0, TURN);
  ctx.fill();
  ctx.restore();

  const px = Math.max(1, Math.round(2 * s));
  const half_w = (side * SPARKLES_W) / 2;
  const h = side * SPARKLES_H;
  const bottom = cy + h / 2;

  for (let i = 0; i < SPARKLES; i++) {
    const speed = sparkle_speed[i]!;
    const twinkle = sparkle_twinkle[i]!;
    const rise = mod(sparkle_phase[i]! + (elapsed * speed) / RISE_MS, 1);
    const x = Math.round(cx + sparkle_x[i]! * half_w + Math.sin(rise * TURN + twinkle) * px * 2);
    const y = Math.round(bottom - rise * h);
    const sparkle_color = i % 2 === 0 ? color : SPARKLE;

    ctx.globalAlpha =
      power * arc01(rise) * (0.5 + 0.5 * Math.sin((elapsed / TWINKLE_MS) * speed * TURN + twinkle));

    if (sparkle_cross[i] === 1) {
      fill_rect(ctx, x - px, y, px * 3, px, sparkle_color);
      fill_rect(ctx, x, y - px, px, px * 3, sparkle_color);
    } else {
      fill_rect(ctx, x, y, px, px, sparkle_color);
    }
  }

  ctx.globalAlpha = 1;
};

const egg_pixel = (side: number) =>
  Math.max(1, Math.floor((side * EGG_SIZE) / icon_canvas(BREEDING_ICON).height));

const render_egg = (ctx: Ctx2D, scene: BIRD.HatchScene, cx: number, cy: number, side: number) => {
  const canvas = icon_canvas(BREEDING_ICON);
  const k = egg_pixel(side);
  const w = canvas.width * k;
  const h = canvas.height * k;
  const grow = clamp01(scene.elapsed / Math.max(1, scene.hatch_at));

  ctx.save();
  ctx.globalAlpha = smoothstep(0, FADE_IN_MS, scene.elapsed);
  ctx.translate(Math.round(cx), Math.round(cy + h / 2));
  ctx.rotate(WOBBLE * grow * grow * Math.sin((scene.elapsed / WOBBLE_MS) * TURN));
  with_smoothing(ctx, false, () => ctx.drawImage(canvas, -Math.round(w / 2), -h, w, h));
  ctx.restore();
};

const render_flash = (
  engine: BIRD.EngineContext,
  t: number,
  cx: number,
  cy: number,
  side: number,
) => {
  const ctx = engine.ctx;
  const k = t / FLASH_MS;

  if (k >= 1) {
    return;
  }

  const fade = 1 - k;

  ctx.globalAlpha = 0.4 * fade * fade;
  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, FLASH);
  ctx.globalAlpha = fade;
  fill_circle(ctx, cx, cy, (side / 2) * lerp(0.25, 1.1, ease_out(k)), FLASH);
  ctx.globalAlpha = 1;
};

const render_shards = (ctx: Ctx2D, t: number, cx: number, cy: number, side: number) => {
  const k = t / SHARDS_MS;

  if (k >= 1) {
    return;
  }

  const px = egg_pixel(side);
  const fly = side * SHARDS_REACH * ease_out(k);
  const fall = side * SHARDS_FALL * k * k;

  ctx.globalAlpha = 1 - k;

  for (let i = 0; i < SHARDS; i++) {
    const angle = shard_angle[i]!;
    const size = px * shard_size[i]!;
    const dist = fly * shard_reach[i]!;

    fill_rect(
      ctx,
      Math.round(cx + Math.cos(angle) * dist - size / 2),
      Math.round(cy + Math.sin(angle) * dist + fall - size / 2),
      size,
      size,
      SHELL[shard_color[i]!]!,
    );
  }

  ctx.globalAlpha = 1;
};

const render_bird = (
  engine: BIRD.EngineContext,
  bird: BIRD.Bird,
  t: number,
  cx: number,
  cy: number,
  side: number,
) => {
  const ctx = engine.ctx;
  const k = clamp01((t - BIRD_AT) / POP_MS);

  if (k <= 0) {
    return;
  }

  const full = SPRITE_SIZE * Math.max(1, Math.floor(side / SPRITE_SIZE));
  const size = Math.round(full * lerp(POP_FROM, 1, ease_out_back(k)));

  ctx.globalAlpha = smoothstep(0, 0.3, k);
  with_smoothing(ctx, false, () =>
    draw_bird_sprite(engine, bird, Math.round(cx - size / 2), Math.round(cy - size / 2), size),
  );
  ctx.globalAlpha = 1;
};

export const render_hatch_scene = (
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
  scene: BIRD.HatchScene,
) => {
  const ctx = engine.ctx;
  const mouse = engine.inputs.mouse;
  const layout = update_layout(HATCH_LAYOUT, engine, game);
  const { rects, fonts, scale } = layout;
  const E = HATCH_LAYOUT_ELEMENTS;
  const s = scale[E.stage]!;
  const stage = rects[E.stage]!;
  const side = stage.w;
  const cx = stage.x + side / 2;
  const cy = stage.y + stage.h / 2;
  const bird = scene.bird;
  const t = hatch_time(scene);
  const color = bird === null ? TEXT_DIM : RARITY_INFO[rarity_of(bird.behaviour.genes)].color;
  const appear = smoothstep(0, FADE_IN_MS, scene.elapsed);
  const power = appear * (t < 0 ? DIM_POWER : lerp(DIM_POWER, 1, clamp01(t / FLASH_MS)));
  const slide = SLIDE * s;

  fill_rect(ctx, 0, 0, engine.canvas.width, engine.canvas.height, BACKGROUND);
  render_backdrop(ctx, scene.elapsed, power, cx, cy, side, color, s);

  if (t < 0) {
    render_egg(ctx, scene, cx, cy, side);
    ctx.globalAlpha = appear;
    draw_node_text(ctx, layout, E.title, TEXT_DIM, 0);
  } else {
    render_shards(ctx, t, cx, cy, side);

    if (bird !== null) {
      render_bird(engine, bird, t, cx, cy - 30, side);
    }

    render_flash(engine, t, cx, cy, side);
    ctx.globalAlpha = ease_out(clamp01((t - BIRD_AT) / POP_MS));
    draw_node_text(ctx, layout, E.title, TEXT, 0);
  }

  ctx.globalAlpha = 1;

  if (bird === null) {
    return;
  }

  const name_k = ease_out(clamp01((t - NAME_AT) / UI_MS));
  const name = rects[E.name]!;

  ctx.globalAlpha = name_k;
  draw_text_fit(
    ctx,
    bird.name,
    name.x + name.w / 2,
    name.y + name.h / 2 + (1 - name_k) * slide,
    fonts[E.name]!,
    name_color(bird),
    'center',
    'middle',
    engine.canvas.width - 2 * MARGIN * scale[E.title]!,
  );
  ctx.globalAlpha = 1;

  const buttons_k = ease_out(clamp01((t - BUTTONS_AT) / UI_MS));
  const dy = Math.round((1 - buttons_k) * slide);
  const done = t >= DONE_AT;
  const radius = BUTTON_RADIUS * s;
  const profile_hover = done && is_hovered(mouse, rects[E.profile]!);
  const tree_hover = done && is_hovered(mouse, rects[E.tree]!);
  const next_hover = done && is_hovered(mouse, rects[E.next]!);

  ctx.globalAlpha = buttons_k;
  fill_node_button(
    ctx,
    layout,
    E.profile,
    radius,
    profile_hover ? MAIN_BUTTON_HOVER : MAIN_BUTTON,
    dy,
  );
  draw_node_text(ctx, layout, E.profile, TEXT, dy);
  fill_node_button(ctx, layout, E.tree, radius, tree_hover ? BUTTON_HOVER : BUTTON, dy);
  draw_node_text(ctx, layout, E.tree, TEXT, dy);
  fill_node_button(ctx, layout, E.next, radius, next_hover ? BUTTON_HOVER : BUTTON, dy);
  draw_node_text(ctx, layout, E.next, TEXT, dy);
  ctx.globalAlpha = 1;
};
