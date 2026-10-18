export type Stored<T> = {
  key: string;
  fallback: T;
  is_valid: (value: unknown) => value is T;
};

export const define_stored = <T>(
  key: string,
  fallback: T,
  is_valid: (value: unknown) => value is T,
): Stored<T> => ({ key, fallback, is_valid });

export const load_stored = <T>(item: Stored<T>): T => {
  try {
    const raw = localStorage.getItem(item.key);

    if (raw === null) {
      return item.fallback;
    }

    const value: unknown = JSON.parse(raw);

    return item.is_valid(value) ? value : item.fallback;
  } catch {
    return item.fallback;
  }
};

export const save_stored = <T>(item: Stored<T>, value: T) => {
  try {
    localStorage.setItem(item.key, JSON.stringify(value));
  } catch {}
};

export const is_bit = (value: unknown): value is number => value === 0 || value === 1;
