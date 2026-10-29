const CACHE_NAME = 'cub-quiz-pwa-v19';
const SHELL_FILES = [
  './',
  './index.html',
  './app.js',
  './question-editor.js',
  './style.css',
  './manifest.webmanifest',
  './data/advancements.json',
  './data/question-files.json',
  './images/app-icon-192.png',
  './images/app-icon-512.png',
  './images/badges/burrowup.png',
  './images/badges/silverwolf.png',
  './images/badges/goldwolf.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_FILES.map((path) => new Request(new URL(path, self.registration.scope), { cache: 'reload' })));
    await cacheQuestionFiles(cache);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('cub-quiz-pwa-') && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const isImage = /\/images\//i.test(url.pathname);
    if (isImage) {
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) {
        await cache.put(request, response.clone());
        if (/\/data\/[^/]+\.json$/i.test(url.pathname) && !url.pathname.endsWith('/advancements.json')) await cacheQuestionImages(cache, response.clone());
      }
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') return (await cache.match(new URL('./index.html', self.registration.scope))) || Response.error();
      return new Response('You are offline and this file is not cached yet.', { status: 503, statusText: 'Offline' });
    }
  })());
});


async function cacheQuestionFiles(cache) {
  try {
    const manifestResponse = await fetch(new URL('./data/question-files.json', self.registration.scope), { cache: 'no-cache' });
    if (!manifestResponse.ok) return;
    const manifest = await manifestResponse.json();
    const names = [...new Set((manifest.files || []).filter((name) => typeof name === 'string' && /^[a-z0-9][a-z0-9._-]*\.json$/i.test(name) && !['advancements.json', 'question-files.json'].includes(name.toLowerCase())))];
    await Promise.all(names.map(async (name) => {
      try {
        const request = new Request(new URL(`./data/${encodeURIComponent(name)}`, self.registration.scope), { cache: 'reload' });
        const response = await fetch(request);
        if (!response.ok) return;
        await cache.put(request, response.clone());
        await cacheQuestionImages(cache, response.clone());
      } catch (error) { console.warn(`Could not cache question bank ${name}.`, error); }
    }));
  } catch (error) { console.warn('Question banks could not be cached for offline use.', error); }
}

async function cacheQuestionImages(cache, response) {
  if (!response?.ok) return;
  try {
    const data = await response.json();
    const imagePaths = new Set();
    for (const question of data.questions || []) {
      if (question.image) imagePaths.add(question.image);
      for (const cell of question.cells || []) {
        if (cell.image) imagePaths.add(cell.image);
      }
      for (const step of question.steps || []) {
        if (step.image) imagePaths.add(step.image);
      }
      for (const option of question.options || []) {
        if (typeof option === 'object' && option.image) imagePaths.add(option.image);
      }
      for (const item of [...(question.leftItems || []), ...(question.rightItems || [])]) {
        if (item.image) imagePaths.add(item.image);
      }
      for (const pair of question.pairs || []) {
        if (pair.left?.type === 'image' && pair.left.src) imagePaths.add(pair.left.src);
        if (pair.right?.type === 'image' && pair.right.src) imagePaths.add(pair.right.src);
      }
    }
    const requests = [...imagePaths]
      .filter((path) => path.startsWith('images/'))
      .map((path) => new Request(new URL(path, self.registration.scope), { cache: 'reload' }));
    if (requests.length) await Promise.allSettled(requests.map((request) => cache.add(request)));
  } catch (error) {
    console.warn('Some quiz images could not be cached for offline use.', error);
  }
}
