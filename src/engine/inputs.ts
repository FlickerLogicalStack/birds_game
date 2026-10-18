import {
  create_wheel_detector,
  detect_wheel_device,
  is_page_zoom_wheel,
  type WheelDetector,
} from './inputs.wheel';
import { CONFIG } from '../config';

export type KeyboardInputs = {
  ArrowLeft: boolean;
  ArrowRight: boolean;
  KeyF: boolean;
  KeyH: boolean;
  KeyJ: boolean;
  KeyP: boolean;
  Space: boolean;
  Digit1: boolean;
  Digit2: boolean;
  Digit3: boolean;
  Digit4: boolean;
  Enter: boolean;
  Escape: boolean;
  Backslash: boolean;
  BracketLeft: boolean;
  BracketRight: boolean;
  Quote: boolean;
};

export type MouseInputs = {
  x: number;
  y: number;
  is_over: boolean;
  is_touch: boolean;
  is_dragging: boolean;
  down_x: number;
  down_y: number;
  pan_x: number;
  pan_y: number;
  zoom: number;
  wheel: number;
  click: boolean;
  double_click: boolean;
};

export type Inputs = {
  kb: KeyboardInputs;
  mouse: MouseInputs;
  wheel_detector: WheelDetector;
};

export const consume_mouse = (mouse: MouseInputs) => {
  mouse.click = false;
  mouse.double_click = false;
  mouse.pan_x = 0;
  mouse.pan_y = 0;
  mouse.zoom = 1;
  mouse.wheel = 0;
};

const WHEEL_LINE_PX = 16;
const WHEEL_PAGE_PX = 800;
const CLICK_SLOP_PX = CONFIG.input.click_slop_px;
const TAP_SLOP_PX = CONFIG.input.tap_slop_px;
const DOUBLE_TAP_MS = CONFIG.input.double_tap_ms;
const DOUBLE_TAP_PX = CONFIG.input.double_tap_px;
const PINCH_WHEEL_SPEED = CONFIG.input.pinch_wheel_speed;
const PINCH_WHEEL_MAX = 25;
const TOUCH_EMULATION_MS = 800;

export const create_inputs = (element: HTMLCanvasElement): Inputs => {
  const kb: KeyboardInputs = {
    ArrowLeft: false,
    ArrowRight: false,
    KeyF: false,
    KeyH: false,
    KeyJ: false,
    KeyP: false,
    Space: false,
    Digit1: false,
    Digit2: false,
    Digit3: false,
    Digit4: false,
    Enter: false,
    Escape: false,
    Backslash: false,
    BracketLeft: false,
    BracketRight: false,
    Quote: false,
  };

  const mouse: MouseInputs = {
    x: 0,
    y: 0,
    is_over: false,
    is_touch: false,
    is_dragging: false,
    down_x: 0,
    down_y: 0,
    pan_x: 0,
    pan_y: 0,
    zoom: 1,
    wheel: 0,
    click: false,
    double_click: false,
  };

  let ctrl_held = false;

  window.addEventListener('blur', () => {
    ctrl_held = false;
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Control') {
      ctrl_held = true;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    const code = event.code;

    if (code === 'ArrowLeft') {
      kb.ArrowLeft = true;
    } else if (code === 'ArrowRight') {
      kb.ArrowRight = true;
    } else if (code === 'KeyF') {
      kb.KeyF = true;
    } else if (code === 'KeyH') {
      kb.KeyH = true;
    } else if (code === 'KeyJ') {
      kb.KeyJ = true;
    } else if (code === 'KeyP') {
      kb.KeyP = true;
    } else if (code === 'Space') {
      event.preventDefault();
      kb.Space = true;
    } else if (code === 'Digit1') {
      kb.Digit1 = true;
    } else if (code === 'Digit2') {
      kb.Digit2 = true;
    } else if (code === 'Digit3') {
      kb.Digit3 = true;
    } else if (code === 'Digit4') {
      kb.Digit4 = true;
    } else if (code === 'Enter') {
      kb.Enter = true;
    } else if (code === 'Escape') {
      kb.Escape = true;
    } else if (code === 'Backslash') {
      kb.Backslash = true;
    } else if (code === 'BracketLeft') {
      kb.BracketLeft = true;
    } else if (code === 'BracketRight') {
      kb.BracketRight = true;
    } else if (code === 'Quote') {
      kb.Quote = true;
    }
  });

  window.addEventListener('keyup', event => {
    const code = event.code;

    if (event.key === 'Control') {
      ctrl_held = false;
    }

    if (code === 'ArrowLeft') {
      kb.ArrowLeft = false;
    } else if (code === 'ArrowRight') {
      kb.ArrowRight = false;
    } else if (code === 'KeyF') {
      kb.KeyF = false;
    } else if (code === 'KeyH') {
      kb.KeyH = false;
    } else if (code === 'KeyJ') {
      kb.KeyJ = false;
    } else if (code === 'KeyP') {
      kb.KeyP = false;
    } else if (code === 'Space') {
      kb.Space = false;
    } else if (code === 'Digit1') {
      kb.Digit1 = false;
    } else if (code === 'Digit2') {
      kb.Digit2 = false;
    } else if (code === 'Digit3') {
      kb.Digit3 = false;
    } else if (code === 'Digit4') {
      kb.Digit4 = false;
    } else if (code === 'Enter') {
      kb.Enter = false;
    } else if (code === 'Escape') {
      kb.Escape = false;
    } else if (code === 'Backslash') {
      kb.Backslash = false;
    } else if (code === 'BracketLeft') {
      kb.BracketLeft = false;
    } else if (code === 'BracketRight') {
      kb.BracketRight = false;
    } else if (code === 'Quote') {
      kb.Quote = false;
    }
  });

  let last_touch_at = -Infinity;
  const is_touch_emulation = (event: MouseEvent) =>
    (event instanceof PointerEvent && event.pointerType === 'touch') ||
    event.timeStamp - last_touch_at < TOUCH_EMULATION_MS;

  element.addEventListener('mousedown', event => {
    if (is_touch_emulation(event)) {
      return;
    }

    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.down_x = event.clientX;
    mouse.down_y = event.clientY;

    if (event.button === 0) {
      mouse.is_dragging = true;
    }
  });

  document.addEventListener('mousemove', event => {
    if (is_touch_emulation(event)) {
      return;
    }

    const x = event.clientX;
    const y = event.clientY;

    if (mouse.is_dragging === true) {
      mouse.pan_x += x - mouse.x;
      mouse.pan_y += y - mouse.y;
    }

    mouse.x = x;
    mouse.y = y;
    mouse.is_over = true;
    mouse.is_touch = false;
  });

  document.documentElement.addEventListener('mouseleave', () => {
    mouse.is_over = false;
  });

  document.addEventListener('mouseup', () => {
    mouse.is_dragging = false;
  });

  element.addEventListener('click', event => {
    if (event.button !== 0 || is_touch_emulation(event)) {
      return;
    }

    if (Math.hypot(event.clientX - mouse.down_x, event.clientY - mouse.down_y) > CLICK_SLOP_PX) {
      return;
    }

    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.click = true;
  });

  element.addEventListener('dblclick', event => {
    if (event.button !== 0 || is_touch_emulation(event)) {
      return;
    }

    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.double_click = true;
  });

  element.addEventListener('contextmenu', event => {
    if (is_touch_emulation(event)) {
      event.preventDefault();
    }
  });

  const touches = new Map<number, { x: number; y: number }>();
  let multi_touch = false;
  let last_tap = { at: -Infinity, x: 0, y: 0 };

  const touch_pair = () => {
    const [a, b] = touches.values();

    return {
      x: (a!.x + b!.x) / 2,
      y: (a!.y + b!.y) / 2,
      distance: Math.hypot(a!.x - b!.x, a!.y - b!.y),
    };
  };

  element.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch') {
      return;
    }

    event.preventDefault();
    last_touch_at = event.timeStamp;
    element.setPointerCapture(event.pointerId);
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (touches.size === 1) {
      multi_touch = false;
      mouse.x = event.clientX;
      mouse.y = event.clientY;
      mouse.down_x = event.clientX;
      mouse.down_y = event.clientY;
      mouse.is_dragging = true;
      mouse.is_over = true;
      mouse.is_touch = true;
    } else {
      const pair = touch_pair();

      multi_touch = true;
      mouse.x = pair.x;
      mouse.y = pair.y;
    }
  });

  element.addEventListener('pointermove', event => {
    const touch = touches.get(event.pointerId);

    if (touch === undefined) {
      return;
    }

    last_touch_at = event.timeStamp;

    if (touches.size === 1) {
      mouse.pan_x += event.clientX - touch.x;
      mouse.pan_y += event.clientY - touch.y;
      touch.x = mouse.x = event.clientX;
      touch.y = mouse.y = event.clientY;
      return;
    }

    const before = touch_pair();

    touch.x = event.clientX;
    touch.y = event.clientY;

    const after = touch_pair();

    mouse.pan_x += after.x - before.x;
    mouse.pan_y += after.y - before.y;
    mouse.x = after.x;
    mouse.y = after.y;

    if (before.distance > 0) {
      mouse.zoom *= after.distance / before.distance;
    }
  });

  const end_touch = (event: PointerEvent) => {
    if (!touches.delete(event.pointerId)) {
      return;
    }

    last_touch_at = event.timeStamp;

    if (touches.size > 0) {
      const [rest] = touches.values();

      mouse.x = rest!.x;
      mouse.y = rest!.y;
      return;
    }

    mouse.is_dragging = false;
    mouse.is_over = false;

    const x = event.clientX;
    const y = event.clientY;

    if (
      event.type !== 'pointerup' ||
      multi_touch ||
      Math.hypot(x - mouse.down_x, y - mouse.down_y) > TAP_SLOP_PX
    ) {
      return;
    }

    mouse.x = x;
    mouse.y = y;
    mouse.click = true;

    if (
      event.timeStamp - last_tap.at <= DOUBLE_TAP_MS &&
      Math.hypot(x - last_tap.x, y - last_tap.y) <= DOUBLE_TAP_PX
    ) {
      mouse.double_click = true;
      last_tap.at = -Infinity;
    } else {
      last_tap = { at: event.timeStamp, x, y };
    }
  };

  element.addEventListener('pointerup', end_touch);
  element.addEventListener('pointercancel', end_touch);

  const wheel_detector = create_wheel_detector();

  document.addEventListener(
    'wheel',
    event => {
      if (is_page_zoom_wheel(event, ctrl_held)) {
        return;
      }

      event.preventDefault();

      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? WHEEL_LINE_PX
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? WHEEL_PAGE_PX
            : 1;

      const device = detect_wheel_device(wheel_detector, event);

      if (event.ctrlKey) {
        const delta = Math.max(-PINCH_WHEEL_MAX, Math.min(PINCH_WHEEL_MAX, event.deltaY * unit));

        mouse.zoom *= Math.exp(-delta * PINCH_WHEEL_SPEED);
        return;
      }

      mouse.pan_x -= event.deltaX * unit;

      if (device === 'trackpad') {
        mouse.pan_y -= event.deltaY * unit;
      } else {
        mouse.wheel += event.deltaY * unit;
      }
    },
    { passive: false },
  );

  let gesture_scale = 1;

  document.addEventListener('gesturestart', event => {
    event.preventDefault();

    gesture_scale = 1;
  });

  document.addEventListener('gesturechange', event => {
    event.preventDefault();

    const scale = (event as Event & { scale: number }).scale;

    if (touches.size < 2) {
      mouse.zoom *= scale / gesture_scale;
    }

    gesture_scale = scale;
  });

  document.addEventListener('gestureend', event => event.preventDefault());

  return { kb, mouse, wheel_detector };
};
