type WebkitDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => void;
};
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => void };

const webkit_document = () => document as WebkitDocument;

export const can_fullscreen = () =>
  typeof document !== 'undefined' &&
  (document.fullscreenEnabled === true || webkit_document().webkitFullscreenEnabled === true);

export const is_fullscreen = () =>
  (document.fullscreenElement ?? webkit_document().webkitFullscreenElement ?? null) !== null;

export const toggle_fullscreen = (element: HTMLElement) => {
  const doc = webkit_document();

  if (is_fullscreen()) {
    if (document.exitFullscreen !== undefined) {
      document.exitFullscreen().catch(() => {});
    } else {
      doc.webkitExitFullscreen?.();
    }

    return;
  }

  const target = element as WebkitElement;

  if (target.requestFullscreen !== undefined) {
    target.requestFullscreen().catch(() => {});
  } else {
    target.webkitRequestFullscreen?.();
  }
};
