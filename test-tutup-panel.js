'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),panel=require('./panel');const client=require('fs').readFileSync(require('path').join(__dirname,'panel-client.js'),'utf8');const html=panel.html({status:'Scan QR',version:'1.5.12-PRO',escapeHtml:x=>x});
test('Tombol tutup header',()=>assert.ok(html.includes('Tutup panel biru ini')));
test('LocalStorage untuk preferensi',()=>assert.ok(client.includes("localStorage.setItem('kospinTopClosed'")));
test('Membuka paksa saat QR diperlukan',()=>assert.ok(client.includes("if(document.body.classList.contains('topclosed'))toggleTop()")));
test('QR img tidak pakai src saat kosong',()=>assert.ok(html.includes('<img id="qr" alt="QR WhatsApp">')));
