'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('./lib'),fs=require('fs');
const source=fs.readFileSync(require('path').join(__dirname,'index.js'),'utf8');
test('Sinkron kode generator eksplisit',()=>assert.ok(source.includes("action:'updateStatus'")));
test('Disetujui hanya dari helper keputusan',()=>assert.ok(source.includes("syncGenerator(p,'DISETUJUI')")));
test('Ditolak di sheet generator',()=>assert.ok(source.includes("syncGenerator(p,'DITOLAK')")));
test('Kedaluwarsa tidak sync',()=>assert.ok(!/status='kedaluwarsa'[^}]*syncGenerator/.test(source)));
test('Code case upper',()=>assert.equal(L.extractKode('Kode: ures-0123'),'URES-0123'));
