import { layout_builder } from '../../utils/layout';

const L = layout_builder();

export const LOADING_LAYOUT_ELEMENTS = {
  title: L.text({
    value: () => 'Birds',
    h: 80,
    font_size: 48,
    weight: 600,
  }),
  bar: L.box({
    w: 420,
    h: 10,
    max_w_frac: 0.7,
  }),
  caption: L.text({
    h: 20,
    font_size: 15,
  }),
  skip: L.text({
    value: () => 'Skip',
    w: 168,
    h: 40,
    font_size: 16,
  }),
};

export const LOADING_LAYOUT = L.compile(
  L.column({ gap: 28, justify: 'center' }, [
    L.column({ gap: 19 }, [
      LOADING_LAYOUT_ELEMENTS.title,
      LOADING_LAYOUT_ELEMENTS.bar,
      LOADING_LAYOUT_ELEMENTS.caption,
    ]),
    LOADING_LAYOUT_ELEMENTS.skip,
  ]),
);
