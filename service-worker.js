const CACHE_NAME = 'brunos-world-v4';

const ASSETS = [
  './',
  'style.css',
  'game.js',
  'manifest.json',
  'assets/sprites/portrait.png',
  'assets/sprites/profile_right.png',
  'assets/sprites/profile_left.png',
  'assets/sprites/run_01.png',
  'assets/sprites/run_02.png',
  'assets/sprites/run_03.png',
  'assets/sprites/run_04.png',
  'assets/sprites/eat_01.png',
  'assets/sprites/eat_02.png',
  'assets/sprites/wash_wet.png',
  'assets/sprites/wash_shake.png',
  'assets/sprites/sleep.png',
  'assets/sprites/catch.png',
  'assets/sprites/frames.json',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
