import {fresh} from './optimizer.js';
export const MIRROR_URL = 'https://raw.githubusercontent.com/spirosrap/posokanei-basket-demo/main/public/data/catalog-runtime.json';
export function normalizeMirror(data) {
  if (!Array.isArray(data.products) || !data.products.length) throw Error('Μη έγκυρος κατάλογος');
  return {provider:'PosoKanei · ανεπίσημο αντίγραφο', sourceUrl:MIRROR_URL, generatedAt:data.generated_at,
    rankingAllowed:false, products:data.products.filter(p => typeof p.id === 'string' && typeof p.name === 'string').map(p => ({...p,offers:[]})),
    note:'Το αντίγραφο χρησιμοποιείται μόνο για αναγνώριση προϊόντων. Δεν τεκμηριώνει πρόσφατες τιμές ανά προϊόν ή άδεια επαναχρησιμοποίησης των τιμών.'};
}
export function normalizeAuthorized(data, config) {
  if (!data || data.schemaVersion !== 1 || !Array.isArray(data.products) || !data.products.length || !fresh(data.generatedAt) || !config.permissionUrl) throw Error('Μη έγκυρη ή παλιά τροφοδοσία τιμών');
  const ids = new Set();
  for (const p of data.products) {
    if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || typeof p.name !== 'string' || !Array.isArray(p.offers)) throw Error('Μη έγκυρα προϊόντα');
    ids.add(p.id);
    if (p.offers.some(o => !o || typeof o !== 'object')) throw Error('Μη έγκυρες προσφορές');
  }
  return {...data,provider:config.name,sourceUrl:config.url,rankingAllowed:true,note:'Τιμές καταλόγου, όχι εγγύηση αποθέματος υποκαταστήματος. Σύγκριση στις 5 υποστηριζόμενες αλυσίδες.'};
}
async function getJSON(url, fetcher) {
  const response = await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw Error(`HTTP ${response.status}`);
  return response.json();
}
// Provider adapters share a normalized contract. No scraping proxy or fabricated prices.
export async function loadCatalog({fetcher = fetch, storage} = {}) {
  if (!storage) {try {storage = globalThis.localStorage;} catch { /* Storage may be disabled. */ }}
  const errors = [];
  let config;
  try {config = await getJSON('./providers.json',fetcher);} catch {errors.push('Δεν φορτώθηκαν οι ρυθμίσεις πηγών.');}
  for (const provider of config?.authorizedFeeds || []) {
    try {
      if (!provider.url.startsWith('https://') || !provider.permissionUrl?.startsWith('https://')) throw Error('Μη ασφαλής πηγή');
      return {...normalizeAuthorized(await getJSON(provider.url,fetcher),provider),errors};
    } catch {errors.push(`${provider.name}: μη διαθέσιμη ή μη έγκυρη πηγή.`);}
  }
  try {
    const data = await getJSON(MIRROR_URL,fetcher);
    const catalog = normalizeMirror(data);
    try {storage?.setItem('catalog-diagnostics-v6',JSON.stringify(data));} catch { /* Quota/privacy must not break comparison. */ }
    return {...catalog,errors,offline:false};
  } catch {errors.push('Δεν ήταν δυνατή η λήψη του καταλόγου.');}
  try {
    const cached = normalizeMirror(JSON.parse(storage?.getItem('catalog-diagnostics-v6') || 'null'));
    return {...cached,errors,offline:true,note:'Αποθηκευμένος κατάλογος μόνο για αναγνώριση. Απαιτείται σύνδεση και έγκυρη πηγή για σύγκριση τιμών.'};
  } catch {throw Error(errors.join(' '));}
}
