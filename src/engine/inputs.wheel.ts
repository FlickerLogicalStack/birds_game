export type WheelDevice = 'mouse' | 'trackpad';

export type WheelDetector = {
  device: WheelDevice;
  last_at: number;
  last_event: {
    dx: number;
    dy: number;
    legacy: number | null;
    mode: number;
    ctrl: boolean;
  };
};

const GESTURE_GAP_MS = 150;

export const create_wheel_detector = (): WheelDetector => ({
  device: 'mouse',
  last_at: -Infinity,
  last_event: { dx: 0, dy: 0, legacy: null, mode: 0, ctrl: false },
});

const is_trackpad_signal = (event: WheelEvent) => {
  if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
    return false;
  }

  if (event.deltaX !== 0 && event.deltaY !== 0) {
    return true;
  }

  return event.ctrlKey;
};

export const is_page_zoom_wheel = (event: WheelEvent, ctrl_held: boolean) =>
  event.ctrlKey && ctrl_held;

export const detect_wheel_device = (detector: WheelDetector, event: WheelEvent) => {
  if (event.timeStamp - detector.last_at > GESTURE_GAP_MS) {
    detector.device = 'mouse';
  }

  if (is_trackpad_signal(event)) {
    detector.device = 'trackpad';
  }

  const last = detector.last_event;

  detector.last_at = event.timeStamp;
  last.dx = event.deltaX;
  last.dy = event.deltaY;
  last.legacy = (event as WheelEvent & { wheelDeltaY?: number }).wheelDeltaY ?? null;
  last.mode = event.deltaMode;
  last.ctrl = event.ctrlKey;

  return detector.device;
};
