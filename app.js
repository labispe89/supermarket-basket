const $=s=>document.querySelector(s);
let items=JSON.parse(localStorage.getItem('basket')||'null')||[];
let catalog=null, loading=null;
const DATA='https://raw.githubusercontent.com/spirosrap/posokanei-basket-demo/main/public/data/catalog-runtime.json';
const stores=['sklavenitis','mymarket','masoutis','ab_vasilopoulos','kritikos'];
const labels={sklavenitis:'Σκλαβενίτης',mymarket:'My market',masoutis:'Μασούτης',ab_vasilopoulos:'ΑΒ Βασιλόπουλος',kritikos:'Κρητικός'};
const norm=s=>(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ς/g,'σ').replace(/[^a-z0-9α-ω]+/gi,' ').trim();
const stop=new Set(['το','η','ο','τα','τη','την','και','σε','με','απο','για','φθηνοτερο','φθηνη','φθηνο','cheapest','επωνυμο']);
function tokens(s){return norm(s).split(' ').filter(x=>x.length>1&&!stop.has(x))}
function save(){localStorage.setItem('basket',JSON.stringify(items))}
function render(){const ul=$('#list');ul.innerHTML='';items.forEach((x,i)=>{let li=document.createElement('li'),s=document.createElement('span'),b=document.createElement('button');s.textContent=x;b.textContent='×';b.onclick=()=>{items.splice(i,1);save();render()};li.append(s,b);ul.append(li)});$('#count').textContent=items.length+' προϊόντα'}
function add(v){v=(v||$('#itemInput').value).trim();if(!v)return;items.push(v);$('#itemInput').value='';save();render()}
$('#addBtn').onclick=()=>add();$('#itemInput').addEventListener('keydown',e=>{if(e.key==='Enter')add()});document.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>add(b.dataset.v));
async function loadCatalog(){
 if(catalog)return catalog;if(loading)return loading;
 loading=fetch(DATA,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{catalog=d.products||d;return catalog});
 return loading;
}
function score(q,p){
 const qt=tokens(q), hay=norm([p.name,p.brand,p.category,p.subcategory].join(' ')); if(!qt.length)return 0;
 let hit=0;for(const t of qt){if(hay.includes(t))hit++}
 let s=hit/qt.length;
 if(p.brand&&norm(q).includes(norm(p.brand)))s+=.35;
 const nums=(norm(q).match(/\d+(?:[.,]\d+)?/g)||[]); if(nums.length&&nums.some(n=>hay.includes(n)))s+=.15;
 return s;
}
function candidates(q,products){
 const generic=/φθην|cheapest|οικονομ/i.test(q);
 let a=products.map(p=>[p,score(q,p)]).filter(x=>x[1]>=.55).sort((x,y)=>y[1]-x[1]);
 if(!generic&&a.length){const best=a[0][1];a=a.filter(x=>x[1]>=best-.12)}
 return a.slice(0,generic?120:35).map(x=>x[0]);
}
function offerFor(q,store,products){
 const cs=candidates(q,products), found=[];
 for(const p of cs){for(const rp of (p.retailer_prices||[])){if(rp.retailer===store&&Number.isFinite(+rp.price))found.push({request:q,product:p.name,brand:p.brand||'',price:+rp.price,unit:rp.price_normalized})}}
 if(!found.length)return null;
 const generic=/φθην|cheapest|οικονομ/i.test(q);
 return found.sort((a,b)=>generic?a.price-b.price:score(q,{name:b.product,brand:b.brand})-score(q,{name:a.product,brand:a.brand})||a.price-b.price)[0];
}
$('#compareBtn').onclick=async()=>{
 if(!items.length)return;
 $('#result').hidden=false;$('#winner').textContent='Φόρτωση πραγματικών τιμών…';$('#total').textContent='';$('#coverage').textContent='Κατεβάζω τον τρέχοντα κατάλογο PosoKanei…';$('#breakdown').innerHTML='';$('#stores').innerHTML='';
 try{
  const products=await loadCatalog();
  const scores=stores.map(name=>{const rows=items.map(q=>offerFor(q,name,products));const missing=rows.filter(x=>!x).length;return{name,rows,missing,complete:missing===0,total:rows.reduce((a,r)=>a+(r?r.price:0),0)}});
  const complete=scores.filter(s=>s.complete).sort((a,b)=>a.total-b.total);
  if(!complete.length){
   $('#winner').textContent='Δεν βρέθηκε πλήρες καλάθι';$('#total').textContent='—';
   $('#coverage').textContent='Δεν βρέθηκαν όλα τα ζητούμενα προϊόντα στην ίδια αλυσίδα.';
   $('#breakdown').innerHTML='<p class="note">Δες παρακάτω την κάλυψη ανά αλυσίδα. Δοκίμασε πιο συγκεκριμένη περιγραφή για προϊόντα που δεν αναγνωρίστηκαν.</p>';
  }else{
   const w=complete[0];$('#winner').textContent='🏆 '+labels[w.name];$('#total').textContent='€'+w.total.toFixed(2).replace('.',',');$('#coverage').textContent=items.length+'/'+items.length+' προϊόντα βρέθηκαν';
   $('#breakdown').innerHTML=w.rows.map(r=>`<div class="line"><span>${r.request}<small style="display:block">${r.product}</small></span><b>€${r.price.toFixed(2).replace('.',',')}</b></div>`).join('');
  }
  const winner=complete[0];
  $('#stores').innerHTML=scores.sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.total-b.total)).map(s=>`<div class="store ${winner&&s.name===winner.name?'winner':''}"><span>${winner&&s.name===winner.name?'🏆 ':''}${labels[s.name]}</span><b>${s.complete?'€'+s.total.toFixed(2).replace('.',','):(items.length-s.missing)+'/'+items.length+' προϊόντα'}</b></div>`).join('');
 }catch(e){$('#winner').textContent='Αποτυχία φόρτωσης τιμών';$('#coverage').textContent='Δεν μπόρεσα να φορτώσω τον κατάλογο. Δοκίμασε ξανά σε λίγο.';console.error(e)}
 $('#result').scrollIntoView({behavior:'smooth',block:'start'});
};
let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$('#installBtn').hidden=true};
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');render();