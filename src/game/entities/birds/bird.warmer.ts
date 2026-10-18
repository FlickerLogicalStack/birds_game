import { NO_TRANSFER } from '../../../engine/worker';
import type { PersistentCache } from '../../../engine/persistent';
import type { Workers } from '../../../engine/worker';
import type { BirdAtlas, BirdAtlasCache } from './bird.atlas';
import {
  decode_pose,
  eye_colors,
  genes_key,
  is_rest_code,
  pack_poses,
  pose_table_hash,
  sprite_key,
  type BirdBehaviour,
  type BirdGenes,
  type EyeColors,
} from './bird.generator';
import {
  BIRD_SPRITE_BYTES,
  bird_pack_task,
  bird_sprites_task,
  bird_unpack_task,
} from './bird.sprite_task';

interface WarmJob {
  gid: number;
  genes: BirdGenes;
  codes: number[];
  index: number;
}

interface WarmBatch {
  gid: number;
  genes: BirdGenes;
  codes: number[];
  clip: boolean;
  failures: number;
}

interface WarmBird {
  gid: number;
  key: string;
  state: 'lookup' | 'warm' | 'done' | 'failed';
  birds: number;
  codes: number[];
  collected: Map<number, Uint8ClampedArray<ArrayBuffer>>;
  eyes: EyeColors;
}

type StoredBird = {
  version: string;
  codes: Int32Array;
  data: ArrayBuffer;
};

export type WarmLevel = 'rest' | 'all';

const WARM_RESERVE = 1.2;
const BATCH_SIZE = 6;
const BATCHES_PER_WORKER = 2;

const RESTORES_IN_FLIGHT = 2;

const MAX_BATCH_RETRIES = 2;

const stored_key = (genes: BirdGenes) => `bird:${genes_key(genes)}`;

export class BirdSpriteWarmer {
  private first_jobs: WarmJob[] = [];
  private rest_jobs: WarmJob[] = [];
  private clip_jobs: WarmJob[] = [];
  private retry_batches: WarmBatch[] = [];
  private birds = new Map<number, WarmBird>();
  private reserved = 0;
  private rest_total = 0;
  private rest_done = 0;
  private clip_total = 0;
  private clip_done = 0;
  private in_flight = new Set<number>();
  private batches_in_flight = 0;
  private restores_running = 0;
  private restore_queue: (() => void)[] = [];
  private version: string | null | undefined;
  stored_hits = 0;
  stored_misses = 0;

  constructor(
    readonly cache: BirdAtlasCache,
    readonly atlas: BirdAtlas,
    private readonly workers: Workers,
    private readonly persistent: PersistentCache,
  ) {}

  private update_reserve(codes: number): void {
    this.reserved += codes;
    this.cache.reserve(this.reserved * WARM_RESERVE);
  }

  get pending(): number {
    return this.rest_total + this.clip_total - this.rest_done - this.clip_done;
  }

  add(bird: BirdBehaviour): void {
    const codes = bird.all_codes();
    this.update_reserve(codes.length);
    const rest = codes.filter(is_rest_code);
    const clip = codes.filter(code => !is_rest_code(code));
    this.first_jobs.push({ gid: bird.gid, genes: bird.genes, codes: [bird.rest_code], index: 0 });
    this.rest_jobs.push({ gid: bird.gid, genes: bird.genes, codes: rest, index: 0 });
    this.clip_jobs.push({ gid: bird.gid, genes: bird.genes, codes: clip, index: 0 });
    this.rest_total += 1 + rest.length;
    this.clip_total += clip.length;

    const existing = this.birds.get(bird.gid);

    if (existing) {
      existing.birds += 1;
    } else {
      const entry: WarmBird = {
        gid: bird.gid,
        key: stored_key(bird.genes),
        state: 'warm',
        birds: 1,
        codes,
        collected: new Map(),
        eyes: eye_colors(bird.genes),
      };

      this.birds.set(bird.gid, entry);
      this.lookup(entry);
    }

    this.pump();
  }

  remove(bird: BirdBehaviour): void {
    const entry = this.birds.get(bird.gid);

    if (!entry) {
      return;
    }

    this.update_reserve(-entry.codes.length);

    if (--entry.birds > 0) {
      return;
    }

    this.birds.delete(bird.gid);
    this.drop_jobs(bird.gid);
  }

  progress(level: WarmLevel): number {
    const total = level === 'rest' ? this.rest_total : this.rest_total + this.clip_total;
    const done = level === 'rest' ? this.rest_done : this.rest_done + this.clip_done;

    return total === 0 ? 1 : done / total;
  }

  private stored_version(): string | null {
    if (this.version === undefined) {
      const source = this.workers.source_hash;

      this.version = source === null ? null : `${source}:${pose_table_hash()}`;
    }

    return this.version;
  }

  private lookup(entry: WarmBird): void {
    const version = this.stored_version();

    if (version === null) {
      return;
    }

    entry.state = 'lookup';

    void this.persistent
      .get<StoredBird>(entry.key)
      .then(stored =>
        stored !== null && this.matches(entry, stored, version)
          ? this.limit_restore(() => this.restore(entry, stored))
          : false,
      )
      .catch(error => {
        console.error('Stored bird sprites failed:', error);
        return false;
      })
      .then(restored => {
        if (restored) {
          this.stored_hits += 1;
        } else {
          this.stored_misses += 1;
          entry.state = 'warm';
        }

        this.pump();
      });
  }

  private matches(entry: WarmBird, stored: StoredBird, version: string): boolean {
    return (
      stored.version === version &&
      stored.codes.length === entry.codes.length &&
      entry.codes.every((code, i) => stored.codes[i] === code)
    );
  }

  private async limit_restore<T>(restore: () => Promise<T>): Promise<T> {
    if (this.restores_running >= RESTORES_IN_FLIGHT) {
      await new Promise<void>(resolve => this.restore_queue.push(resolve));
    }

    this.restores_running += 1;

    try {
      return await restore();
    } finally {
      this.restores_running -= 1;
      this.restore_queue.shift()?.();
    }
  }

  private async restore(entry: WarmBird, stored: StoredBird): Promise<boolean> {
    const pixels = await this.workers.run(bird_unpack_task, stored.data, [stored.data]);

    if (pixels.length !== entry.codes.length * BIRD_SPRITE_BYTES) {
      return false;
    }

    entry.codes.forEach((code, i) => this.put(entry.gid, code, pixels, i, entry.eyes));
    entry.state = 'done';
    this.drop_jobs(entry.gid);

    return true;
  }

  private drop_jobs(gid: number): void {
    for (const jobs of [this.first_jobs, this.rest_jobs, this.clip_jobs]) {
      const clip = jobs === this.clip_jobs;

      for (let i = jobs.length - 1; i >= 0; i--) {
        const job = jobs[i]!;

        if (job.gid === gid) {
          this.count_done(clip, job.codes.length - job.index);
          jobs.splice(i, 1);
        }
      }
    }
  }

  private pump(): void {
    const limit = this.workers.count * BATCHES_PER_WORKER;

    while (this.batches_in_flight < limit) {
      const batch = this.next_batch();

      if (batch === null) {
        return;
      }

      this.send(batch);
    }
  }

  private next_batch(): WarmBatch | null {
    const retry = this.retry_batches.shift();

    if (retry) {
      return retry;
    }

    for (const jobs of [this.first_jobs, this.rest_jobs, this.clip_jobs]) {
      const clip = jobs === this.clip_jobs;

      for (let j = 0; j < jobs.length;) {
        const job = jobs[j]!;

        if (this.birds.get(job.gid)?.state === 'lookup') {
          j++;
          continue;
        }

        const codes: number[] = [];

        while (job.index < job.codes.length && codes.length < BATCH_SIZE) {
          const code = job.codes[job.index++]!;
          const key = sprite_key(job.gid, code);

          if (this.cache.has_code(job.gid, code) || this.in_flight.has(key)) {
            this.count_done(clip, 1);
          } else {
            this.in_flight.add(key);
            codes.push(code);
          }
        }

        if (job.index >= job.codes.length) {
          jobs.splice(j, 1);
        }

        if (codes.length > 0) {
          return { gid: job.gid, genes: job.genes, codes, clip, failures: 0 };
        }
      }
    }

    return null;
  }

  private send(batch: WarmBatch): void {
    const poses = pack_poses(batch.codes.map(decode_pose));

    this.batches_in_flight += 1;
    this.workers
      .run(bird_sprites_task, { genes: batch.genes, poses }, NO_TRANSFER)
      .then(pixels => this.store(batch, pixels))
      .then(
        () => this.finish(batch),
        error => this.fail(batch, error),
      )
      .finally(() => {
        this.batches_in_flight -= 1;
        this.pump();
      });
  }

  private finish(batch: WarmBatch): void {
    for (const code of batch.codes) {
      this.in_flight.delete(sprite_key(batch.gid, code));
    }

    this.count_done(batch.clip, batch.codes.length);
  }

  private fail(batch: WarmBatch, error: unknown): void {
    if (batch.failures < MAX_BATCH_RETRIES && this.birds.has(batch.gid)) {
      batch.failures += 1;
      console.warn('Bird sprites failed, retrying:', error);
      this.retry_batches.push(batch);
      return;
    }

    console.error('Bird sprites failed:', error);
    this.finish(batch);

    const entry = this.birds.get(batch.gid);

    if (entry && entry.state === 'warm') {
      entry.state = 'failed';
      entry.collected.clear();
    }
  }

  private store(batch: WarmBatch, pixels: Uint8ClampedArray<ArrayBuffer>): void {
    const entry = this.birds.get(batch.gid);
    const eyes = eye_colors(batch.genes);

    batch.codes.forEach((code, i) => {
      const frame = this.put(batch.gid, code, pixels, i, eyes);

      if (entry && entry.state === 'warm') {
        entry.collected.set(code, frame);
      }
    });

    if (entry && entry.state === 'warm' && entry.collected.size >= entry.codes.length) {
      this.save(entry);
    }
  }

  private put(
    gid: number,
    code: number,
    pixels: Uint8ClampedArray<ArrayBuffer>,
    index: number,
    eyes: EyeColors,
  ): Uint8ClampedArray<ArrayBuffer> {
    const offset = index * BIRD_SPRITE_BYTES;
    const frame = new Uint8ClampedArray(pixels.buffer, offset, BIRD_SPRITE_BYTES);

    this.cache.set_code(gid, code, this.atlas.put(frame, eyes, decode_pose(code).head_flip));

    return frame;
  }

  private save(entry: WarmBird): void {
    const version = this.stored_version();
    const pixels = new Uint8ClampedArray(entry.codes.length * BIRD_SPRITE_BYTES);

    entry.codes.forEach((code, i) => {
      pixels.set(entry.collected.get(code)!, i * BIRD_SPRITE_BYTES);
    });
    entry.collected.clear();
    entry.state = 'done';

    if (version === null) {
      return;
    }

    void this.workers
      .run(bird_pack_task, pixels, [pixels.buffer])
      .then(data =>
        this.persistent.set(entry.key, {
          version,
          codes: Int32Array.from(entry.codes),
          data,
        } satisfies StoredBird),
      )
      .catch(error => console.error('Saving bird sprites failed:', error));
  }

  private count_done(clip: boolean, n: number): void {
    if (clip) this.clip_done += n;
    else this.rest_done += n;
  }
}
