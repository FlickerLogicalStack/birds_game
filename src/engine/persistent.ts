const STORE = 'entries';

type Remembered = { key: string; value: unknown };

const request_promise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

export class PersistentCache {
  #db: Promise<IDBDatabase | null> | undefined;

  constructor(readonly db_name: string) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const db = await this.#open();

      if (db === null) {
        return null;
      }

      const value = await request_promise(
        db.transaction(STORE, 'readonly').objectStore(STORE).get(key),
      );

      return value === undefined ? null : (value as T);
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    try {
      const db = await this.#open();

      if (db !== null) {
        const store = db.transaction(STORE, 'readwrite').objectStore(STORE);

        await request_promise(store.put(value, key));
      }
    } catch {}
  }

  async remember<T>(name: string, key: string, compute: () => T | Promise<T>): Promise<T> {
    const stored = await this.get<Remembered>(name);

    if (stored?.key === key) {
      return stored.value as T;
    }

    const value = await compute();

    void this.set(name, { key, value } satisfies Remembered);

    return value;
  }

  async clear(): Promise<void> {
    try {
      const db = await this.#open();

      if (db !== null) {
        await request_promise(db.transaction(STORE, 'readwrite').objectStore(STORE).clear());
      }
    } catch {}
  }

  #open() {
    this.#db ??= new Promise<IDBDatabase | null>(resolve => {
      try {
        const request = indexedDB.open(this.db_name, 1);

        request.onupgradeneeded = () => request.result.createObjectStore(STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    return this.#db;
  }
}
