/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE = 'birds';
const UPDATE_CHECK = 'check_update';
const PRECACHE = ['./', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);

      await cache.addAll(PRECACHE.map(url => new Request(url, { cache: 'reload' })));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name !== CACHE) {
          await caches.delete(name);
        }
      }

      await self.clients.claim();
    })(),
  );
});

const refresh = async (cache: Cache, request: Request, key: string | Request) => {
  try {
    const response = await fetch(request, { cache: 'no-cache' });

    if (response.ok) {
      await cache.put(key, response.clone());
    }

    return response;
  } catch {
    return null;
  }
};

let page_update: Promise<boolean> = Promise.resolve(false);

self.addEventListener('message', event => {
  const port = event.ports[0];

  if (event.data !== UPDATE_CHECK || port === undefined) {
    return;
  }

  event.waitUntil(page_update.then(ready => port.postMessage(ready)));
});

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  const key = request.mode === 'navigate' ? './' : request;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(key, { ignoreSearch: true });
      const fresh = refresh(cache, request, key);

      if (cached !== undefined && request.mode === 'navigate') {
        const cached_text = cached.clone().text();

        page_update = fresh.then(async response =>
          response === null || !response.ok
            ? false
            : (await response.text()) !== (await cached_text),
        );
        event.waitUntil(page_update);

        return cached;
      }

      if (cached !== undefined) {
        event.waitUntil(fresh);

        return cached;
      }

      return (await fresh) ?? Response.error();
    })(),
  );
});
