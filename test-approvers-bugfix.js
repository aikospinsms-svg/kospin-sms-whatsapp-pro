'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {html}=require('./panel');const L=require('./lib');
const ROOT=__dirname;
const page=html({status:'Tes',version:L.VERSION,escapeHtml:String});
const client=fs.readFileSync(path.join(ROOT,'panel-client.js'),'utf8');

test('Semua id unik, khususnya bagian pengurus dan textarea pengurus',()=>{
 const ids=[...page.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids.filter((id,i)=>ids.indexOf(id)!==i),[]);
 assert.match(page,/<section id="approvers"/);
 assert.match(page,/<textarea id="approverNumbersInput"/);
});

test('Client menggunakan ID textarea pengurus yang benar',()=>{
 assert.match(client,/getElementById\('approverNumbersInput'\)\.value/);
 assert.doesNotMatch(client,/getElementById\('approvers'\)/);
});

test('Tombol simpan benar-benar mengirim nomor pengurus global, menjaga nomor per-grup ketika daftar grup belum tampil',async()=>{
 const script=client.slice(0,client.indexOf('\ntry{if(localStorage.getItem('));
 assert.ok(script.length>1000);
 let payload,notice='';
 const elements={approverNumbersInput:{value:'Pak Miji: 6281234567890\nPak Yuke: 6281234567891'},approverSaveStatus:{textContent:''}};
 const context=vm.createContext({
  document:{getElementById:id=>elements[id]??{value:'',checked:false},querySelectorAll:()=>[]},
  fetch:async(url,options)=>{if(url==='/config'&&options?.method==='POST'){payload=JSON.parse(options.body);return {ok:true,text:async()=>JSON.stringify({ok:true})}};throw Error('Unexpected request '+url)},
  alert:msg=>{notice=msg;},console,
 });
 vm.runInContext(script,context);
 vm.runInContext("config={approvers:[],groupApprovers:{'12345@g.us':[{name:'Pak Adi',number:'6281234567892'}]}}; reloadConfig=async()=>{config={approvers:[{name:'Pak Miji',number:'6281234567890'},{name:'Pak Yuke',number:'6281234567891'}],groupApprovers:{'12345@g.us':[{name:'Pak Adi',number:'6281234567892'}]}}};renderConfig=()=>{};refresh=async()=>{};",context);
 await vm.runInContext('saveApprovers()',context);
 assert.equal(payload.approvers,'Pak Miji: 6281234567890\nPak Yuke: 6281234567891');
 assert.equal(payload.groupApprovers['12345@g.us'],'Pak Adi: 6281234567892');
 assert.match(notice,/Global: 2, khusus grup: 1/);
 assert.match(elements.approverSaveStatus.textContent,/Tersimpan: 2 global, 1 per grup/);
});

test('Pengurus khusus grup terhitung meskipun global kosong',()=>{
 const cfg={approvers:[],groups:['a@g.us'],groupApprovers:{'a@g.us':[{name:'Pak Yuke',number:'6281234567891'}]}};
 assert.deepEqual(L.approverStats(cfg),{approvers:1,globalApprovers:0,missingApproverGroups:[]});
 assert.equal(L.lookupApprover(cfg,'a@g.us','6281234567891')?.name,'Pak Yuke');
});

test('Grup tanpa pengurus terdeteksi meskipun grup lain punya pengurus',()=>{
 const cfg={approvers:[],groups:['a@g.us','b@g.us'],groupApprovers:{'a@g.us':[{name:'Pak Yuke',number:'6281234567891'}]}};
 assert.deepEqual(L.approverStats(cfg).missingApproverGroups,['b@g.us']);
});

test('Nomor tak valid harus ditolak parser, bukan diakui tersimpan',()=>{
 assert.throws(()=>L.parseApprovers('Pak Contoh: 12345'),/tidak valid/);
});
