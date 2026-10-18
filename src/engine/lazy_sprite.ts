import { create_canvas, type SpriteCanvas } from './canvas';

export type LazySprite = {
  canvas: SpriteCanvas;
  ready_at: number;
};

const placeholder: SpriteCanvas = create_canvas(1, 1).canvas;

export const create_lazy_sprite = (): LazySprite => {
  return { canvas: placeholder, ready_at: -1 };
};

export const reset_lazy_sprite = (sprite: LazySprite) => {
  sprite.canvas = placeholder;
  sprite.ready_at = -1;
};

export const is_sprite_ready = (sprite: LazySprite) => sprite.ready_at >= 0;

export const fill_lazy_sprite = (
  sprite: LazySprite,
  canvas: Promise<SpriteCanvas>,
  name: string,
) => {
  canvas
    .then(ready => {
      sprite.canvas = ready;
      sprite.ready_at = performance.now() | 0;
    })
    .catch(error => console.error(`Sprite "${name}" failed:`, error));
};
