import {SOURCES,analyze,settings,validateObservations} from '../core.js';
const MAX_BYTES=3_000_000;
export function feedConfig(env) {
  const feeds=JSON.parse(env.AUTHORIZED_FEEDS||'[]');
  if(!Array.isArray(feeds)||feeds.length>20)throw Error('Invalid feed configuration');
  const ids=new Set();
  for(const f of feeds){
    if(!f.id||ids.has(f.id)||!SOURCES.some(s=>s.id===f.source)||typeof f.name!=='string'||f.authorized!==true)throw Error('Feed must have unique ID, source and explicit authorization');
    for(const key of ['url','permissionUrl']){const u=new URL(f[key]);if(u.protocol!=='https:'||u.username||u.password||u.port||!u.hostname.includes('.')||/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)||u.hostname.endsWith('.local')||u.hostname.endsWith('.internal'))throw Error('Invalid feed URL');}
    ids.add(f.id);
  }
  return feeds;
}
export async function readLimited(response,max=MAX_BYTES){
  if(Number(response.headers.get('content-length'))>max)throw Error('Response too large');
  const reader=response.body.getReader(),decoder=new TextDecoder();let text='',length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>max){await reader.cancel();throw Error('Response too large');}text+=decoder.decode(value,{stream:true});}
  return JSON.parse(text+decoder.decode());
}
export async function collect(env,selected=SOURCES.map(s=>s.id),query='',fetcher=fetch){
  const feeds=feedConfig(env).filter(f=>selected.includes(f.source));
  const results=await Promise.all(feeds.map(async f=>{
    try{
      // Only operator-configured, licensed JSON URLs. No browser-supplied URL fetches.
      const response=await fetcher(f.url,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error('Feed unavailable');
      const data=await readLimited(response);
      if(data.schemaVersion!==1||data.demo===true)throw Error('Invalid feed schema');
      const observations=validateObservations(data.observations).map(r=>{
        if(r.source!==f.source)throw Error('Feed source mismatch');
        return {...r,id:f.id+':'+r.id,provenance:{feedId:f.id,permissionUrl:f.permissionUrl}};
      });
      return {observations,status:{id:f.id,name:f.name,ok:true,note:`${observations.length} εγγραφές · η ηλικία τιμών ελέγχεται χωριστά`}};
    }catch{return {observations:[],status:{id:f.id,name:f.name,ok:false,note:'Μη διαθέσιμο ή μη έγκυρο feed. Δεν χρησιμοποιήθηκε παλιό αντίγραφο.'}};}
  }));
  const statuses=results.map(r=>r.status);
  for(const s of SOURCES.filter(s=>selected.includes(s.id)&&!feeds.some(f=>f.source===s.id)))statuses.push({id:s.id,name:s.name,ok:false,note:'Χωρίς εγκεκριμένο feed · μόνο χειροκίνητη καταχώριση'});
  // Return the full bounded catalog: filtering before matching can discard valuable comparables.
  return {observations:validateObservations(results.flatMap(r=>r.observations)),statuses,checkedAt:new Date().toISOString(),query};
}
export async function scheduledScan(env,now=Date.now(),fetcher=fetch){
  if(!env.SCANS)throw Error('SCANS KV binding is required');
  const config=JSON.parse(env.SCAN_SETTINGS||'{}'),s=settings(config.settings);
  const data=await collect(env,s.sources,config.query||'',fetcher);
  const result=analyze(data.observations,s,config.query||'',now);
  const opportunities=result.filter(r=>r.classification==='BUY'||r.classification==='WATCH');
  const previous=JSON.parse(await env.SCANS.get('opportunities')||'{}');
  const changes=[];const current={};
  for(const r of opportunities){
    const signature=JSON.stringify([r.classification,r.buy.price,r.resale,r.profit,r.confidence]);current[r.buy.id]=signature;
    if(previous[r.buy.id]!==signature)changes.push({id:r.buy.id,title:r.buy.title,url:r.buy.url,classification:r.classification,profit:r.profit,roi:r.roi,confidence:r.confidence,at:new Date(now).toISOString()});
  }
  // Preserve deduplication state during partial outages; do not create repeated alerts after recovery.
  const enabled=feedConfig(env).filter(f=>s.sources.includes(f.source));
  if(enabled.length&&data.statuses.filter(x=>enabled.some(f=>f.id===x.id)).every(x=>x.ok))await env.SCANS.put('opportunities',JSON.stringify(current));
  else await env.SCANS.put('opportunities',JSON.stringify({...previous,...current}));
  const history=JSON.parse(await env.SCANS.get('alerts')||'[]');
  if(changes.length)await env.SCANS.put('alerts',JSON.stringify([...changes,...history].slice(0,200)));
  await env.SCANS.put('last-scan',JSON.stringify({at:new Date(now).toISOString(),opportunities:opportunities.length,statuses:data.statuses}));
  return changes;
}
function response(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type'}});}
export async function handle(request,env){
  const origin=env.ALLOWED_ORIGIN||'https://labispe89.github.io';
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==origin)return response({error:'Origin not allowed'},403,origin);
  if(request.method==='OPTIONS')return response({},200,origin);
  if(!env.SCANNER_TOKEN||env.SCANNER_TOKEN.length<24)return response({error:'Backend is not configured'},503,origin);
  if(request.headers.get('Authorization')!=='Bearer '+env.SCANNER_TOKEN)return response({error:'Unauthorized'},401,origin);
  const url=new URL(request.url);
  try{
    if(url.pathname==='/alerts'&&request.method==='GET'){
      if(!env.SCANS)return response({error:'Storage is not configured'},503,origin);
      return response({alerts:JSON.parse(await env.SCANS.get('alerts')||'[]'),lastScan:JSON.parse(await env.SCANS.get('last-scan')||'null')},200,origin);
    }
    if(url.pathname!=='/scan'||request.method!=='POST')return response({error:'Not found'},404,origin);
    // Request cannot choose remote endpoints, credentials, or server thresholds.
    const body=await readLimited(request,10000);
    if(typeof body.query!=='string'||body.query.length>250||!Array.isArray(body.sources)||body.sources.some(s=>!SOURCES.some(x=>x.id===s)))return response({error:'Invalid search'},400,origin);
    return response(await collect(env,body.sources,body.query),200,origin);
  }catch{return response({error:'Invalid request or feed configuration'},400,origin);}
}
export function isScheduledHour(env,time){return !env.SCAN_HOUR_ATHENS||new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Athens',hour:'2-digit',hourCycle:'h23'}).format(new Date(time))===env.SCAN_HOUR_ATHENS;}
export default {fetch:handle,async scheduled(event,env,ctx){if(isScheduledHour(env,event.scheduledTime))ctx.waitUntil(scheduledScan(env,event.scheduledTime));}};
