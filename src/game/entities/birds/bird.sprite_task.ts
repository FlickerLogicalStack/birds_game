import { define_task } from '../../../engine/worker.task';
import {
  copy_genes,
  packed_pose_count,
  render_bird_pixels,
  SPRITE_SIZE,
  unpack_pose,
  type BirdGenes,
} from './bird.generator';

export const BIRD_SPRITE_BYTES = SPRITE_SIZE * SPRITE_SIZE * 4;

export type BirdSpritesInput = { genes: BirdGenes; poses: Float64Array };

const render_bird_sprites = ({ genes, poses }: BirdSpritesInput) => {
  const g = copy_genes(genes);
  const count = packed_pose_count(poses);
  const out = new Uint8ClampedArray(count * BIRD_SPRITE_BYTES);

  for (let i = 0; i < count; i++) {
    out.set(render_bird_pixels(g, unpack_pose(poses, i)), i * BIRD_SPRITE_BYTES);
  }

  return out;
};

export const bird_sprites_task = define_task({
  name: 'bird.sprites',
  run: render_bird_sprites,
  transfer: pixels => [pixels.buffer],
});

const pipe_bytes = (bytes: BufferSource, stream: CompressionStream | DecompressionStream) =>
  new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer();

export const bird_pack_task = define_task({
  name: 'bird.pack',
  run: (pixels: Uint8ClampedArray<ArrayBuffer>) =>
    pipe_bytes(pixels, new CompressionStream('deflate')),
  transfer: packed => [packed],
});

export const bird_unpack_task = define_task({
  name: 'bird.unpack',
  run: async (packed: ArrayBuffer) =>
    new Uint8ClampedArray(await pipe_bytes(packed, new DecompressionStream('deflate'))),
  transfer: pixels => [pixels.buffer],
});
