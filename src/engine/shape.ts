export const FLOAT_ZERO = -0;

const SAMPLES: object[] = [];

export const __opt_remember_shape = <T extends object>(sample: T): T => {
  SAMPLES.push(sample);

  return sample;
};

export const __opt_prepare_mutations = <T extends object>(
  sample: T,
  names: readonly (keyof T)[],
): T => {
  const fields = sample as Record<keyof T, unknown>;

  for (const name of names) {
    const value = fields[name];

    if (typeof value === 'number') {
      fields[name] = value + 1;
    } else if (typeof value === 'boolean') {
      fields[name] = !value;
    } else if (value === null) {
      fields[name] = {};
    }
  }

  return sample;
};
