'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),L=require('./lib');
const base={id:'test',createdAt:Date.now(),group:'abc@g.us',status:'menunggu',items:['x'],total:1000};
test('Status DONE dari approval',()=>assert.equal(L.statusDisplay({...base,status:'dikonfirmasi'}),'DONE'));
test('Status ditolak',()=>assert.equal(L.statusDisplay({...base,status:'ditolak'}),'DITOLAK'));
test('Status kadaluarsa',()=>assert.equal(L.statusDisplay({...base,status:'kedaluwarsa'}),'KEDALUWARSA'));
test('Riwayat menunggu',()=>assert.match(L.historyLine(base),/MENUNGGU/));
test('Riwayat berhasil',()=>assert.match(L.historyLine({...base,status:'dikonfirmasi'}),/DIKONFIRMASI/));
test('Riwayat ditolak',()=>assert.match(L.historyLine({...base,status:'ditolak'}),/DITOLAK/));
test('Riwayat kadaluarsa',()=>assert.match(L.historyLine({...base,status:'kedaluwarsa'}),/KEDALUWARSA/));
