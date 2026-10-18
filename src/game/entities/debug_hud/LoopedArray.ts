export class LoopedSmiArray {
  readonly length: number;

  readonly #array: number[];
  readonly #mask: number;

  #index = 0;

  constructor(factor: number) {
    const length = 2 ** factor;

    this.length = length;
    this.#array = Array.from<number>({ length }).fill(0);
    this.#mask = length - 1;
  }

  push = (value: number) => {
    this.#array[this.#index] = value;

    this.#index = (this.#index + 1) & this.#mask;
  };

  avg = () => {
    let total = 0;
    let i = 0;

    const length = this.length;

    while (i < length) {
      total += this.#array[i++]!;
    }

    return length ? total / length : 0;
  };
}

export class LoopedFloat16Array {
  readonly length: number;

  readonly #array: Float16Array;
  readonly #mask: number;

  #index = 0;

  constructor(factor: number) {
    const length = 2 ** factor;

    this.length = length;
    this.#array = new Float16Array(length);
    this.#mask = length - 1;
  }

  push = (value: number) => {
    this.#array[this.#index] = value;

    this.#index = (this.#index + 1) & this.#mask;
  };

  avg = () => {
    let total = 0;
    let i = 0;

    const length = this.length;

    while (i < length) {
      total += this.#array[i++]!;
    }

    return length ? total / length : 0;
  };
}

export class LoopedFloat32Array {
  readonly length: number;

  readonly #array: Float32Array;
  readonly #mask: number;

  #index = 0;

  constructor(factor: number) {
    const length = 2 ** factor;

    this.length = length;
    this.#array = new Float32Array(length);
    this.#mask = length - 1;
  }

  push = (value: number) => {
    this.#array[this.#index] = value;

    this.#index = (this.#index + 1) & this.#mask;
  };

  avg = () => {
    let total = 0;
    let i = 0;

    const length = this.length;

    while (i < length) {
      total += this.#array[i++]!;
    }

    return length ? total / length : 0;
  };
}
