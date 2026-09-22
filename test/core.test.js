import test from 'node:test';
import assert from 'node:assert/strict';
import {matchRequest,parseIntent,productSize} from '../matcher.js';
import {optimize,fresh} from '../optimizer.js';
import {normalizeMirror,normalizeAuthorized,loadCatalog} from '../providers.js';
const now=Date.parse('2026-09-22T10:00:00Z');
const offer=(store,price,extra={})=>({store,price,currency:'EUR',priceBasis:'package',available:true,unconditional:true,observedAt:'2026-09-22T09:00:00Z',sourceUrl:'https://example.org/product',...extra});
const product=(id,name,category,extra={})=>({id,name,category,brand:'',offers:[offer('sklavenitis',2)],...extra});
const fixtures=[
 product('carrot','Καρότα 1kg','Φρέσκα Λαχανικά'),
 product('cat','MR GRAND Γατοτροφή Πατέ Μοσχάρι/Καρότα 400γρ','Γάτες'),
 product('salad','Σαλάτα με Καρότα','Φρέσκα Λαχανικά'),
 product('frozen','Καρότα 1kg','Κατεψυγμένα Λαχανικά'),
 product('juice','Χυμός Καρότο 1L','Χυμοί'),
 product('cucumber','Αγγουράκια Μίνι Συσκευασμένα 750g','Συσκευασμένα Λαχανικά'),
 product('pickle','Αγγουράκια σε Άλμη 400g','Λαχανικά',{subcategory:'Κονσέρβες'}),
 product('tomato','Ντομάτες 1kg','Φρέσκα Λαχανικά'),
 product('sauce','Σάλτσα Ντομάτας','Σάλτσες'),
 product('yogurt','ΝΟΥΝΟΥ Εκλεκτό Γιαούρτι 200g','Γιαούρτι',{brand:'ΝOYNOY'}),
 product('yogurt-other','ΝΟΥΝΟΥ Στραγγιστό Γιαούρτι 200g','Γιαούρτι',{brand:'ΝΟΥΝΟΥ'}),
 product('gouda','ΝΟΥΝΟΥ Γκούντα σε Φέτες 200g','Γκούντα',{brand:'ΝOYNOY ',unit:'kg',unit_quantity:0.2}),
 product('gouda-big','ΝΟΥΝΟΥ Γκούντα 340g','Γκούντα',{brand:'ΝΟΥΝΟΥ'}),
 product('gouda-other','ΑΒ Γκούντα 200g','Γκούντα',{brand:'ΑΒ'}),
 product('toast','ΚΑΤΣΕΛΗΣ Ψωμί για Τοστ 720g','Ψωμί τυποποιημένο',{brand:'ΚΑΤΣΕΛΗΣ',offers:[offer('sklavenitis',3),offer('mymarket',2)]}),
 product('toast-small','ΚΑΤΣΕΛΗΣ Ψωμί Τοστ 500g','Ψωμί τυποποιημένο',{brand:'ΚΑΤΣΕΛΗΣ'}),
 product('toast-pl','ΜΑΡΑΤΑ Ψωμί Τοστ 700g','Ψωμί τυποποιημένο',{brand:'ΜΑΡΑΤΑ'}),
 product('toast-unknown','UNKNOWN Ψωμί Τοστ 700g','Ψωμί τυποποιημένο',{brand:'UNKNOWN'}),
];
for(const [query,expected] of [['καρότα','carrot'],['αγγούρια','cucumber'],['ντομάτες','tomato'],['Γιαούρτι ΝΟΥΝΟΥ Εκλεκτό','yogurt'],['ΝΟΥΝΟΥ Gouda 200g','gouda'],['ψωμί τοστ επώνυμο ≥600g','toast']]) {
 test(`acceptance: ${query}`,()=>assert.deepEqual(matchRequest(query,fixtures).candidates.map(p=>p.id),[expected]));
}
test('missing exact family never becomes another family',()=>assert.equal(matchRequest('Γιαούρτι ΝΟΥΝΟΥ Εκλεκτό',fixtures.filter(p=>p.id!=='yogurt')).status,'unmatched'));
test('unknown brand cannot become a lexical substitution',()=>assert.equal(matchRequest('ACME Gouda 200g',fixtures).status,'unmatched'));
test('two variants require explicit identity before store optimization',()=>{
 const list=[...fixtures,product('yogurt2','ΝΟΥΝΟΥ Εκλεκτό Γιαούρτι 2% 200g','Γιαούρτι',{brand:'ΝΟΥΝΟΥ'})];
 assert.equal(matchRequest('Γιαούρτι ΝΟΥΝΟΥ Εκλεκτό',list).status,'ambiguous');
 assert.deepEqual(matchRequest('Γιαούρτι ΝΟΥΝΟΥ Εκλεκτό',list,'yogurt2').candidates.map(p=>p.id),['yogurt2']);
});
test('stale selection cannot bypass intent',()=>assert.equal(matchRequest('ΝΟΥΝΟΥ Gouda 200g',fixtures,'gouda-other').candidates[0].id,'gouda'));
test('decimal kg minimum and Latin aliases',()=>{assert.equal(parseIntent('ψωμί τοστ επώνυμο >=0,6kg').size.value,600);assert.equal(matchRequest('NOUNOU gouda 200γρ',fixtures).candidates[0].id,'gouda');});
test('unverified fresh category is rejected',()=>assert.equal(matchRequest('καρότα',[product('x','Καρότα 1kg','')]).status,'unmatched'));
test('unrecognized composite in fresh category is rejected',()=>assert.equal(matchRequest('καρότα',[product('x','Καρότα με Αρακά 1kg','Φρέσκα Λαχανικά')]).status,'unmatched'));
test('conflicting size metadata cannot satisfy minimum',()=>assert.equal(productSize({name:'Ψωμί 680g',unit:'kg',unit_quantity:.705}),null));
test('empty query has no matches',()=>assert.equal(matchRequest('',fixtures).status,'unmatched'));
const catalog=products=>({products,rankingAllowed:true,generatedAt:'2026-09-22T09:00:00Z'});
test('cheapest admissible generic offer across entire catalog, no top-N cutoff',()=>{
 const products=Array.from({length:150},(_,i)=>product(String(i),'Καρότα 1kg','Φρέσκα Λαχανικά',{offers:[offer('sklavenitis',i===149?1:2)]}));
 assert.equal(optimize([{query:'καρότα'}],catalog(products),now).winner.totalCents,100);
});
test('incomplete stores rejected, not ranked with a partial sum',()=>{
 const result=optimize([{query:'καρότα'},{query:'ψωμί τοστ επώνυμο ≥600g'}],catalog(fixtures),now);
 assert.equal(result.winner.id,'sklavenitis');assert.equal(result.winner.totalCents,500);
 assert.equal(result.stores.find(s=>s.id==='mymarket').totalCents,null);
});
test('no cross-store basket',()=>{
 const products=[product('a','Καρότα','Φρέσκα Λαχανικά',{offers:[offer('sklavenitis',1)]}),product('b','Αγγούρια','Φρέσκα Λαχανικά',{offers:[offer('mymarket',1)]})];
 assert.equal(optimize([{query:'καρότα'},{query:'αγγούρια'}],catalog(products),now).winner,null);
});
for(const [name,change] of Object.entries({zero:{price:0},negative:{price:-1},null:{price:null},string:{price:'1'},infinite:{price:Infinity},stale:{observedAt:'2026-07-12T00:00:00Z'},future:{observedAt:'2027-01-01T00:00:00Z'},unknownDate:{observedAt:null},unavailable:{available:false},loyalty:{unconditional:false},currency:{currency:'USD'},unitPrice:{priceBasis:'kg'},noSource:{sourceUrl:null}})) {
 test(`reject invalid offer: ${name}`,()=>{const p=product('c','Καρότα','Φρέσκα Λαχανικά',{offers:[offer('sklavenitis',2,change)]});assert.equal(optimize([{query:'καρότα'}],catalog([p]),now).winner,null);});
}
test('integer cents and quantities',()=>{const p=product('c','Καρότα','Φρέσκα Λαχανικά',{offers:[offer('sklavenitis',1.11)]});assert.equal(optimize([{query:'καρότα',quantity:3}],catalog([p]),now).winner.totalCents,333);});
test('empty basket has no winner',()=>assert.equal(optimize([],catalog(fixtures),now).winner,null));
test('invalid quantity rejects basket',()=>assert.equal(optimize([{query:'καρότα',quantity:0}],catalog(fixtures),now).winner,null));
test('old snapshot rejected even with fresh offer',()=>assert.equal(optimize([{query:'καρότα'}],{...catalog(fixtures),generatedAt:'2026-07-12T00:00:00Z'},now).winner,null));
test('timezone and future timestamps fail closed',()=>{assert.equal(fresh('2026-09-22T09:00:00',now),false);assert.equal(fresh('2026-09-23T09:00:00Z',now),false);});
test('mirror cannot produce price rankings',()=>{const c=normalizeMirror({products:fixtures,generated_at:new Date(now).toISOString()});assert.equal(optimize([{query:'καρότα'}],c,now).winner,null);assert.deepEqual(c.products[0].offers,[]);});
test('authorized feed rejects missing permission and duplicate IDs',()=>{const d={schemaVersion:1,generatedAt:new Date().toISOString(),products:[fixtures[0],fixtures[0]]};assert.throws(()=>normalizeAuthorized(d,{}));assert.throws(()=>normalizeAuthorized(d,{permissionUrl:'https://example.org/permission'}));});
test('network failure does not poison retry and cache is diagnostics-only',async()=>{
 const data={products:fixtures,generated_at:'2026-07-12T00:00:00Z'};const storage={getItem:()=>JSON.stringify(data),setItem:()=>{}};
 const offline=await loadCatalog({fetcher:async()=>{throw Error('offline');},storage});assert.equal(offline.offline,true);assert.equal(offline.rankingAllowed,false);
 const online=await loadCatalog({fetcher:async url=>({ok:true,json:async()=>url.includes('providers.json')?{authorizedFeeds:[]}:data}),storage});assert.equal(online.offline,false);
});
test('authorized current feed integrates end-to-end',async()=>{
 const timestamp=new Date(Date.now()-1000).toISOString();
 const provider={name:'Authorized test fixture',url:'https://example.org/feed',permissionUrl:'https://example.org/permission'};
 const data={schemaVersion:1,generatedAt:timestamp,products:[product('a','Καρότα','Φρέσκα Λαχανικά',{offers:[offer('sklavenitis',1,{observedAt:timestamp})]})]};
 const c=await loadCatalog({storage:{},fetcher:async url=>({ok:true,json:async()=>url==='./providers.json'?{authorizedFeeds:[provider]}:data})});
 assert.equal(optimize([{query:'καρότα'}],c).winner.totalCents,100);
});
test('generic milk cannot match milk chocolate',()=>{
 const result=matchRequest('γάλα',[product('milk','Γάλα 1L','Γάλα'),product('chocolate','Σοκολάτα με Γάλα','Σοκολάτες')]);
 assert.deepEqual(result.candidates.map(p=>p.id),['milk']);
});
test('unclassified generic request requires explicit product selection',()=>{
 assert.equal(matchRequest('σοκολάτα',[product('c','Σοκολάτα','Σοκολάτες')]).status,'ambiguous');
});
