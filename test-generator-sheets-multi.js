'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),G=require('./generator-store');
const {SOURCES}=require('./source-accounts');
class Range{
 constructor(s,r,c,h=1,w=1){Object.assign(this,{s,r,c,h,w})}
 getDisplayValues(){return Array.from({length:this.h},(_,i)=>Array.from({length:this.w},(_,j)=>{const v=this.s.rows[this.r-1+i]?.[this.c-1+j];return v===undefined||v===null?'':String(v)}))}
 getDisplayValue(){return this.getDisplayValues()[0][0]}
 getValue(){return this.s.rows[this.r-1]?.[this.c-1]??''}
 setValues(matrix){for(let i=0;i<matrix.length;i++){const r=this.r-1+i;this.s.rows[r]=this.s.rows[r]||[];for(let j=0;j<matrix[i].length;j++)this.s.rows[r][this.c-1+j]=matrix[i][j]}return this}
 setValue(v){return this.setValues([[v]])}
 setNumberFormat(){return this}
}
class Sheet{
 constructor(name){this.name=name;this.rows=[]}
 getRange(r,c,h=1,w=1){return new Range(this,r,c,h,w)}
 getLastRow(){return this.rows.length}
 getLastColumn(){return this.rows.reduce((n,r)=>Math.max(n,r.length),0)}
 setFrozenRows(){return this}
 deleteRow(n){this.rows.splice(n-1,1)}
}
function makeScript(){const sheets=new Map,ss={getSheetByName(name){return sheets.get(name)||null},insertSheet(name){const sh=new Sheet(name);sheets.set(name,sh);return sh}};const ctx=vm.createContext({SpreadsheetApp:{getActiveSpreadsheet(){return ss}},console,Date,Number,Math,String,Object,Array,JSON});vm.runInContext(fs.readFileSync('APPS-SCRIPT-GENERATOR-CONTOH.gs','utf8'),ctx);return {ctx,sheets}}
const entry=G.validate({kode:'URES-01722',tanggal:'2026-11-12',unit:'J Chicken Omega',saldo:'1000000',sumber:SOURCES[1],menunggu:'@Pak Miji',items:[{kategori:'Utilitas',keperluan:'Listrik',noref:'A1',nominal:250000,tujuan:'VA 1'},{kategori:'Vendor',keperluan:'Suplai',noref:'B2',nominal:120000,tujuan:'VA 2'}]});
const record={...entry,teks:G.buildText(entry)};
test('Apps Script membuat satu baris master dua baris rincian, update serentak',()=>{const s=makeScript();const ret=vm.runInContext('upsertPengajuan_('+JSON.stringify(record)+')',s.ctx);assert.equal(ret.ok,true);assert.equal(ret.jumlahItem,2);const master=s.sheets.get('Pengajuan').rows,detail=s.sheets.get('Rincian Pengajuan').rows;assert.equal(master.length,2);assert.equal(detail.length,3);assert.equal(master[1][6],370000);assert.deepEqual(detail.slice(1).map(r=>r[5]),[250000,120000]);vm.runInContext("updateStatus_({kode:'URES-01722',status:'DISETUJUI',disetujuiOleh:'Pak Miji'})",s.ctx);assert.equal(master[1][11],'DISETUJUI');assert.equal(detail[1][8],'DISETUJUI');assert.equal(detail[2][8],'DISETUJUI');});
test('Apps Script memperbarui rincian draft tanpa membuat baris URES ganda',()=>{const s=makeScript();vm.runInContext('upsertPengajuan_('+JSON.stringify(record)+')',s.ctx);const changed=G.validate({...record,nominal:300000,items:[{kategori:'Baru',keperluan:'Operasional',noref:'C3',nominal:300000,tujuan:'VA 3'}]});vm.runInContext('upsertPengajuan_('+JSON.stringify({...changed,teks:G.buildText(changed)})+')',s.ctx);assert.equal(s.sheets.get('Pengajuan').rows.length,2);assert.equal(s.sheets.get('Rincian Pengajuan').rows.length,2);assert.equal(s.sheets.get('Pengajuan').rows[1][6],300000);});
test('Apps Script menolak ubah rincian setelah persetujuan',()=>{const s=makeScript();vm.runInContext('upsertPengajuan_('+JSON.stringify(record)+')',s.ctx);vm.runInContext("updateStatus_({kode:'URES-01722',status:'DISETUJUI',disetujuiOleh:'Pak Miji'})",s.ctx);const altered={...record,teks:record.teks+'\nubah',nominal:370000};assert.throws(()=>vm.runInContext('upsertPengajuan_('+JSON.stringify(altered)+')',s.ctx),/tidak boleh diubah/)});
