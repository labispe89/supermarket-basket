import {matchRequest} from './matcher.js';
export const MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const STORES = {sklavenitis:'Σκλαβενίτης',mymarket:'My market',masoutis:'Μασούτης',ab_vasilopoulos:'ΑΒ Βασιλόπουλος',kritikos:'Κρητικός'};
export function fresh(timestamp, now = Date.now()) {
  if (typeof timestamp !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(timestamp)) return false;
  const time = Date.parse(timestamp);
  return Number.isFinite(time) && time <= now && now-time <= MAX_AGE_MS;
}
export function optimize(items, catalog, now = Date.now()) {
  const matches = items.map(item => matchRequest(item.query, catalog.products, item.selectedId));
  const eligible = catalog.rankingAllowed === true && fresh(catalog.generatedAt, now);
  const stores = Object.entries(STORES).map(([id,label]) => {
    const rows = matches.map((match,index) => {
      const quantity = items[index].quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) return {status:'invalid-quantity'};
      if (match.status !== 'matched') return {status:match.status};
      if (!eligible) return {status:'unverified-source'};
      const offers = match.candidates.flatMap(p => (p.offers || []).filter(o =>
        o.store === id && o.available === true && o.currency === 'EUR' && o.priceBasis === 'package' &&
        typeof o.price === 'number' && Number.isFinite(o.price) && o.price > 0 &&
        fresh(o.observedAt,now) && typeof o.sourceUrl === 'string' && o.sourceUrl.startsWith('https://') && o.unconditional === true
      ).map(o => ({product:p, offer:o, cents:Math.round(o.price*100)*quantity, quantity})));
      offers.sort((a,b) => a.cents-b.cents || a.product.id.localeCompare(b.product.id));
      return offers.length ? {status:'matched',...offers[0]} : {status:'no-current-price'};
    });
    const complete = rows.length > 0 && rows.every(r => r.status === 'matched');
    return {id,label,rows,complete,totalCents:complete ? rows.reduce((sum,r) => sum+r.cents,0) : null};
  });
  const ranked = stores.filter(s => s.complete).sort((a,b) => a.totalCents-b.totalCents || a.id.localeCompare(b.id));
  return {matches,stores,ranked,winner:ranked[0] || null,eligible};
}
