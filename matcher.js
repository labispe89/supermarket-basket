// Conservative intent parsing: constraints are gates, never scoring bonuses.
export const normalize = value => String(value ?? '').toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/ς/g, 'σ')
  .replace(/ν[οo][υy][νn][οo][υy]|noynoy|nounou/g, 'νουνου')
  .replace(/gouda/g, 'γκουντα').replace(/[^a-z0-9α-ω]+/g, ' ').trim();
const aliases = new Map([
  ['καροτα','καροτο'], ['αγγουρια','αγγουρι'], ['αγγουρακια','αγγουρι'], ['αγγουρακι','αγγουρι'],
  ['ντοματεσ','ντοματα'], ['τοματεσ','ντοματα'], ['τοματα','ντοματα'],
  ['πατατεσ','πατατα'], ['πορτοκαλια','πορτοκαλι'], ['γιαουρτιου','γιαουρτι'],
  ['γιαουρτια','γιαουρτι'], ['ψιχατοστ','τοστ'],
]);
const stop = new Set(['το','η','ο','τα','τη','την','και','σε','με','απο','για','φθηνοτερο','φθηνο','φθηνη','οικονομικο','cheapest','επωνυμο','τουλαχιστον']);
export const words = value => normalize(value).split(' ').filter(Boolean).map(w => aliases.get(w) || w);
const produce = new Set(['καροτο','αγγουρι','ντοματα','πατατα','πορτοκαλι']);
const brandedBread = new Set(['καραμολεγκοσ','κατσελησ','κρισ κρισ','παπαδοπουλου','δερβισησ']);
const privateBrands = /(^| )(mr grand|μαρατα|αβ|ab|365|bonora|fin carre|ιδιωτικησ ετικετασ)( |$)/;
const pet = /γατο|σκυλ|πατε|pet food/;
const prepared = /κατεψ|κονσερβ|χυμο|φρουτοποτο|αλμη|τουρσι|σαλατ|σουπ|πουρε|σνακ|σπαγγετι|κρακερ|κουλουρ|βρεφ|ετοιμ|σαλτσα|πολτο|κετσαπ|αποξηρ/;
const sizePattern = /(≥|>=|τουλάχιστον\s*)?\s*(\d+(?:[.,]\d+)?)\s*(kg|κιλά|κιλο|g|gr|γρ|γραμμάρια|ml|lt|l)(?![a-zα-ω])/iu;
function sizeOf(text) {
  const match = String(text).match(sizePattern);
  if (!match) return null;
  const unit = normalize(match[3]);
  return { minimum: !!match[1], value: Number(match[2].replace(',','.')) * (/^(kg|κιλα|κιλο|l|lt)$/.test(unit) ? 1000 : 1), dimension: /^(ml|l|lt)$/.test(unit) ? 'volume' : 'mass', raw: match[0] };
}
export function parseIntent(query, products = []) {
  const size = sizeOf(query);
  const lexical = words(size ? query.replace(size.raw, ' ') : query).filter(w => !stop.has(w));
  const knownBrands = [...new Set(['νουνου', ...products.map(p => normalize(p.brand)).filter(Boolean)])].sort((a,b) => b.length-a.length);
  const phrase = ` ${normalize(query)} `;
  const brand = knownBrands.find(b => phrase.includes(` ${b} `)) || null;
  const fresh = lexical.find(w => produce.has(w));
  const category = fresh && !prepared.test(normalize(query)) && !pet.test(normalize(query)) ? 'fresh-produce'
    : lexical.includes('τοστ') && lexical.includes('ψωμι') ? 'toast'
    : lexical.includes('γιαουρτι') ? 'yogurt' : lexical.includes('γκουντα') ? 'gouda'
    : lexical.includes('γαλα') ? 'milk' : lexical.includes('ρυζι') ? 'rice'
    : lexical.includes('αυγα') ? 'eggs' : 'other';
  return {query, category, produce: fresh, brand, size, lexical, branded: words(query).includes('επωνυμο'), exact: !!brand};
}
export function productSize(p) {
  const fromName = sizeOf(p.name);
  const qty = p.unit_quantity;
  const unit = normalize(p.unit);
  const fromMetadata = typeof qty === 'number' && qty > 0 && ['kg','g','l','ml'].includes(unit)
    ? {value: qty * (['kg','l'].includes(unit) ? 1000 : 1), dimension: ['l','ml'].includes(unit) ? 'volume' : 'mass'} : null;
  // Multipacks are not interchangeable with the single package requested.
  if (/\d+\s*[x×]\s*\d/i.test(p.name)) return fromMetadata;
  if (fromName && fromMetadata && (fromName.dimension !== fromMetadata.dimension || Math.abs(fromName.value-fromMetadata.value) > 1)) return null;
  return fromMetadata || fromName;
}
export function rejection(intent, p) {
  const name = words(p.name), category = normalize(`${p.category || ''} ${p.subcategory || ''}`);
  const all = normalize(`${p.name} ${category}`), brand = normalize(p.brand);
  if (intent.brand && brand !== intent.brand) return 'brand';
  if (intent.category === 'fresh-produce') {
    // Positive category evidence AND a matching ingredient identity are required.
    if (pet.test(all) || prepared.test(all) || !/λαχανικ|φρεσκ|νωπ|φρουτ/.test(category) || !name.includes(intent.produce)) return 'category';
    const allowed = new Set([intent.produce, 'φρεσκα','φρεσκο','φρεσκοσ','νωπα','νωπο','βιολογικα','βιολογικο','ελληνικα','ελληνικο','ελλαδασ','εισαγωγησ','εγχωρια','μινι','baby','συσκευασμενα','συσκευασμενο','χυμα','κιλου','kg','g','gr','γρ']);
    words(p.brand).forEach(w => allowed.add(w));
    const stripped = p.name.replace(sizePattern, ' ');
    if (words(stripped).some(w => !allowed.has(w))) return 'unverified-produce';
  }
  if (intent.category === 'toast' && (!/ψωμι|αρτοποι/.test(category) || !name.includes('τοστ') || /φρυγαν|σαντουιτσ|παξιμαδ/.test(all))) return 'category';
  if (intent.category === 'yogurt' && (!/γιαουρτ/.test(category) || /επιδορπ/.test(category))) return 'category';
  if (intent.category === 'gouda' && !/γκουντα/.test(category)) return 'category';
  if (intent.category === 'milk' && (!/γαλα/.test(category) || /σοκολατ|βρεφ|επιδορπ|κρεμα/.test(category) || pet.test(all))) return 'category';
  if (intent.category === 'rice' && (!/ρυζι/.test(category) || /ρυζογκοφ|ετοιμ|βρεφ/.test(category))) return 'category';
  if (intent.category === 'eggs' && !/αυγα/.test(category)) return 'category';
  if (intent.branded && (p.private_label === true || privateBrands.test(brand) || (p.private_label !== false && !brandedBread.has(brand)))) return 'unverified-brand';
  if (intent.size) {
    const s = productSize(p);
    if (!s || s.dimension !== intent.size.dimension || (intent.size.minimum ? s.value < intent.size.value : Math.abs(s.value-intent.size.value) > 0.01)) return 'size';
  }
  const hay = new Set([...name, ...words(p.brand)]);
  if (!intent.lexical.length || !intent.lexical.every(w => hay.has(w))) return 'terms';
  return null;
}
export function matchRequest(query, products, selectedId) {
  const intent = parseIntent(query, products);
  const rejected = {};
  const candidates = products.filter(p => {
    const reason = rejection(intent,p);
    if (reason) rejected[reason] = (rejected[reason] || 0) + 1;
    return !reason;
  });
  const selected = selectedId && candidates.find(p => p.id === selectedId);
  // Resolve identity globally before considering store prices: no variant substitutions.
  const ambiguous = !selected && ((intent.exact && candidates.length > 1) || (intent.category === 'other' && !intent.brand));
  return {intent, candidates: selected ? [selected] : candidates, rejected,
    status: !candidates.length ? 'unmatched' : ambiguous ? 'ambiguous' : 'matched'};
}
