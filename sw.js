const CACHE = 'basket-v6.0.0';
const SHELL = ['./','./index.html','./styles.css','./app.js','./matcher.js','./optimizer.js','./providers.js','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>/^basket-v/.test(key)&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url), root=new URL('./',self.location.href);
  if(event.request.method!=='GET'||url.origin!==root.origin)return;
  const relative=url.pathname.slice(root.pathname.length);
  if(!url.pathname.startsWith(root.pathname)||!['','index.html','styles.css','app.js','matcher.js','optimizer.js','providers.js','manifest.webmanifest','icon.svg'].includes(relative))return;
  // Config and prices never enter the app-shell cache.
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)));}return response;
  }).catch(()=>caches.match(event.request,{ignoreSearch:true})));
});
