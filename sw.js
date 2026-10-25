// Cache offline: non identifica la release. Ogni navigazione online controlla la rete,
// aggiorna il contenuto salvato e usa la cache solo se la rete non e' disponibile.
const PREFIX = `amerikano:${self.registration.scope}:`;
const CACHE = `${PREFIX}offline-network-first-v3`;
const ASSETS = ['./', './index.html', './styles.css', './i18n.js', './supabase-config.js',
 './share.js', './docs.js', './docs/Manuale-Amerikano-Segnapunti.pdf', './app.js',
 './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png'];
const CORE = ASSETS.filter(path => path !== './docs/Manuale-Amerikano-Segnapunti.pdf');
const SCOPE = new URL(self.registration.scope);
const INDEX = new URL('./index.html', SCOPE).href;
const ASSET_URLS = new Set(ASSETS.map(path => new URL(path, SCOPE).href));
// Controllo versioni basato sul contenuto, non su un numero aggiornato manualmente.
// Soltanto le richieste di verifica provocano il reload: i normali download non lo fanno.
const LIVE_ASSETS = new Set(['./index.html','./app.js','./share.js','./docs.js','./i18n.js','./styles.css']
 .map(path => new URL(path,SCOPE).href));

function cacheKey(request) {
 const url = new URL(request.url);
 url.search = '';
 url.hash = '';
 if (request.mode === 'navigate' && (url.href === SCOPE.href || url.href === INDEX)) return INDEX;
 return ASSET_URLS.has(url.href) ? url.href : null;
}
async function fetchFresh(request, key) {
 // Il parametro cambia per ciascuna richiesta: evita anche CDN che servono vecchi JS/CSS.
 // Le query dell'utente (game, view, stats) restano nell'URL del browser, mai nel cache key.
 const url = new URL(request.url);
 url.searchParams.set('__amerikano_fresh', Date.now().toString(36));
 const response = await fetch(url.href, {cache:'no-store', credentials:'same-origin'});
 if (response.ok && response.type !== 'opaque') {
   const cache = await caches.open(CACHE);
   const check = LIVE_ASSETS.has(key) && new URL(request.url).searchParams.has('__amerikano_check');
   const previous = check ? await cache.match(key) : null;
   // Non considerare la prima installazione un aggiornamento: manca ancora un riferimento.
   const changed = previous && (await previous.text()) !== (await response.clone().text());
   await cache.put(key, response.clone());
   if (changed) {
     const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
     for (const client of clients) client.postMessage({type:'AMERIKANO_ASSET_UPDATED'});
   }
 }
 return response;
}
self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.all(CORE.map(async path => {
   const key = new URL(path === './' ? './index.html' : path, SCOPE).href;
   // Il contenuto offline di base viene aggiornato gia' durante l'installazione.
   const fresh = new URL(key);
   fresh.searchParams.set('__amerikano_install', Date.now().toString(36));
   const response = await fetch(fresh.href, {cache:'no-store', credentials:'same-origin'});
   if (!response.ok || response.type === 'opaque') throw new Error('Offline core missing: '+path);
   await cache.put(key, response);
  }));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)));
  await self.clients.claim();
  const clients = await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for (const client of clients) client.postMessage({type:'AMERIKANO_UPDATE_READY'});
 })());
});
self.addEventListener('message', event => {
 if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
self.addEventListener('fetch', event => {
 if (event.request.method !== 'GET') return;
 const url = new URL(event.request.url);
 if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname)) return;
 const key = cacheKey(event.request);
 if (!key) return; // Supabase e qualunque altra richiesta non passano dalla cache.
 event.respondWith((async () => {
  try {
   const response = await fetchFresh(event.request, key);
   if (response.ok) return response;
   const cached = await (await caches.open(CACHE)).match(key);
   return cached || response;
  } catch(error) {
   const cached = await (await caches.open(CACHE)).match(key);
   if (cached) return cached;
   throw error;
  }
 })());
});
