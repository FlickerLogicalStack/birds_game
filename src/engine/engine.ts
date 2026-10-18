import { create_inputs, type Inputs } from './inputs';
import { CONFIG } from '../config';

const MAX_DELTA = CONFIG.loop.max_delta_ms;
const MAX_PIXEL_RATIO = CONFIG.screen.max_pixel_ratio;
const IOS_STATUS_BAR = CONFIG.screen.ios_status_bar;
const IOS_NOTCH_SCREEN = 812;

export type SafeInsets = { top: number; right: number; bottom: number; left: number };

export const NO_SAFE_INSETS: SafeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export type EngineContext<TResources = unknown> = {
  __prev_frame_time: number;

  canvas: {
    element: HTMLCanvasElement;
    width: number;
    height: number;
    pixel_ratio: number;
    dpr: number;
    safe: SafeInsets;
  };

  ctx: CanvasRenderingContext2D;
  inputs: Inputs;

  frame: number;
  delta: number;
  delta_mul: number;

  resources: TResources;
};

const create_engine_context = <TResources = unknown>(
  canvas: HTMLCanvasElement,
  resources: TResources,
): EngineContext<TResources> => {
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context (canvas.getContext(2d))');
  }

  return {
    __prev_frame_time: 0,

    canvas: {
      element: canvas,
      width: canvas.width,
      height: canvas.height,
      pixel_ratio: 1,
      dpr: 1,
      safe: { top: 0, right: 0, bottom: 0, left: 0 },
    },

    ctx,
    inputs: create_inputs(canvas),

    frame: 0,
    delta: 0,
    delta_mul: 0,

    resources,
  };
};

export type GameStateModule<TGame, TResources = unknown> = {
  create: (engine: EngineContext<TResources>) => TGame;
  setup: (engine: EngineContext<TResources>, game: TGame) => void | Promise<void>;
};

export const loop = async <TResources, TGame>(
  canvas_getter: () => HTMLCanvasElement,
  load_resources: () => Promise<TResources>,
  game_state: GameStateModule<TGame, TResources>,
  on_frame: (engine: EngineContext<TResources>, game: TGame) => void,
) => {
  const canvas = canvas_getter();

  const engine = create_engine_context(canvas, await load_resources());

  const safe_probe = document.createElement('div');

  safe_probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) ' +
    'env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(safe_probe);

  const is_ios_home_portrait = () =>
    (navigator as Navigator & { standalone?: boolean }).standalone === true &&
    window.innerHeight > window.innerWidth;

  const ios_status_bar = () => {
    const screen_h = Math.max(screen.width, screen.height);
    const short_by = screen_h - window.innerHeight;

    if (short_by > 1) {
      return short_by;
    }

    return screen_h >= IOS_NOTCH_SCREEN ? IOS_STATUS_BAR.notch : IOS_STATUS_BAR.home_button;
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const probe = getComputedStyle(safe_probe);
    const safe = engine.canvas.safe;

    engine.canvas.width = canvas.clientWidth;
    engine.canvas.height = canvas.clientHeight;
    engine.canvas.dpr = dpr;
    safe.top = parseFloat(probe.paddingTop) || 0;
    safe.right = parseFloat(probe.paddingRight) || 0;
    safe.bottom = parseFloat(probe.paddingBottom) || 0;
    safe.left = parseFloat(probe.paddingLeft) || 0;

    if (safe.top === 0 && is_ios_home_portrait()) {
      safe.top = ios_status_bar();
    }

    canvas.width = Math.round(engine.canvas.width * dpr);
    canvas.height = Math.round(engine.canvas.height * dpr);
    engine.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const watch_dpr = () => {
    matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener(
      'change',
      () => {
        resize();
        watch_dpr();
      },
      { once: true },
    );
  };

  let resize_pending = false;
  const observer = new ResizeObserver(() => {
    resize_pending = true;
  });

  observer.observe(canvas);
  observer.observe(safe_probe);
  watch_dpr();

  document.addEventListener('visibilitychange', () => {
    engine.__prev_frame_time = performance.now() | 0;
  });

  resize();

  engine.__prev_frame_time = performance.now() | 0;

  const game = game_state.create(engine);

  await game_state.setup(engine, game);

  window.__ENGINE__ = { engine, game } as Window['__ENGINE__'];

  const frame = (time: number) => {
    engine.frame += 1;

    const raw_delta = (time - engine.__prev_frame_time) | 0;

    engine.delta = raw_delta > MAX_DELTA ? MAX_DELTA : raw_delta;
    engine.delta_mul = engine.delta / 1000;
    engine.__prev_frame_time = time | 0;

    if (resize_pending) {
      resize_pending = false;
      resize();
    }

    on_frame(engine, game);

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
};
