import { hash_text } from './hash';
import type { AnyTask, TaskRequest, TaskResponse, WorkerTask } from './worker.task';

const after_next_frame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve)));

type Pending = {
  task: AnyTask;
  input: unknown;
  slot: number;
  transferred: boolean;
  resolve: (output: unknown) => void;
  reject: (error: Error) => void;
};

export const default_worker_count = () =>
  Math.max(1, Math.floor((navigator.hardwareConcurrency || 2) / 2) - 1);

export const NO_TRANSFER: Transferable[] = [];

export class Workers {
  #pool: Worker[] | null | undefined;
  #load: number[] = [];
  #next_id = 0;
  #pending = new Map<number, Pending>();
  #main_tail: Promise<unknown> = Promise.resolve();

  #source_hash: string | null | undefined;

  constructor(
    readonly bundle: string,
    readonly count: number,
  ) {}

  get source_hash(): string | null {
    if (this.#source_hash === undefined) {
      const source = this.#bundle_source();

      this.#source_hash = source === null ? null : hash_text(source).toString(36);
    }

    return this.#source_hash;
  }

  get busy(): number {
    return this.#pending.size;
  }

  get state(): 'lazy' | 'pool' | 'main' {
    return this.#pool === undefined ? 'lazy' : this.#pool === null ? 'main' : 'pool';
  }

  get loads(): readonly number[] {
    return this.#pool ? this.#load : [];
  }

  run<TInput, TOutput>(
    task: WorkerTask<TInput, TOutput>,
    input: TInput,
    transfer: Transferable[],
  ): Promise<TOutput> {
    const pool = this.#get_pool();

    if (pool === null) {
      return this.#run_on_main(task, input);
    }

    let slot = 0;

    for (let i = 1; i < pool.length; i++) {
      if (this.#load[i]! < this.#load[slot]!) {
        slot = i;
      }
    }

    return new Promise<TOutput>((resolve, reject) => {
      const id = this.#next_id++;

      this.#load[slot]! += 1;
      this.#pending.set(id, {
        task,
        input,
        slot,
        transferred: transfer.length > 0,
        resolve: resolve as (output: unknown) => void,
        reject,
      });
      pool[slot]!.postMessage({ id, name: task.name, input } satisfies TaskRequest, transfer);
    });
  }

  #run_on_main<TInput, TOutput>(task: WorkerTask<TInput, TOutput>, input: TInput) {
    const result = this.#main_tail.then(after_next_frame).then(() => task.run(input));

    this.#main_tail = result.catch(() => {});

    return result;
  }

  #bundle_source(): string | null {
    return document.querySelector(`script[data-worker="${this.bundle}"]`)?.textContent || null;
  }

  #get_pool(): Worker[] | null {
    if (this.#pool !== undefined) {
      return this.#pool;
    }

    try {
      const source = this.#bundle_source();

      if (source === null) {
        throw new Error(`No worker bundle "${this.bundle}" (src/**/${this.bundle}.worker.ts)`);
      }

      const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));

      this.#pool = Array.from({ length: this.count }, () => this.#create(url));
      this.#load = this.#pool.map(() => 0);
    } catch (error) {
      console.warn(`Worker "${this.bundle}" unavailable, tasks run on the main thread:`, error);
      this.#pool = null;
    }

    return this.#pool;
  }

  #create(url: string): Worker {
    const worker = new Worker(url, { type: 'module' });

    worker.onmessage = (event: MessageEvent<TaskResponse>) => {
      const { id, output, error } = event.data;
      const pending = this.#pending.get(id);

      if (!pending) {
        return;
      }

      this.#pending.delete(id);
      this.#load[pending.slot]! -= 1;

      if (error === undefined) {
        pending.resolve(output);
      } else {
        pending.reject(new Error(`Task "${pending.task.name}" failed: ${error}`));
      }
    };

    worker.onerror = event => {
      console.warn(`Worker "${this.bundle}" failed, tasks run on the main thread:`, event.message);

      for (const copy of this.#pool ?? []) {
        copy.terminate();
      }

      this.#pool = null;

      for (const { task, input, transferred, resolve, reject } of this.#pending.values()) {
        if (transferred) {
          reject(
            new Error(`Task "${task.name}" lost: its input was transferred to the failed worker`),
          );
        } else {
          this.#run_on_main(task, input).then(resolve, reject);
        }
      }

      this.#pending.clear();
    };

    return worker;
  }
}
