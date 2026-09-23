import {isbn} from './core.js';

const CACHE_KEY='book-metadata-openlibrary-v3';
const API='https://openlibrary.org/search.json';

export function normalizeOpenLibrary(data,requestedIsbn) {
  const requested=isbn(requestedIsbn);
  if(!requested||!Array.isArray(data?.docs))return null;
  const row=data.docs.find(value=>Array.isArray(value.isbn)&&value.isbn.some(candidate=>isbn(candidate)===requested));
  if(!row?.title)return null;
  const edition=row.editions?.docs?.find(value=>Array.isArray(value.isbn)&&value.isbn.some(candidate=>isbn(candidate)===requested));
  return {
    isbn:requested,
    title:String(row.title).trim(),
    author:Array.isArray(row.author_name)?row.author_name.filter(Boolean).join(', '):'',
    publisher:Array.isArray(edition?.publisher)?String(edition.publisher[0]||'').trim():'',
    source:'Open Library',
    sourceUrl:`https://openlibrary.org/isbn/${requested}`,
    retrievedAt:new Date().toISOString()
  };
}

function readCache(storage){try{return JSON.parse(storage?.getItem(CACHE_KEY)||'{}');}catch{return {};}}
function writeCache(storage,cache){try{storage?.setItem(CACHE_KEY,JSON.stringify(cache));}catch{/* disabled/quota */}}

export async function lookupOpenLibrary(value,{fetcher=fetch,storage=globalThis.localStorage,now=Date.now()}={}) {
  const normalized=isbn(value);if(!normalized)throw Error('Γράψε πρώτα ένα έγκυρο ISBN.');
  const cache=readCache(storage),hit=cache[normalized];
  if(hit&&now-Date.parse(hit.cachedAt)<30*86400000)return {...hit.value,cached:true};
  const url=new URL(API);url.searchParams.set('isbn',normalized);url.searchParams.set('fields','title,author_name,isbn,editions');url.searchParams.set('limit','5');
  const response=await fetcher(url,{headers:{Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error(`Η Open Library δεν απάντησε (${response.status}).`);
  const valueOut=normalizeOpenLibrary(await response.json(),normalized);
  if(!valueOut)throw Error('Δεν βρέθηκε αυτή η έκδοση στην Open Library.');
  cache[normalized]={cachedAt:new Date(now).toISOString(),value:valueOut};writeCache(storage,cache);
  return {...valueOut,cached:false};
}

