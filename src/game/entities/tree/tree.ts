import type { Rect } from '../camera/camera';
import type { Platform } from '../platforms/platforms';
import { leaves_margin } from './tree.leaves';
import { count_seats, trace_platforms } from './tree.platforms';
import { grow_skeleton, type Blob, type Skeleton } from './tree.skeleton';
import { CONFIG } from '../../../config';

export type Tree = {
  seed: number;
  levels: number;
  capacity: number;
  skeleton: Skeleton;
  blobs: Blob[];
  trunk_x: number;
  ground_y: number;
  ground_depth: number;
  platforms: Platform[];
  bounds: Rect;
};

export const TREE_SINK = CONFIG.world.tree_sink;
export const GROUND_Y = -TREE_SINK;

export const TREE_PARAMS = CONFIG.tree;

export type TreeParams = typeof TREE_PARAMS;

const BLEND = CONFIG.tree_sprite.blend;
const LEAF_TWIG_R = CONFIG.tree_sprite.leaf_twig_r;
const BARK_PAD = 2;

const compute_bounds = (sk: Skeleton, blobs: readonly Blob[], bottom: number): Rect => {
  const leaf = leaves_margin();
  let min_x = Infinity;
  let min_y = Infinity;
  let max_x = -Infinity;
  let max_y = -Infinity;

  for (let i = 0; i < sk.x.length; i++) {
    const r = sk.r[i]!;
    const pad = Math.max(r * (1 + BLEND) + BARK_PAD, r <= LEAF_TWIG_R ? leaf : 0);

    min_x = Math.min(min_x, sk.x[i]! - pad);
    min_y = Math.min(min_y, sk.y[i]! - pad);
    max_x = Math.max(max_x, sk.x[i]! + pad);
    max_y = Math.max(max_y, sk.y[i]! + pad);
  }

  for (const b of blobs) {
    min_x = Math.min(min_x, b.x - b.rx - leaf);
    min_y = Math.min(min_y, b.y - b.ry - leaf);
    max_x = Math.max(max_x, b.x + b.rx + leaf);
    max_y = Math.max(max_y, b.y + b.ry + leaf);
  }

  const x = Math.floor(min_x);
  const y = Math.floor(min_y);

  return { x, y, w: Math.ceil(max_x) - x, h: Math.ceil(Math.min(max_y, bottom)) - y };
};

export const generate_tree = (seed: number, levels: number, P: TreeParams): Tree => {
  const ground_y = GROUND_Y;
  const ground_depth = CONFIG.world.ground_depth;
  const clip_y = ground_y + ground_depth;
  const { skeleton, blobs } = grow_skeleton(seed, levels, ground_y + TREE_SINK, P);
  const platforms = trace_platforms(skeleton, ground_y, clip_y, P);

  return {
    seed,
    levels,
    capacity: Math.floor(count_seats(platforms) / P.growth.crowd),
    skeleton,
    blobs,
    trunk_x: skeleton.x[0]!,
    ground_y,
    ground_depth,
    platforms,
    bounds: compute_bounds(skeleton, blobs, clip_y),
  };
};

export const grow_tree = (seed: number, levels: number, birds: number, P: TreeParams): Tree => {
  const need = birds + P.growth.free_spots;
  let tree = generate_tree(seed, Math.max(levels, P.growth.min_levels), P);

  while (tree.capacity < need) {
    tree = generate_tree(seed, tree.levels + 1, P);
  }

  return tree;
};
