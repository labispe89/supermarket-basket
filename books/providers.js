import {SOURCES,validateObservations} from './core.js';
export function sourceStatus() {
  return SOURCES.map(s=>({...s,status:'manual',note:'Χειροκίνητη καταχώριση / εισαγωγή. Δεν έχει ενεργοποιηθεί εγκεκριμένο API τιμών.'}));
}
export async function scanRemote(base,token,query,sources,fetcher=fetch) {
  const url=new URL(base);
  if(url.protocol!=='https:'&&url.hostname!=='localhost'&&url.hostname!=='127.0.0.1') throw Error('Η σύνδεση απαιτεί HTTPS.');
  url.pathname=url.pathname.replace(/\/$/,'')+'/scan';url.search='';url.hash='';
  const response=await fetcher(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},body:JSON.stringify({query,sources}),signal:AbortSignal.timeout(25000),cache:'no-store'});
  if(!response.ok) throw Error(`Η σύνδεση επέστρεψε ${response.status}. Ελέγξτε URL και κλειδί πρόσβασης.`);
  const data=await response.json();
  return {...data,observations:validateObservations(data.observations)};
}
