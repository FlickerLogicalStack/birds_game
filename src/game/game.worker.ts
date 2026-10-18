import { serve_tasks } from '../engine/worker.task';
import {
  bird_pack_task,
  bird_sprites_task,
  bird_unpack_task,
} from './entities/birds/bird.sprite_task';
import { clouds_pixels_task } from './entities/sky/clouds.sprites';
import { moon_pixels_task, sun_pixels_task } from './entities/sky/sky.sprites';
import { stars_pixels_task } from './entities/sky/stars.sprites';
import { tree_pixels_task } from './entities/tree/tree.sprite';

serve_tasks([
  tree_pixels_task,
  sun_pixels_task,
  moon_pixels_task,
  clouds_pixels_task,
  stars_pixels_task,
  bird_sprites_task,
  bird_pack_task,
  bird_unpack_task,
]);
