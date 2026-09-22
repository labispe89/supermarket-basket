export const SOURCES = [
  {id:'metabook',name:'Metabook',host:'metabook.gr'},
  {id:'skroutz',name:'Skroutz',host:'skroutz.gr'},
  {id:'public',name:'Public',host:'public.gr'},
  {id:'politeia',name:'Πολιτεία',host:'politeianet.gr'},
  {id:'vendora',name:'Vendora',host:'vendora.gr'},
  {id:'vinted',name:'Vinted',host:'vinted.gr'},
  {id:'other',name:'Άλλη πηγή',host:null}
];
export const DEFAULTS = Object.freeze({buyProfit:7,buyROI:70,watchMin:4,watchMax:7,minConfidence:75,maxPurchase:50,maxCompetition:20,minDemand:0,minScarcity:0,maxTurnover:180,maxAgeHours:48,feePercent:5,feeFixed:0,shippingIn:3,shippingOut:0,packaging:0.5,resaleDiscount:15,exactOnly:false,sources:SOURCES.map(s=>s.id)});
export const normalize = s => String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('el').replace(/ς/g,'σ').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function isbn(value) {
  const s=String(value||'').replace(/[\s-]/g,'').toUpperCase();
  if (/^\d{9}[\dX]$/.test(s)) {
    if ([...s].reduce((n,c,i)=>n+(c==='X'?10:+c)*(10-i),0)%11) return null;
    const stem='978'+s.slice(0,9); return stem+((10-[...stem].reduce((n,c,i)=>n+(+c)*(i%2?3:1),0)%10)%10);
  }
  if (!/^97[89]\d{10}$/.test(s)) return null;
  return [...s].reduce((n,c,i)=>n+(+c)*(i%2?3:1),0)%10===0?s:null;
}
export function safeUrl(value,source) {
  try { const u=new URL(value); const host=SOURCES.find(s=>s.id===source)?.host;
    return u.protocol==='https:'&&!u.username&&!u.password&&(!host||u.hostname===host||u.hostname.endsWith('.'+host))?u.href:null;
  } catch {return null;}
}
export function settings(input={}) {
  const s={...DEFAULTS,...input};
  for (const key of Object.keys(DEFAULTS).filter(k=>typeof DEFAULTS[k]==='number')) {
    if(typeof s[key]!=='number'||!Number.isFinite(s[key])||s[key]<0) throw Error('Μη έγκυρη ρύθμιση: '+key);
  }
  if(s.watchMin>s.watchMax||s.feePercent>100||s.resaleDiscount>=100||s.minConfidence>100||s.minScarcity>100||s.maxAgeHours===0) throw Error('Ελέγξτε τα όρια και τα ποσοστά.');
  if(typeof s.exactOnly!=='boolean'||!Array.isArray(s.sources)||s.sources.some(x=>!SOURCES.some(p=>p.id===x))) throw Error('Μη έγκυρη επιλογή πηγών.');
  return s;
}
const numeric=(v)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
export function validateObservations(rows) {
  if(!Array.isArray(rows)||rows.length>5000) throw Error('Αναμένονται έως 5.000 εγγραφές.');
  const ids=new Set();
  return rows.map((r,i)=>{
    const fail=()=>{throw Error(`Μη έγκυρη εγγραφή ${i+1}: ελέγξτε ISBN, τιμή, πηγή, URL, ημερομηνία και τύπο.`);};
    if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id)||typeof r.title!=='string'||!r.title.trim()||!SOURCES.some(s=>s.id===r.source)||!safeUrl(r.url,r.source)||!numeric(r.price)||r.price<0.01||r.price>1000000||r.currency!=='EUR'||!['offer','asking','sold','retail'].includes(r.kind)||!['new','like-new','good','fair'].includes(r.condition)||typeof r.observedAt!=='string'||!/(Z|[+-]\d{2}:\d{2})$/.test(r.observedAt)||!Number.isFinite(Date.parse(r.observedAt))) fail();
    if(r.isbn&&!isbn(r.isbn)) fail();
    for(const k of ['demand','competition','turnoverDays','shippingIn','shippingOut','feeFixed','feePercent']) if(r[k]!=null&&!numeric(r[k])) fail();
    if(r.feePercent>100) fail();
    for(const k of ['author','publisher','seller']) if(r[k]!=null&&typeof r[k]!=='string') fail();
    ids.add(r.id); return {...r,isbn:isbn(r.isbn),url:safeUrl(r.url,r.source)};
  });
}
export function match(a,b,exactOnly=false) {
  const ai=isbn(a.isbn),bi=isbn(b.isbn);
  if(ai&&bi) return ai===bi?'isbn':null;
  if(exactOnly) return null;
  return ['title','author','publisher'].every(k=>normalize(a[k])&&normalize(a[k])===normalize(b[k]))?'metadata':null;
}
export const isFresh=(r,hours,now=Date.now())=>{const age=now-Date.parse(r.observedAt);return age>=-300000&&age<=hours*3600000;};
const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
const conditionRank={'fair':0,'good':1,'like-new':2,'new':3};
function unique(rows) {const seen=new Set();return [...rows].sort((a,b)=>Date.parse(b.observedAt)-Date.parse(a.observedAt)).filter(r=>{const u=new URL(r.url);u.hash='';for(const k of [...u.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/.test(k))u.searchParams.delete(k);u.searchParams.sort();const key=u.href;if(seen.has(key))return false;seen.add(key);return true;});}
export function analyze(rows,input={},query='',now=Date.now()) {
  const s=settings(input), all=unique(validateObservations(rows).filter(r=>s.sources.includes(r.source)));
  const current=all.filter(r=>isFresh(r,s.maxAgeHours,now));
  const q=normalize(query), qi=isbn(query);
  const candidates=all.filter(r=>['offer','retail'].includes(r.kind)&&(!q||(qi?r.isbn===qi:normalize([r.title,r.author,r.publisher].join(' ')).includes(q))));
  return candidates.map(buy=>{
    const reasons=[];
    const matched=current.filter(r=>r.id!==buy.id&&r.url!==buy.url&&!(r.seller&&buy.seller&&r.source===buy.source&&r.seller===buy.seller)&&match(buy,r,s.exactOnly));
    const comparable=matched.filter(r=>conditionRank[r.condition]<=conditionRank[buy.condition]);
    const sold=comparable.filter(r=>r.kind==='sold');
    const asking=comparable.filter(r=>['offer','asking'].includes(r.kind));
    // Retail availability caps resale, including a retail purchase candidate itself.
    const retail=current.filter(r=>r.kind==='retail'&&match(buy,r,s.exactOnly));
    const samples=(sold.length?sold:asking).map(r=>r.price).sort((a,b)=>a-b);
    let resale=samples.length?samples[Math.floor((samples.length-1)*0.25)]*(1-s.resaleDiscount/100):null;
    if(resale!==null&&asking.length) resale=Math.min(resale,...asking.map(r=>r.price*0.95));
    if(resale!==null&&retail.length) resale=Math.min(resale,Math.min(...retail.map(r=>r.price))*(buy.condition==='new'?0.95:0.75));
    resale=resale===null?null:cents(resale);
    const exact=matched.length>0&&matched.every(r=>match(buy,r)==='isbn');
    const confidence= samples.length?Math.min(exact?95:60,(exact?50:30)+Math.min(sold.length,3)*12+Math.min(asking.length,3)*5):0;
    const competition=buy.competition??null,demand=buy.demand??null,turnoverDays=buy.turnoverDays??null;
    const scarcity=competition===null?null:cents(100/(1+competition));
    const cost=cents(buy.price+(buy.shippingIn??s.shippingIn));
    const fees=resale===null?null:cents(resale*(buy.feePercent??s.feePercent)/100+(buy.feeFixed??s.feeFixed));
    const expenses=cents((buy.shippingOut??s.shippingOut)+s.packaging);
    const profit=resale===null?null:cents(resale-cost-fees-expenses);
    const roi=profit===null?null:cents(profit/cost*100);
    if(!isFresh(buy,s.maxAgeHours,now)) reasons.push('Παλιά ή μελλοντική τιμή αγοράς');
    if(buy.price>s.maxPurchase) reasons.push('Υπέρβαση μέγιστης αγοράς');
    if(competition!==null&&competition>s.maxCompetition) reasons.push('Υψηλός ανταγωνισμός');
    if(s.minDemand>0&&(demand===null||demand<s.minDemand)) reasons.push('Ανεπαρκής ή άγνωστη ζήτηση');
    if(s.minScarcity>0&&(scarcity===null||scarcity<s.minScarcity)) reasons.push('Ανεπαρκής ή άγνωστη σπανιότητα');
    if(turnoverDays!==null&&turnoverDays>s.maxTurnover) reasons.push('Αργή εκτιμώμενη πώληση');
    if(resale===null) reasons.push('Δεν υπάρχουν πρόσφατα συγκρίσιμα μεταπώλησης');
    let classification='PASS';
    const qualified=confidence>=s.minConfidence&&sold.length>=2&&exact&&competition!==null&&turnoverDays!==null&&demand!==null;
    if(!reasons.length&&profit>=s.buyProfit&&roi>=s.buyROI&&qualified) classification='BUY';
    else if(!reasons.length&&profit>0&&((profit>=s.watchMin&&profit<=s.watchMax)||(profit>=s.buyProfit&&roi>=s.buyROI&&!qualified))) classification='WATCH';
    if(confidence<s.minConfidence) reasons.push('Χαμηλή βεβαιότητα');
    if(!sold.length) reasons.push('Ζητούμενες τιμές, όχι αποδεδειγμένες πωλήσεις');
    if(!exact&&matched.length) reasons.push('Ταύτιση τίτλου + συγγραφέα + εκδότη: επιβεβαίωση έκδοσης');
    if(competition===null||demand===null||turnoverDays===null) reasons.push('Ελλιπή στοιχεία ανταγωνισμού / ζήτησης / χρόνου πώλησης');
    if(classification==='PASS'&&!reasons.length) reasons.push('Δεν καλύπτει τα οικονομικά όρια BUY/WATCH');
    return {buy,resale,cost,fees,expenses,profit,roi,confidence,competition,demand,scarcity,turnoverDays,classification,reasons,matchType:exact?'ISBN':'Τίτλος + συγγραφέας + εκδότης',comparables:matched,observedCompetition:asking.length};
  }).sort((a,b)=>({BUY:0,WATCH:1,PASS:2}[a.classification]-{BUY:0,WATCH:1,PASS:2}[b.classification])||(b.profit??-Infinity)-(a.profit??-Infinity));
}
