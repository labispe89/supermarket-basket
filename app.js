import {loadCatalog} from './providers.js';
import {optimize, fresh} from './optimizer.js';
const $ = s => document.querySelector(s);
const money = cents => new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(cents/100);
const el = (tag,text,className) => {const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
let items = [], revision = 0, busy = false;
try {const saved=JSON.parse(localStorage.getItem('basket') || '[]');if(Array.isArray(saved)) items=saved.map(x=>typeof x==='string'?{query:x,quantity:1}:x).filter(x=>x && typeof x.query==='string' && Number.isInteger(x.quantity) && x.quantity>0 && x.quantity<=99).slice(0,100);} catch {}
function changed() {
  revision++; $('#result').hidden=true;
  try {localStorage.setItem('basket',JSON.stringify(items));} catch {$('#inputStatus').textContent='Η λίστα δεν μπορεί να αποθηκευτεί σε αυτόν τον browser.';}
  render();
}
function render() {
  $('#list').replaceChildren();
  items.forEach((item,index)=>{
    const li=el('li',''), content=el('div','', 'item-content');
    const edit=el('input','');edit.value=item.query;edit.setAttribute('aria-label',`Προϊόν ${index+1}`);
    edit.onchange=()=>{const query=edit.value.trim();if(query){item.query=query;delete item.selectedId;changed();}else render();};content.append(edit);
    const controls=el('div','', 'quantity'),minus=el('button','−'),plus=el('button','+'),remove=el('button','×');
    minus.setAttribute('aria-label',`Μείωση ποσότητας ${item.query}`);plus.setAttribute('aria-label',`Αύξηση ποσότητας ${item.query}`);remove.setAttribute('aria-label',`Αφαίρεση ${item.query}`);
    minus.disabled=item.quantity===1;plus.disabled=item.quantity===99;
    minus.onclick=()=>{item.quantity--;changed();};plus.onclick=()=>{item.quantity++;changed();};remove.onclick=()=>{items.splice(index,1);changed();};
    controls.append(minus,el('span',`${item.quantity} ×`),plus,remove);li.append(content,controls);$('#list').append(li);
  });
  $('#count').textContent=`${items.length} είδη`;$('#empty').hidden=items.length>0;$('#compareBtn').disabled=busy || !items.length;
}
function add(value=$('#itemInput').value) {
  const queries=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(items.length+queries.length>100){$('#inputStatus').textContent='Έως 100 είδη ανά λίστα.';return;}
  items.push(...queries.map(query=>({query,quantity:1})));$('#itemInput').value='';$('#inputStatus').textContent=queries.length?`Προστέθηκαν ${queries.length} είδη.`:'';changed();
}
$('#addBtn').onclick=()=>add();$('#itemInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();add();}});
document.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>add(b.dataset.v));
const reasons = {unmatched:'Δεν υπάρχει ασφαλής αντιστοίχιση στον κατάλογο.',ambiguous:'Χρειάζεται επιλογή συγκεκριμένης παραλλαγής.', 'unverified-source':'Δεν υπάρχει επαληθευμένη πρόσφατη τιμή.', 'no-current-price':'Λείπει έγκυρη πρόσφατη τιμή σε αυτή την αλυσίδα.', 'invalid-quantity':'Μη έγκυρη ποσότητα.'};
function display(catalog,result) {
  $('#result').hidden=false;$('#breakdown').replaceChildren();$('#stores').replaceChildren();$('#diagnostics').replaceChildren();
  const date=Date.parse(catalog.generatedAt);
  $('#sourceStatus').textContent=`${catalog.provider} · ${Number.isFinite(date)?new Date(date).toLocaleString('el-GR'):'Άγνωστη ημερομηνία'} · ${fresh(catalog.generatedAt)?'πρόσφατο στιγμιότυπο':'παλιό / άγνωστης ηλικίας στιγμιότυπο'}${catalog.offline?' · εκτός σύνδεσης':''}`;
  $('#sourceNote').textContent=[catalog.note,...catalog.errors || []].join(' ');
  $('#winner').textContent=result.winner?result.winner.label:'Δεν βρέθηκε έγκυρο πλήρες καλάθι';$('#total').textContent=result.winner?money(result.winner.totalCents):'—';
  $('#coverage').textContent=result.winner?`${items.length}/${items.length} είδη σε μία αλυσίδα. Φθηνότερο μεταξύ των πλήρων καλαθιών που ελέγχθηκαν.`:'Οι αλυσίδες με ελλείψεις ή μη επαληθευμένες τιμές αποκλείονται. Δεν υπολογίζεται μερικό σύνολο.';
  for(const row of result.winner?.rows || []) {const line=el('div','', 'line');line.append(el('span',`${row.quantity} × ${row.product.name}`),el('strong',money(row.cents)));$('#breakdown').append(line);}
  result.matches.forEach((match,index)=>{
    const box=el('div','', 'diagnostic');box.append(el('strong',items[index].query));
    box.append(el('p',match.status==='matched'?`Ασφαλείς επιλογές καταλόγου: ${match.candidates.length}. ${result.eligible?'':'Δεν αποτελούν διαθέσιμες προσφορές.'}`:reasons[match.status]));
    if(match.status==='ambiguous') {
      const select=el('select','');select.setAttribute('aria-label',`Επιλογή για ${items[index].query}`);
      const initial=el('option','Επίλεξε ακριβές προϊόν…');initial.value='';select.append(initial);
      match.candidates.forEach(p=>{const option=el('option',p.name);option.value=p.id;select.append(option);});
      select.onchange=()=>{items[index].selectedId=select.value;changed();compare();};box.append(select);
    } else if(match.candidates.length) box.append(el('p',match.candidates.slice(0,3).map(p=>p.name).join(' · '),'note'));
    if(match.status==='unmatched') box.append(el('p','Η απουσία από τον κατάλογο δεν σημαίνει ότι το προϊόν δεν πωλείται στο supermarket.','note'));$('#diagnostics').append(box);
  });
  for(const store of result.stores) {
    const detail=el('details','', 'store-detail');detail.append(el('summary',`${store.label} — ${store.complete?money(store.totalCents):'Αποκλείστηκε'}`));
    store.rows.forEach((row,i)=>{if(row.status!=='matched')detail.append(el('p',`${items[i].query}: ${reasons[row.status]}`));});$('#stores').append(detail);
  }
}
async function compare() {
  if(busy || !items.length)return;busy=true;render();const started=revision;$('#compareBtn').textContent='Έλεγχος καταλόγου…';$('#inputStatus').textContent='';
  try {const catalog=await loadCatalog();if(started!==revision)return;display(catalog,optimize(items,catalog));}
  catch(error){if(started!==revision)return;$('#result').hidden=false;$('#winner').textContent='Δεν φορτώθηκαν δεδομένα';$('#total').textContent='—';$('#coverage').textContent=error.message;$('#breakdown').replaceChildren();$('#stores').replaceChildren();$('#diagnostics').replaceChildren();$('#sourceStatus').textContent='Πηγή μη διαθέσιμη';$('#sourceNote').textContent='Η λίστα σου διατηρείται. Πάτησε ξανά για επανάληψη.';}
  finally {busy=false;$('#compareBtn').textContent='Σύγκρινε πλήρες καλάθι';render();}
}
$('#compareBtn').onclick=compare;
window.addEventListener('offline',()=>{$('#network').hidden=false;$('#result').hidden=true;revision++;});window.addEventListener('online',()=>{$('#network').hidden=true;});$('#network').hidden=navigator.onLine;
let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#installBtn').hidden=false;});$('#installBtn').onclick=async()=>{if(!deferred)return;await deferred.prompt();deferred=null;$('#installBtn').hidden=true;};
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});
render();
