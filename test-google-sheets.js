'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'index.js'),'utf8');
test('Google Sheets API sync',()=>assert.ok(src.includes("{action:'sync'")));
test('Apps Script 10 detik',()=>assert.ok(src.includes('AbortSignal.timeout(10000)')));
test('Tidak blok proses WA sync',()=>assert.ok(src.includes('queueSheetsSync()')));
test('Secret generator terpisah',()=>assert.ok(src.includes('cfg.generatorSecret')));
test('Secret rekap terpisah',()=>assert.ok(src.includes('cfg.sheetsSecret')));
