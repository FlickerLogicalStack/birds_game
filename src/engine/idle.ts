export type IdleTask = (time_left: () => number) => boolean;

type Deadline = { didTimeout: boolean; timeRemaining: () => number };

const FALLBACK_SLICE_MS = 4;
const STARVED_TIMEOUT_MS = 100;
const STARVED_SLICE_MS = 2;

const request_idle = (callback: (deadline: Deadline) => void) => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(callback, { timeout: STARVED_TIMEOUT_MS });
    return;
  }

  setTimeout(() => {
    const end = performance.now() + FALLBACK_SLICE_MS;

    callback({ didTimeout: false, timeRemaining: () => Math.max(0, end - performance.now()) });
  }, 1);
};

export class IdleScheduler {
  #tasks: IdleTask[] = [];
  #cursor = 0;
  #scheduled = false;

  get size(): number {
    return this.#tasks.length;
  }

  add = (task: IdleTask) => {
    if (!this.#tasks.includes(task)) {
      this.#tasks.push(task);
    }

    this.#wake();
  };

  remove = (task: IdleTask) => {
    const index = this.#tasks.indexOf(task);

    if (index === -1) {
      return;
    }

    this.#tasks.splice(index, 1);

    if (index < this.#cursor) {
      this.#cursor -= 1;
    }
  };

  #wake = () => {
    if (this.#scheduled || this.#tasks.length === 0) {
      return;
    }

    this.#scheduled = true;
    request_idle(this.#run);
  };

  #run = (deadline: Deadline) => {
    this.#scheduled = false;

    const starved_end = deadline.didTimeout ? performance.now() + STARVED_SLICE_MS : 0;
    const time_left = () => Math.max(deadline.timeRemaining(), starved_end - performance.now());

    while (this.#tasks.length > 0 && time_left() > 0) {
      if (this.#cursor >= this.#tasks.length) {
        this.#cursor = 0;
      }

      const task = this.#tasks[this.#cursor]!;

      if (task(time_left)) {
        this.#cursor += 1;
      } else {
        this.remove(task);
      }
    }

    this.#wake();
  };
}
