const $=s=>document.querySelector(s);
let items=JSON.parse(localStorage.getItem('basket')||'null')||['ΝΟΥΝΟΥ Gouda φέτες 200g','Ψωμί τοστ, επώνυμο, ≥600g','ΟΛΥΜΠΟΣ Μεγαλώνω 1L','Πορτοκάλια 1kg'];
const demo={
 'Σκλαβενίτης':[['ΝΟΥΝΟΥ Gouda 200g',2.24],['ΟΛΥΜΠΟΣ Μεγαλώνω 1L',2.20],['Καραμολέγκος ψωμί τοστ 680g',1.58],['Πορτοκάλια 1kg',0.75]],
 'My market':[['ΝΟΥΝΟΥ Gouda 200g',2.22],['ΟΛΥΜΠΟΣ Μεγαλώνω 1L',2.21],['Επώνυμο ψωμί τοστ ≥600g',1.51],['Πορτοκάλια 1kg',1.20]],
 'Κρητικός':[['ΝΟΥΝΟΥ Gouda 200g',2.64],['ΟΛΥΜΠΟΣ Μεγαλώνω 1L',1.84],['Επώνυμο ψωμί τοστ ≥600g',1.59],['Πορτοκάλια 1kg',1.15]],
 'ΑΒ':[['ΝΟΥΝΟΥ Gouda 200g',2.75],['ΟΛΥΜΠΟΣ Μεγαλώνω 1L',1.90],['Επώνυμο ψωμί τοστ ≥600g',1.58],['Πορτοκάλια 1kg',1.10]]
};
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9α-ω≥]+/gi,' ').trim();
function matches(input,offer){
 const a=norm(input),b=norm(offer);
 if(a.includes('νουνου')&&a.includes('gouda')) return b.includes('νουνου')&&b.includes('gouda');
 if((a.includes('μεγαλωνω')||a.includes('μεγαλωνο'))) return b.includes('μεγαλωνω');
 if(a.includes('πορτοκαλ')) return b.includes('πορτοκαλ');
 if(a.includes('τοστ')) return b.includes('τοστ');
 return a.split(' ').filter(x=>x.length>2).every(x=>b.includes(x));
}
function save(){localStorage.setItem('basket',JSON.stringify(items))}
function render(){const ul=$('#list');ul.innerHTML='';items.forEach((x,i)=>{let li=document.createElement('li'),s=document.createElement('span'),b=document.createElement('button');s.textContent=x;b.textContent='×';b.setAttribute('aria-label','Διαγραφή '+x);b.onclick=()=>{items.splice(i,1);save();render()};li.append(s,b);ul.append(li)});$('#count').textContent=items.length+' προϊόντα'}
function add(v){v=(v||$('#itemInput').value).trim();if(!v)return;items.push(v);$('#itemInput').value='';save();render()}
$('#addBtn').onclick=()=>add();$('#itemInput').addEventListener('keydown',e=>{if(e.key==='Enter')add()});document.querySelectorAll('.chips button').forEach(b=>b.onclick=()=>add(b.dataset.v));
$('#compareBtn').onclick=()=>{
 if(!items.length)return;
 const scores=Object.entries(demo).map(([name,offers])=>{
  const rows=[],missing=[];
  items.forEach(request=>{const candidates=offers.filter(o=>matches(request,o[0])).sort((a,b)=>a[1]-b[1]);if(candidates.length)rows.push([request,candidates[0][0],candidates[0][1]]);else missing.push(request)});
  return{name,rows,missing,complete:missing.length===0,total:rows.reduce((a,r)=>a+r[2],0)}
 });
 const complete=scores.filter(s=>s.complete).sort((a,b)=>a.total-b.total);
 $('#result').hidden=false;
 if(!complete.length){
  $('#winner').textContent='Δεν υπάρχει πλήρες αποτέλεσμα';
  $('#total').textContent='—';
  $('#coverage').textContent='Κανένα supermarket στα διαθέσιμα demo δεδομένα δεν έχει τιμή για όλα τα προϊόντα της λίστας.';
  $('#breakdown').innerHTML='<p class="note">Δεν χρησιμοποιούμε πλέον το παλιό 4-item καλάθι όταν προσθέτεις νέα προϊόντα. Τα προϊόντα χωρίς δεδομένα μπλοκάρουν το αποτέλεσμα μέχρι να συνδεθεί live πηγή τιμών.</p>';
  $('#stores').innerHTML=scores.map(s=>`<div class="store"><span>${s.name}</span><b>${s.rows.length}/${items.length} προϊόντα</b></div>`).join('');
 }else{
  const w=complete[0];
  $('#winner').textContent='🏆 '+w.name;$('#total').textContent='€'+w.total.toFixed(2).replace('.',',');
  $('#coverage').textContent=items.length+'/'+items.length+' προϊόντα διαθέσιμα';
  $('#breakdown').innerHTML=w.rows.map(r=>`<div class="line"><span>${r[0]}<small style="display:block">${r[1]}</small></span><b>€${r[2].toFixed(2).replace('.',',')}</b></div>`).join('');
  $('#stores').innerHTML=scores.sort((a,b)=>Number(b.complete)-Number(a.complete)||(a.total-b.total)).map(s=>`<div class="store ${s.name===w.name?'winner':''}"><span>${s.name===w.name?'🏆 ':''}${s.name}</span><b>${s.complete?'€'+s.total.toFixed(2).replace('.',','):s.rows.length+'/'+items.length+' προϊόντα'}</b></div>`).join('');
 }
 $('#result').scrollIntoView({behavior:'smooth',block:'start'});
};
let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#installBtn').hidden=false});$('#installBtn').onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice;deferred=null;$('#installBtn').hidden=true};if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js');render();