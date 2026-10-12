const PREFIX = `amerikano:${self.registration.scope}:`;
const CACHE = `${PREFIX}1.9.37-pages-1`;
const ASSETS = ['./', './index.html', './styles.css', './i18n.js', './supabase-config.js', './share.js', './docs.js', './docs/Manuale-Amerikano-Segnapunti.pdf', './app.js', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
const assetURLs = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));
self.addEventListener('install', event => {
  // An update waits until existing tabs close; no partial or mixed release.
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const scope = new URL(self.registration.scope);
  if (event.request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  url.search = ''; url.hash = '';
  // Cloud responses, unknown URLs and other sites never enter the cache.
  if (!assetURLs.has(url.href)) return;
  event.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(url.href);
    if (cached) return cached;
    const response = await fetch(event.request);
    if (response.ok && response.type !== 'opaque') await cache.put(url.href, response.clone());
    return response;
  }));
});
