import { create_canvas, type SpriteCanvas } from '../../../engine/canvas';
import { BirdSpriteCache, SPRITE_SIZE, type EyeColors } from './bird.generator';

const PAGE_SIZE = 2048;
const SLOT_WIDTH = SPRITE_SIZE * 2;
const SLOTS_PER_ROW = PAGE_SIZE / SLOT_WIDTH;
const SLOTS_PER_PAGE = SLOTS_PER_ROW * (PAGE_SIZE / SPRITE_SIZE);
const MASK_ROW_WORDS = SPRITE_SIZE / 32;

export type SpriteBounds = { left: number; top: number; right: number; bottom: number };

export type AtlasSprite = {
  page: SpriteCanvas;
  slot: number;
  x: number;
  y: number;
  bounds: SpriteBounds;
  mask: Uint32Array;
  eye_x: number;
  eye_y: number;
};

export class BirdAtlas {
  private pages: { canvas: SpriteCanvas; ctx: OffscreenCanvasRenderingContext2D }[] = [];
  private slot_image = new ImageData(SLOT_WIDTH, SPRITE_SIZE);
  private slot_pixels = new Uint32Array(this.slot_image.data.buffer);
  private free_slots: number[] = [];
  private next_slot = 0;

  get page_count(): number {
    return this.pages.length;
  }

  put(pixels: Uint8ClampedArray<ArrayBuffer>, eyes: EyeColors, head_flip: boolean): AtlasSprite {
    const slot = this.free_slots.pop() ?? this.next_slot++;
    const page_index = Math.floor(slot / SLOTS_PER_PAGE);
    const in_page = slot % SLOTS_PER_PAGE;
    const x = (in_page % SLOTS_PER_ROW) * SLOT_WIDTH;
    const y = Math.floor(in_page / SLOTS_PER_ROW) * SPRITE_SIZE;

    while (this.pages.length <= page_index) {
      this.pages.push(create_canvas(PAGE_SIZE, PAGE_SIZE));
    }

    const page = this.pages[page_index]!;

    const src = new Uint32Array(pixels.buffer, pixels.byteOffset, SPRITE_SIZE * SPRITE_SIZE);
    const dst = this.slot_pixels;
    const eye = eyes.from === 0 ? -1 : eyes.from;
    let eye_sum_x = 0;
    let eye_sum_y = 0;
    let eye_count = 0;

    for (let py = 0; py < SPRITE_SIZE; py++) {
      const from = py * SPRITE_SIZE;
      const to = py * SLOT_WIDTH;

      for (let px = 0; px < SPRITE_SIZE; px++) {
        const rgba = src[from + px]!;

        if (rgba === eye) {
          dst[to + px] = head_flip ? eyes.to : rgba;
          dst[to + SLOT_WIDTH - 1 - px] = head_flip ? rgba : eyes.to;
          eye_sum_x += px;
          eye_sum_y += py;
          eye_count++;
        } else {
          dst[to + px] = rgba;
          dst[to + SLOT_WIDTH - 1 - px] = rgba;
        }
      }
    }

    page.ctx.putImageData(this.slot_image, x, y);

    const mask = new Uint32Array(SPRITE_SIZE * MASK_ROW_WORDS);
    const bounds = { left: SPRITE_SIZE, top: SPRITE_SIZE, right: -1, bottom: -1 };

    for (let py = 0; py < SPRITE_SIZE; py++) {
      for (let px = 0; px < SPRITE_SIZE; px++) {
        if (pixels[(py * SPRITE_SIZE + px) * 4 + 3]! > 0) {
          mask[py * MASK_ROW_WORDS + (px >> 5)]! |= 1 << (px & 31);
          bounds.left = Math.min(bounds.left, px);
          bounds.right = Math.max(bounds.right, px);
          bounds.top = Math.min(bounds.top, py);
          bounds.bottom = Math.max(bounds.bottom, py);
        }
      }
    }

    const glow = eyes.glowing && eye_count > 0;
    const eye_x = glow ? eye_sum_x / eye_count + 0.5 : -1;
    const eye_y = glow ? eye_sum_y / eye_count + 0.5 : -1;

    return { page: page.canvas, slot, x, y, bounds, mask, eye_x, eye_y };
  }

  free(sprite: AtlasSprite): void {
    this.free_slots.push(sprite.slot);
  }
}

export const is_opaque = (sprite: AtlasSprite, x: number, y: number): boolean =>
  ((sprite.mask[y * MASK_ROW_WORDS + (x >> 5)]! >>> (x & 31)) & 1) === 1;

export type BirdAtlasCache = BirdSpriteCache<AtlasSprite>;

const MIN_CACHED_FRAMES = 9000;

export const create_bird_atlas_cache = (atlas: BirdAtlas): BirdAtlasCache =>
  new BirdSpriteCache<AtlasSprite>(MIN_CACHED_FRAMES, sprite => atlas.free(sprite));
