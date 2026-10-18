import { in_rect, is_clicked, is_hovered, type Rect } from '../entities/camera/camera';
import type { MouseInputs } from '../../engine/inputs';
import { draw_text, measure_text, pixel_font, type PixelFont } from './pixel_font';
import { fill_round_rect } from './draw';
import type { Ctx2D } from '../../engine/canvas';
import { FLOAT_ZERO } from '../../engine/shape';
import { clamp } from './math';
import { CONFIG } from '../../config';

const MOBILE_WIDTH = CONFIG.screen.mobile_width;
const SCROLL_VELOCITY_MS = CONFIG.input.scroll_velocity_ms;
const SCROLL_FRICTION_MS = CONFIG.input.scroll_friction_ms;
const SCROLL_MIN_SPEED = CONFIG.input.scroll_min_speed;

const COLUMN = 0;
const ROW = 1;
const BOX = 2;
const TEXT = 3;
const SQUARE = 4;
const FIT = 5;
const WHEN = 6;
const DEVICE = 7;
const WRAP = 8;
const SCROLL = 9;

export type Align = 'start' | 'center' | 'end';

const ALIGN: Record<Align, number> = { start: 0, center: 0.5, end: 1 };

export type Justify = Align | 'space-between';

const SPACE_BETWEEN = -1;

const JUSTIFY: Record<Justify, number> = { ...ALIGN, 'space-between': SPACE_BETWEEN };

export type Pad =
  number | { x?: number; y?: number; top?: number; right?: number; bottom?: number; left?: number };

type NodeSpec = {
  kind: number;
  children: number[];
  w: number;
  h: number;
  max_w_frac: number;
  grow: number;
  gap: number;
  pad_top: number;
  pad_right: number;
  pad_bottom: number;
  pad_left: number;
  align: number;
  justify: number;
  font_size: number;
  weight: number;
  pad_x: number;
  lead: number;
  screen_center: number;
  value: ((game: BIRD.GameState) => string) | null;
  when: ((game: BIRD.GameState) => boolean) | null;
  h_of: ((game: BIRD.GameState) => number) | null;
};

export type ContainerProps = {
  gap?: number;
  pad?: Pad;
  align?: Align;
  justify?: Justify;
  grow?: number;
  cross?: number;
};
export type BoxProps = {
  w: number;
  h: number;
  max_w_frac?: number;
  grow?: number;
  h_of?: (game: BIRD.GameState) => number;
};
export type SquareProps = { size?: number; min?: number; grow?: number };
export type TextProps = {
  w?: number;
  h: number;
  pad_x?: number;
  lead?: number;
  font_size: number;
  weight?: number;
  grow?: number;
  screen_center?: boolean;
  value?: (game: BIRD.GameState) => string;
};

export type Layout = {
  rects: Rect[];
  fonts: PixelFont[];
  texts: string[];
  visible: Uint8Array;
  scale: Float32Array;
  root: number;
  kind: Uint8Array;
  child_start: Int16Array;
  child_count: Int16Array;
  child_list: Int16Array;
  w: Float32Array;
  h: Float32Array;
  max_w_frac: Float32Array;
  grow: Float32Array;
  gap: Float32Array;
  pad_top: Float32Array;
  pad_right: Float32Array;
  pad_bottom: Float32Array;
  pad_left: Float32Array;
  align: Float32Array;
  justify: Float32Array;
  font_size: Float32Array;
  weight: Float32Array;
  pad_x: Float32Array;
  lead: Float32Array;
  screen_center: Uint8Array;
  value: (((game: BIRD.GameState) => string) | null)[];
  when: (((game: BIRD.GameState) => boolean) | null)[];
  h_of: (((game: BIRD.GameState) => number) | null)[];
  shown: Uint8Array;
  mw: Float32Array;
  mh: Float32Array;
  iw: Float32Array;
  ih: Float32Array;
  text_w: Float32Array;
  scroll_y: Float32Array;
  scroll_max: Float32Array;
  scroll_v: Float32Array;
  scroll_idle: Float32Array;
  scroll_drag: Uint8Array;
  scroll_caught: Uint8Array;
  clip: Int16Array;
  moved: number;
  view_h: number;
  width: number;
  height: number;
  pixel_ratio: number;
  dpr: number;
  safe_top: number;
  safe_right: number;
  safe_bottom: number;
  safe_left: number;
};

const spec = (kind: number): NodeSpec => ({
  kind,
  children: [],
  w: 0,
  h: 0,
  max_w_frac: 0,
  grow: 0,
  gap: 0,
  pad_top: 0,
  pad_right: 0,
  pad_bottom: 0,
  pad_left: 0,
  align: 0.5,
  justify: 0,
  font_size: 0,
  weight: 400,
  pad_x: 0,
  lead: 0,
  screen_center: 0,
  value: null,
  when: null,
  h_of: null,
});

const container = (kind: number, props: ContainerProps, children: number[]): NodeSpec => {
  const pad = props.pad ?? 0;
  const p = typeof pad === 'number' ? { x: pad, y: pad } : pad;

  return {
    ...spec(kind),
    children,
    gap: props.gap ?? 0,
    grow: props.grow ?? 0,
    pad_top: p.top ?? p.y ?? 0,
    pad_right: p.right ?? p.x ?? 0,
    pad_bottom: p.bottom ?? p.y ?? 0,
    pad_left: p.left ?? p.x ?? 0,
    align: ALIGN[props.align ?? 'center'],
    justify: JUSTIFY[props.justify ?? 'start'],
    w: kind === COLUMN ? (props.cross ?? 0) : 0,
    h: kind === ROW ? (props.cross ?? 0) : 0,
  };
};

export const layout_builder = () => {
  const specs: NodeSpec[] = [];
  const add = (node: NodeSpec) => specs.push(node) - 1;

  return {
    column: (props: ContainerProps, children: number[]) => add(container(COLUMN, props, children)),

    row: (props: ContainerProps, children: number[]) => add(container(ROW, props, children)),

    wrap: (props: ContainerProps, children: number[]) =>
      add({ ...container(WRAP, props, children), align: ALIGN[props.align ?? 'start'] }),

    box: (props: BoxProps) =>
      add({
        ...spec(BOX),
        w: props.w,
        h: props.h,
        max_w_frac: props.max_w_frac ?? 0,
        grow: props.grow ?? 0,
        h_of: props.h_of ?? null,
      }),

    square: (props: SquareProps) =>
      add({ ...spec(SQUARE), w: props.size ?? 0, h: props.min ?? 0, grow: props.grow ?? 0 }),

    text: (props: TextProps) =>
      add({
        ...spec(TEXT),
        w: props.w ?? 0,
        h: props.h,
        pad_x: props.pad_x ?? 0,
        lead: props.lead ?? 0,
        font_size: props.font_size,
        weight: props.weight ?? 400,
        grow: props.grow ?? 0,
        screen_center: props.screen_center === true ? 1 : 0,
        value: props.value ?? null,
      }),

    fit: (props: { grow?: number }, child: number) =>
      add({ ...spec(FIT), children: [child], grow: props.grow ?? 0 }),

    device: (variants: { mobile: number; desktop: number }) =>
      add({ ...spec(DEVICE), children: [variants.mobile, variants.desktop] }),

    scroll: (props: { grow?: number }, child: number) =>
      add({ ...spec(SCROLL), children: [child], grow: props.grow ?? 0 }),

    when: (when: (game: BIRD.GameState) => boolean, child: number) =>
      add({ ...spec(WHEN), children: [child], when }),

    compile: (root: number): Layout => {
      const n = specs.length;
      const ints = (pick: (node: NodeSpec) => number) => Int16Array.from(specs, pick);
      const floats = (pick: (node: NodeSpec) => number) => Float32Array.from(specs, pick);
      const child_start: number[] = [];
      const clip = new Int16Array(n).fill(-1);
      let at = 0;

      for (const node of specs) {
        child_start.push(at);
        at += node.children.length;
      }

      const mark_clip = (id: number, scroll: number) => {
        if (scroll !== -1) {
          clip[id] = scroll;
        }

        for (const child of specs[id]!.children) {
          mark_clip(child, specs[id]!.kind === SCROLL ? id : scroll);
        }
      };

      mark_clip(root, -1);

      return {
        rects: specs.map(() => ({ x: 0, y: 0, w: 0, h: 0 })),
        fonts: specs.map(() => pixel_font(0, 1, 1, 400)),
        texts: specs.map(() => ''),
        visible: new Uint8Array(n),
        scale: new Float32Array(n),
        root,
        kind: Uint8Array.from(specs, node => node.kind),
        child_start: Int16Array.from(child_start),
        child_count: ints(node => node.children.length),
        child_list: Int16Array.from(specs.flatMap(node => node.children)),
        w: floats(node => node.w),
        h: floats(node => node.h),
        max_w_frac: floats(node => node.max_w_frac),
        grow: floats(node => node.grow),
        gap: floats(node => node.gap),
        pad_top: floats(node => node.pad_top),
        pad_right: floats(node => node.pad_right),
        pad_bottom: floats(node => node.pad_bottom),
        pad_left: floats(node => node.pad_left),
        align: floats(node => node.align),
        justify: floats(node => node.justify),
        font_size: floats(node => node.font_size),
        weight: floats(node => node.weight),
        pad_x: floats(node => node.pad_x),
        lead: floats(node => node.lead),
        screen_center: Uint8Array.from(specs, node => node.screen_center),
        value: specs.map(node => node.value),
        when: specs.map(node => node.when),
        h_of: specs.map(node => node.h_of),
        shown: new Uint8Array(n),
        mw: new Float32Array(n),
        mh: new Float32Array(n),
        iw: new Float32Array(n),
        ih: new Float32Array(n),
        text_w: new Float32Array(n).fill(-1),
        scroll_y: new Float32Array(n),
        scroll_max: new Float32Array(n),
        scroll_v: new Float32Array(n),
        scroll_idle: new Float32Array(n),
        scroll_drag: new Uint8Array(n),
        scroll_caught: new Uint8Array(n),
        clip,
        moved: 0,
        view_h: Infinity,
        width: -1,
        height: -1,
        pixel_ratio: -1,
        dpr: FLOAT_ZERO,
        safe_top: FLOAT_ZERO,
        safe_right: FLOAT_ZERO,
        safe_bottom: FLOAT_ZERO,
        safe_left: FLOAT_ZERO,
      };
    },
  };
};

const is_gone = (layout: Layout, id: number) => layout.kind[id] === WHEN && layout.shown[id] === 0;

const device_child = (layout: Layout, id: number) =>
  layout.child_list[
    layout.child_start[id]! + (layout.width / layout.pixel_ratio < MOBILE_WIDTH ? 0 : 1)
  ]!;

const grow_of = (layout: Layout, id: number): number => {
  const k = layout.kind[id];

  if (k === DEVICE) {
    return grow_of(layout, device_child(layout, id));
  }

  return k === WHEN
    ? grow_of(layout, layout.child_list[layout.child_start[id]!]!)
    : layout.grow[id]!;
};

const text_font = (layout: Layout, id: number, scale: number) =>
  pixel_font(layout.font_size[id]!, scale, layout.dpr, layout.weight[id]!);

const intrinsic = (layout: Layout, id: number) => {
  const { kind, iw, ih, child_list } = layout;
  const k = kind[id];
  const start = layout.child_start[id]!;
  const end = start + layout.child_count[id]!;

  if (k === BOX) {
    iw[id] = layout.w[id]!;
    ih[id] = layout.h[id]!;
  } else if (k === TEXT) {
    iw[id] = layout.w[id]! + layout.pad_x[id]! * 2 + layout.lead[id]!;
    ih[id] = layout.h[id]!;
  } else if (k === SQUARE) {
    iw[id] = ih[id] = layout.w[id]! || layout.h[id]!;
  } else if (k === WHEN || k === FIT || k === DEVICE || k === SCROLL) {
    const child = k === DEVICE ? device_child(layout, id) : child_list[start]!;
    const gone = is_gone(layout, id);

    if (!gone) {
      intrinsic(layout, child);
    }

    iw[id] = gone ? 0 : iw[child]!;
    ih[id] = gone || k === SCROLL ? 0 : ih[child]!;
  } else if (k === WRAP) {
    let w = 0;
    let h = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      const c = child_list[i]!;

      if (!is_gone(layout, c)) {
        intrinsic(layout, c);
        w = Math.max(w, iw[c]!);
        h += ih[c]!;
        count++;
      }
    }

    iw[id] = w + layout.pad_left[id]! + layout.pad_right[id]!;
    ih[id] =
      h + Math.max(0, count - 1) * layout.gap[id]! + layout.pad_top[id]! + layout.pad_bottom[id]!;
  } else {
    const is_row = k === ROW;
    let main = 0;
    let cross = 0;
    let count = 0;

    for (let i = start; i < end; i++) {
      const c = child_list[i]!;

      if (is_gone(layout, c)) {
        continue;
      }

      intrinsic(layout, c);
      main += is_row ? iw[c]! : ih[c]!;
      cross = Math.max(cross, is_row ? ih[c]! : iw[c]!);
      count++;
    }

    main += Math.max(0, count - 1) * layout.gap[id]!;

    const pad_x = layout.pad_left[id]! + layout.pad_right[id]!;
    const pad_y = layout.pad_top[id]! + layout.pad_bottom[id]!;

    iw[id] = Math.max(layout.w[id]!, (is_row ? main : cross) + pad_x);
    ih[id] = Math.max(layout.h[id]!, (is_row ? cross : main) + pad_y);
  }
};

const solve = (layout: Layout, id: number, max_w: number, max_h: number, scale: number) => {
  const { kind, mw, mh } = layout;
  const k = kind[id];

  layout.scale[id] = scale;

  if (k === BOX) {
    const frac = layout.max_w_frac[id]!;
    const w = layout.grow[id]! > 0 ? max_w : layout.w[id]! * scale;

    mw[id] = frac > 0 ? Math.min(w, layout.width * frac) : w;
    mh[id] = layout.h[id]! * scale;
  } else if (k === SQUARE) {
    const size = layout.w[id]!;

    const room = Math.min(max_w, max_h, layout.view_h);

    mw[id] = mh[id] =
      size > 0
        ? size * scale
        : Math.floor(Math.max(layout.h[id]! * scale, Number.isFinite(room) ? room : 0));
  } else if (k === TEXT) {
    const font = text_font(layout, id, scale);

    if (layout.fonts[id] !== font) {
      layout.fonts[id] = font;
      layout.text_w[id] = -1;
    }

    if (layout.text_w[id]! < 0) {
      layout.text_w[id] = layout.value[id] === null ? 0 : measure_text(layout.texts[id]!, font);
    }

    mw[id] =
      layout.grow[id]! > 0
        ? max_w
        : Math.max(
            layout.text_w[id]! + (layout.pad_x[id]! * 2 + layout.lead[id]!) * scale,
            layout.w[id]! * scale,
          );
    mh[id] = layout.h[id]! * scale;
  } else if (k === WHEN) {
    const child = layout.child_list[layout.child_start[id]!]!;
    const shown = layout.shown[id] === 1;

    if (shown) {
      solve(layout, child, max_w, max_h, scale);
    }

    mw[id] = shown ? mw[child]! : 0;
    mh[id] = shown ? mh[child]! : 0;
  } else if (k === FIT) {
    const child = layout.child_list[layout.child_start[id]!]!;

    intrinsic(layout, child);

    const fit = Math.min(
      1,
      max_w / (layout.iw[child]! * scale),
      max_h / (layout.ih[child]! * scale),
    );

    solve(layout, child, max_w, max_h, scale * Math.max(0.1, fit));
    mw[id] = Number.isFinite(max_w) ? max_w : mw[child]!;
    mh[id] = Number.isFinite(max_h) ? max_h : mh[child]!;
  } else if (k === SCROLL) {
    const child = layout.child_list[layout.child_start[id]!]!;

    intrinsic(layout, child);

    const fit = Math.min(1, max_w / (layout.iw[child]! * scale));

    const outer_view_h = layout.view_h;

    layout.view_h = max_h;
    solve(layout, child, max_w, Infinity, scale * Math.max(0.1, fit));
    layout.view_h = outer_view_h;
    mw[id] = max_w;
    mh[id] = max_h;
  } else if (k === DEVICE) {
    const child = device_child(layout, id);

    solve(layout, child, max_w, max_h, scale);
    mw[id] = mw[child]!;
    mh[id] = mh[child]!;
  } else if (k === WRAP) {
    solve_wrap(layout, id, max_w, max_h, scale);
  } else {
    solve_line(layout, id, max_w, max_h, scale);
  }
};

const wrap_line_end = (layout: Layout, id: number, from: number, inner_w: number) => {
  const end = layout.child_start[id]! + layout.child_count[id]!;
  const gap = layout.gap[id]! * layout.scale[id]!;
  let x = 0;
  let count = 0;
  let i = from;

  for (; i < end; i++) {
    const c = layout.child_list[i]!;

    if (is_gone(layout, c)) {
      continue;
    }

    const w = layout.mw[c]!;

    if (count > 0 && x + gap + w > inner_w) {
      break;
    }

    x += (count > 0 ? gap : 0) + w;
    count++;
  }

  return i;
};

const wrap_line_height = (layout: Layout, from: number, to: number) => {
  let h = 0;

  for (let i = from; i < to; i++) {
    const c = layout.child_list[i]!;

    if (!is_gone(layout, c)) {
      h = Math.max(h, layout.mh[c]!);
    }
  }

  return h;
};

const solve_wrap = (layout: Layout, id: number, max_w: number, max_h: number, scale: number) => {
  const start = layout.child_start[id]!;
  const end = start + layout.child_count[id]!;
  const pad_x = (layout.pad_left[id]! + layout.pad_right[id]!) * scale;
  const pad_y = (layout.pad_top[id]! + layout.pad_bottom[id]!) * scale;
  const inner_w = max_w - pad_x;
  const gap = layout.gap[id]! * scale;
  let h = 0;

  for (let i = start; i < end; i++) {
    const c = layout.child_list[i]!;

    if (!is_gone(layout, c)) {
      solve(layout, c, inner_w, max_h - pad_y, scale);
    }
  }

  for (let from = start; from < end;) {
    const to = wrap_line_end(layout, id, from, inner_w);

    h += (from > start ? gap : 0) + wrap_line_height(layout, from, to);
    from = to;
  }

  layout.mw[id] = max_w;
  layout.mh[id] = h + pad_y;
};

const solve_line = (layout: Layout, id: number, max_w: number, max_h: number, scale: number) => {
  const { mw, mh, child_list } = layout;
  const is_row = layout.kind[id] === ROW;
  const start = layout.child_start[id]!;
  const end = start + layout.child_count[id]!;
  const pad_x = (layout.pad_left[id]! + layout.pad_right[id]!) * scale;
  const pad_y = (layout.pad_top[id]! + layout.pad_bottom[id]!) * scale;
  const pad_main = is_row ? pad_x : pad_y;
  const pad_cross = is_row ? pad_y : pad_x;
  const min_cross = (is_row ? layout.h[id]! : layout.w[id]!) * scale;
  const avail_cross = (is_row ? max_h : max_w) - pad_cross;
  let count = 0;
  let total_grow = 0;

  for (let i = start; i < end; i++) {
    const c = child_list[i]!;

    if (!is_gone(layout, c)) {
      count++;
      total_grow += grow_of(layout, c);
    }
  }

  const gaps = Math.max(0, count - 1) * layout.gap[id]! * scale;
  let free = (is_row ? max_w : max_h) - pad_main - gaps;
  let main = 0;
  let cross = 0;

  for (let pass = 0; pass < 2; pass++) {
    const share = pass === 1 && total_grow > 0 ? Math.max(0, free) / total_grow : 0;

    for (let i = start; i < end; i++) {
      const c = child_list[i]!;

      const g = grow_of(layout, c);

      if (is_gone(layout, c) || g > 0 !== (pass === 1)) {
        continue;
      }

      const limit = pass === 1 ? share * g : Math.max(0, free);

      if (is_row) {
        solve(layout, c, limit, avail_cross, scale);
      } else {
        solve(layout, c, avail_cross, limit, scale);
      }

      const child_main = is_row ? mw[c]! : mh[c]!;

      if (pass === 0) {
        free -= child_main;
      }

      main += child_main;
      cross = Math.max(cross, is_row ? mh[c]! : mw[c]!);
    }
  }

  main += gaps + pad_main;

  if (layout.justify[id] === SPACE_BETWEEN) {
    const avail_main = is_row ? max_w : max_h;

    if (Number.isFinite(avail_main)) {
      main = Math.max(main, avail_main);
    }
  }

  cross = Math.max(min_cross, cross + pad_cross);
  mw[id] = is_row ? main : cross;
  mh[id] = is_row ? cross : main;
};

const hide = (layout: Layout, id: number) => {
  const rect = layout.rects[id]!;
  const start = layout.child_start[id]!;
  const end = start + layout.child_count[id]!;

  rect.x = rect.y = -1e9;
  rect.w = rect.h = 0;
  layout.visible[id] = 0;

  for (let i = start; i < end; i++) {
    hide(layout, layout.child_list[i]!);
  }
};

const place = (layout: Layout, id: number, x: number, y: number) => {
  const { kind, rects, mw, mh, child_list } = layout;
  const rect = rects[id]!;
  const k = kind[id];
  const start = layout.child_start[id]!;
  const end = start + layout.child_count[id]!;

  rect.x = Math.round(x);
  rect.y = Math.round(y);
  rect.w = Math.round(mw[id]!);
  rect.h = Math.round(mh[id]!);
  layout.visible[id] = 1;

  if (k === TEXT && layout.screen_center[id] === 1) {
    place_screen_centered(layout, id);
  } else if (k === WHEN) {
    if (layout.shown[id] === 1) {
      place(layout, child_list[start]!, x, y);
    } else {
      hide(layout, id);
    }
  } else if (k === FIT) {
    const child = child_list[start]!;

    place(layout, child, x + (mw[id]! - mw[child]!) / 2, y + (mh[id]! - mh[child]!) / 2);
  } else if (k === SCROLL) {
    const child = child_list[start]!;
    const max = Math.max(0, mh[child]! - mh[id]!);

    layout.scroll_max[id] = max;
    layout.scroll_y[id] = clamp(layout.scroll_y[id]!, 0, max);
    place(layout, child, x + (mw[id]! - mw[child]!) / 2, y - layout.scroll_y[id]!);
  } else if (k === DEVICE) {
    const chosen = device_child(layout, id);

    for (let i = start; i < end; i++) {
      if (child_list[i] !== chosen) {
        hide(layout, child_list[i]!);
      }
    }

    place(layout, chosen, x, y);
  } else if (k === ROW || k === COLUMN) {
    place_line(layout, id, x, y);
  } else if (k === WRAP) {
    place_wrap(layout, id, x, y);
  }
};

const place_wrap = (layout: Layout, id: number, x: number, y: number) => {
  const { mw, mh, child_list } = layout;
  const start = layout.child_start[id]!;
  const end = start + layout.child_count[id]!;
  const scale = layout.scale[id]!;
  const gap = layout.gap[id]! * scale;
  const left = x + layout.pad_left[id]! * scale;
  const inner_w = mw[id]! - (layout.pad_left[id]! + layout.pad_right[id]!) * scale;
  const align = layout.align[id]!;
  let top = y + layout.pad_top[id]! * scale;

  for (let from = start; from < end;) {
    const to = wrap_line_end(layout, id, from, inner_w);
    const line_h = wrap_line_height(layout, from, to);
    let at = left;

    for (let i = from; i < to; i++) {
      const c = child_list[i]!;

      if (is_gone(layout, c)) {
        hide(layout, c);
      } else {
        place(layout, c, at, top + (line_h - mh[c]!) * align);
        at += mw[c]! + gap;
      }
    }

    top += line_h + gap;
    from = to;
  }
};

const place_line = (layout: Layout, id: number, x: number, y: number) => {
  const { mw, mh, child_list } = layout;
  const is_row = layout.kind[id] === ROW;
  const start = layout.child_start[id]!;
  const end = start + layout.child_count[id]!;
  const scale = layout.scale[id]!;
  const gap = layout.gap[id]! * scale;
  const left = x + layout.pad_left[id]! * scale;
  const top = y + layout.pad_top[id]! * scale;
  const inner_w = mw[id]! - (layout.pad_left[id]! + layout.pad_right[id]!) * scale;
  const inner_h = mh[id]! - (layout.pad_top[id]! + layout.pad_bottom[id]!) * scale;
  let content = 0;
  let count = 0;

  for (let i = start; i < end; i++) {
    const c = child_list[i]!;

    if (!is_gone(layout, c)) {
      content += is_row ? mw[c]! : mh[c]!;
      count++;
    }
  }

  content += Math.max(0, count - 1) * gap;

  const free = Math.max(0, (is_row ? inner_w : inner_h) - content);
  const justify = layout.justify[id]!;
  const between = justify === SPACE_BETWEEN;
  const spread = between && count > 1 ? free / (count - 1) : 0;
  const align = layout.align[id]!;
  let at = (is_row ? left : top) + (between ? 0 : free * justify);

  for (let i = start; i < end; i++) {
    const c = child_list[i]!;

    if (is_gone(layout, c)) {
      hide(layout, c);
    } else if (is_row) {
      place(layout, c, at, top + (inner_h - mh[c]!) * align);
      at += mw[c]! + gap + spread;
    } else {
      place(layout, c, left + (inner_w - mw[c]!) * align, at);
      at += mh[c]! + gap + spread;
    }
  }
};

const place_screen_centered = (layout: Layout, id: number) => {
  const rect = layout.rects[id]!;
  const text_w = layout.text_w[id]!;
  const center = layout.width / 2;

  if (text_w / 2 <= Math.min(center - rect.x, rect.x + rect.w - center)) {
    rect.x = Math.round(center - text_w / 2);
    rect.w = Math.round(text_w);
  } else if (text_w > rect.w) {
    const scale = layout.scale[id]! * Math.max(0, rect.w / text_w);

    layout.fonts[id] = text_font(layout, id, scale);
  }
};

export const number_text = (format: (n: number) => string) => {
  let last = NaN;
  let text = '';

  return (n: number) => {
    if (n !== last) {
      last = n;
      text = format(n);
    }

    return text;
  };
};

export const update_layout = (
  layout: Layout,
  engine: BIRD.EngineContext,
  game: BIRD.GameState,
): Layout => {
  const { width, height, pixel_ratio, dpr, safe } = engine.canvas;
  let dirty =
    layout.width !== width ||
    layout.height !== height ||
    layout.pixel_ratio !== pixel_ratio ||
    layout.dpr !== dpr ||
    layout.safe_top !== safe.top ||
    layout.safe_right !== safe.right ||
    layout.safe_bottom !== safe.bottom ||
    layout.safe_left !== safe.left;

  for (let i = 0; i < layout.value.length; i++) {
    const value = layout.value[i];
    const when = layout.when[i];
    const h_of = layout.h_of[i];

    if (value !== null && value !== undefined) {
      const text = value(game);

      if (text !== layout.texts[i]) {
        layout.texts[i] = text;
        layout.text_w[i] = -1;
        dirty = true;
      }
    }

    if (when !== null && when !== undefined) {
      const shown = when(game) ? 1 : 0;

      if (shown !== layout.shown[i]) {
        layout.shown[i] = shown;
        dirty = true;
      }
    }

    if (h_of !== null && h_of !== undefined) {
      const h = Math.fround(h_of(game));

      if (h !== layout.h[i]) {
        layout.h[i] = h;
        dirty = true;
      }
    }
  }

  if (!dirty) {
    if (layout.moved === 1) {
      layout.moved = 0;
      place(layout, layout.root, safe.left, safe.top);
    }

    return layout;
  }

  layout.moved = 0;

  layout.width = width;
  layout.height = height;
  layout.pixel_ratio = pixel_ratio;
  layout.dpr = dpr;
  layout.safe_top = safe.top;
  layout.safe_right = safe.right;
  layout.safe_bottom = safe.bottom;
  layout.safe_left = safe.left;

  const root = layout.root;
  const root_w = width - safe.left - safe.right;
  const root_h = height - safe.top - safe.bottom;

  solve(layout, root, root_w, root_h, pixel_ratio);
  layout.mw[root] = root_w;
  layout.mh[root] = root_h;
  place(layout, root, safe.left, safe.top);

  return layout;
};

const in_view = (layout: Layout, id: number, x: number, y: number) => {
  const clip = layout.clip[id]!;

  return clip === -1 || layout.visible[clip] === 0 || in_rect(layout.rects[clip]!, x, y);
};

export const node_clicked = (layout: Layout, id: number, mouse: MouseInputs) =>
  is_clicked(mouse, layout.rects[id]!) && in_view(layout, id, mouse.x, mouse.y);

export const node_hovered = (layout: Layout, id: number, mouse: MouseInputs) =>
  is_hovered(mouse, layout.rects[id]!) && in_view(layout, id, mouse.x, mouse.y);

export const draw_node_text = (
  ctx: Ctx2D,
  layout: Layout,
  id: number,
  color: string,
  dy: number,
) => {
  const rect = layout.rects[id]!;

  draw_text(
    ctx,
    layout.texts[id]!,
    rect.x + rect.w / 2,
    rect.y + rect.h / 2 + dy,
    layout.fonts[id]!,
    color,
    'center',
    'middle',
  );
};

export const fill_node_button = (
  ctx: Ctx2D,
  layout: Layout,
  id: number,
  radius: number,
  color: string,
  dy: number,
) => {
  const rect = layout.rects[id]!;

  fill_round_rect(ctx, rect.x, rect.y + dy, rect.w, rect.h, radius, color);
};

export const scroll_to = (layout: Layout, id: number, y: number) => {
  layout.scroll_y[id] = Math.max(0, y);
  layout.scroll_v[id] = 0;
  layout.moved = 1;
};

export const reset_scroll = (layout: Layout, id: number) => {
  layout.scroll_y[id] = 0;
  layout.scroll_v[id] = 0;
  layout.scroll_idle[id] = 0;
  layout.moved = 1;
};

export const scroll_input = (layout: Layout, id: number, engine: BIRD.EngineContext) => {
  const mouse = engine.inputs.mouse;
  const dt = engine.delta;

  if (layout.visible[id] === 0) {
    layout.scroll_v[id] = 0;
    layout.scroll_drag[id] = 0;
    return;
  }

  const rect = layout.rects[id]!;
  const max = layout.scroll_max[id]!;
  const min_speed = SCROLL_MIN_SPEED * layout.pixel_ratio;
  const from = layout.scroll_y[id]!;
  const touching = mouse.is_dragging === true && in_rect(rect, mouse.down_x, mouse.down_y);
  let y = from;
  let v = layout.scroll_v[id]!;

  if (touching) {
    if (layout.scroll_drag[id] === 0) {
      layout.scroll_caught[id] = Math.abs(v) > min_speed ? 1 : 0;
      v = 0;
    }

    y -= mouse.pan_y;

    if (dt > 0) {
      v += (-mouse.pan_y / dt - v) * (1 - Math.exp(-dt / SCROLL_VELOCITY_MS));
    }

    mouse.pan_y = 0;
  } else {
    if (mouse.click === true && layout.scroll_caught[id] === 1) {
      mouse.click = false;
      mouse.double_click = false;
    }

    layout.scroll_caught[id] = 0;

    if (in_rect(rect, mouse.x, mouse.y) && (mouse.pan_y !== 0 || mouse.wheel !== 0)) {
      y += mouse.wheel - mouse.pan_y;
      v = 0;
      mouse.pan_y = 0;
      mouse.wheel = 0;
    } else {
      y += v * dt;
      v *= Math.exp(-dt / SCROLL_FRICTION_MS);
    }

    if (Math.abs(v) < min_speed) {
      v = 0;
    }
  }

  layout.scroll_drag[id] = touching ? 1 : 0;

  if (y <= 0 || y >= max) {
    y = clamp(y, 0, max);
    v = touching ? v : 0;
  }

  layout.scroll_v[id] = v;

  if (y !== from) {
    layout.scroll_y[id] = y;
    layout.scroll_idle[id] = 0;
    layout.moved = 1;
  } else {
    layout.scroll_idle[id] = layout.scroll_idle[id]! + dt;
  }
};
