import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {matchRequest} from '../matcher.js';
import {normalizeMirror} from '../providers.js';
import {optimize} from '../optimizer.js';
const data=JSON.parse(readFileSync(process.argv[2],'utf8'));
const queries=['καρότα','αγγούρια','Γιαούρτι ΝΟΥΝΟΥ Εκλεκτό','ΝΟΥΝΟΥ Gouda 200g','ψωμί τοστ επώνυμο ≥600g'];
console.log('Source timestamp:',data.generated_at,'Products:',data.products.length);
for(const query of queries){const m=matchRequest(query,data.products);console.log(JSON.stringify({query,status:m.status,candidates:m.candidates.map(p=>({id:p.id,name:p.name}))}));}
assert.equal(optimize(queries.map(query=>({query})),normalizeMirror(data)).winner,null);
console.log('PASS: diagnostic mirror never yields a price winner.');
