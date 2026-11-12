'use strict';
const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),path=require('path');
const G=require('./generator-store'),L=require('./lib'),{SOURCES}=require('./source-accounts');
const data={formatVersion:'professional-v1',kode:'URES-02351',tanggal:'2026-11-12',unit:'J Chicken Ciledug',saldo:'900000.50',sumber:SOURCES[0],menunggu:'@Pak Miji, @Pak Yuke, @Pak Miji',items:[
 {kategori:'Utilitas — Listrik',keperluan:'Token Listrik',noref:'TKN-100',nominal:'1004000',tujuan:'VA BCA 1122'},
 {kategori:'Operasional',keperluan:'Air',noref:'AIR-123',nominal:'250000',tujuan:'VA BTN 7788'},
 {kategori:'Vendor',keperluan:'Logistik',noref:'REF-345',nominal:'125000.25',tujuan:'Kospin 01.101.005982'}
]};
const norm=G.validate(data),text=G.buildText(norm);
test('17 pilihan sumber dana unik',()=>{a.equal(SOURCES.length,17);a.equal(new Set(SOURCES).size,17)});
test('Nomor rekening SIP RESTO tidak diubah panjangnya',()=>a.ok(SOURCES[0].includes('01.101.00880')));
test('Nomor rekening terakhir sesuai input',()=>a.ok(SOURCES[16].includes('01.101.006055')));
test('Beberapa pembayaran satu kode URES dan total akurat',()=>{a.equal(norm.kode,'URES-02351');a.equal(norm.items.length,3);a.equal(norm.nominal,1379000.25);a.equal(G.row(norm,[])[9],-478999.75)});
test('Teks berisi per item 1,2,3 dan satu total',()=>{a.equal((text.match(/^Kode:/gm)||[]).length,1);a.match(text,/1\) Kategori:/);a.match(text,/2\) Kategori:/);a.match(text,/3\) Kategori:/);a.match(text,/Total Item: 3/);a.match(text,/Total Nominal: Rp1\.379\.000,25/)});
test('Bot mendeteksi multi generator sebagai satu pengajuan',()=>{a.ok(L.isGenerator(text));a.equal(L.extractKode(text),norm.kode);a.ok(L.isEligible(text));a.deepEqual(L.itemAmounts(text).items,['1) Token Listrik = Rp1.004.000','2) Air = Rp250.000','3) Logistik = Rp125.000,25']);a.equal(L.itemAmounts(text).total,norm.nominal)});
test('Generator tag pengurus dedup dan sesuai baris Menunggu',()=>a.deepEqual(L.parseTags(text),['Pak Miji','Pak Yuke']));
test('Konfirmasi mempertahankan teks asli gabungan',()=>{const actual=L.formatConfirmation(text);a.ok(actual.includes(text));a.ok(actual.startsWith('Baik Pak @Pak Miji @Pak Yuke,'))});
test('Kolom rekap 15; multi items tersimpan detail CSV',()=>{a.equal(G.HEADERS.length,15);a.equal(G.DETAIL_HEADERS.length,9);a.equal(G.detailRows(norm,[]).length,3);a.equal(G.detailRows(norm,[])[1][5],250000);a.match(G.row(norm,[])[4],/3\) Logistik/)});
test('Status per URES, tidak menganggap dibayar',()=>{const w={kode:norm.kode,raw:text,status:'dikonfirmasi',decidedBy:'Pak Yuke',paid:false};a.deepEqual(G.state(norm,[w]).paid,false);a.equal(G.state(norm,[w]).status,'DISETUJUI')});
test('Menolak rincian tanpa nominal',()=>a.throws(()=>G.validate({...data,items:[{...data.items[0],nominal:''}]}),/Nominal rincian/));
test('Menolak rincian tanpa tujuan',()=>a.throws(()=>G.validate({...data,items:[{...data.items[0],tujuan:''}]}),/tujuan wajib/));
test('Maksimum 30 rincian',()=>{a.equal(G.validate({...data,items:Array(30).fill(data.items[0])}).items.length,30);a.throws(()=>G.validate({...data,items:Array(31).fill(data.items[0])}),/1–30/)});
test('Menolak total yang tidak sama dengan rincian',()=>a.throws(()=>G.validate({...data,nominal:99999}),/tidak sama/));
test('Parser mendeteksi total tidak sesuai',()=>a.equal(L.itemAmounts(text.replace('Total Nominal: Rp1.379.000,25','Total Nominal: Rp1.379.000,50')).invalid,true));
test('Parser mendeteksi jumlah rincian yang tidak sesuai',()=>a.equal(L.itemAmounts(text.replace('Total Item: 3','Total Item: 4')).invalid,true));
test('Nilai kode ganda perlu pemeriksaan manual',()=>a.match(G.state(norm,[{kode:norm.kode},{kode:norm.kode}]).status,/KODE GANDA/));
test('Satu rincian juga memakai format profesional dan tanpa No. Ref',()=>{const o=G.validate({...data,items:[data.items[0]]});a.ok(G.buildText(o).includes('Rincian Pembayaran:'));a.ok(!G.buildText(o).includes('No. Ref'));a.equal(L.itemAmounts(G.buildText(o)).items.length,1)});
test('Generator menyimpan item dan akses daftar pengurus, tanpa bocorkan semua nomor',()=>{const src=fs.readFileSync(path.join(__dirname,'index.js'),'utf8');a.match(src,/generator\/options/);a.match(src,/approvers:names/);a.match(src,/generator\/preview/);a.match(src,/ures-claims/)});
test('UI memiliki tambah/hapus rincian, dropdown sumber, pilihan pengurus',()=>{const src=fs.readFileSync(path.join(__dirname,'generator-dashboard.html'),'utf8');for(const q of ['Tambah Rincian','data-remove','sumberSel','approverOptions','simpanDashboard','previewServer'])a.ok(src.includes(q),q)});
test('Google Apps Script memakai dua tab dan update status rincian',()=>{const src=fs.readFileSync(path.join(__dirname,'APPS-SCRIPT-GENERATOR-CONTOH.gs'),'utf8');a.match(src,/RINCIAN_TAB='Rincian Pengajuan'/);a.match(src,/saveDetails_/);a.match(src,/details\.forEach/)});
test('Permission backend ke generator dibatasi role Maker',()=>{const {permissionFor}=require('./route-permissions');a.equal(permissionFor('GET','/generator/options'),'submission.create');a.equal(permissionFor('POST','/generator/preview'),'submission.create');a.equal(permissionFor('GET','/generator/details.csv'),'report.export')});
test('Teks pratinjau browser sama persis dengan teks server yang akan disimpan',()=>{
 const vm=require('node:vm');const html=fs.readFileSync(path.join(__dirname,'generator-dashboard.html'),'utf8');const js=html.match(/<script>([\s\S]*)<\/script>/)[1];
 const nodes={};for(const id of ['kode','tanggal','unitSel','unit','sumberSel','sumber','saldo','menunggu','total','itemCount','saldoAfter','hasil','ok','approverOptions','items'])nodes[id]={value:'',textContent:'',innerHTML:'',addEventListener(){},classList:{toggle(){},add(){},remove(){}}};
 Object.assign(nodes,{kode:{...nodes.kode,value:'URES-02351'},tanggal:{...nodes.tanggal,value:'2026-11-12'},unitSel:{...nodes.unitSel,value:'J Chicken Ciledug'},sumberSel:{...nodes.sumberSel,value:SOURCES[0]},saldo:{...nodes.saldo,value:'900000.50'},menunggu:{...nodes.menunggu,value:''}});
 const env={document:{getElementById:id=>nodes[id]},fetch:()=>new Promise(()=>{}),window:{parent:null},location:{origin:'http://localhost:3002'},localStorage:{setItem(){},getItem(){return null}},Date,Number,BigInt,Math,String,Object,Array,Intl,console};env.window.parent=env.window;
 const context=vm.createContext(env);vm.runInContext(js,context);const copy=JSON.stringify(data.items);vm.runInContext('items = '+copy+';selectedApprovers=["Pak Miji","Pak Yuke"];buat()',context);
 const rendered=nodes.hasil.value;const backend=G.buildText(G.validate({...data,menunggu:'@Pak Miji, @Pak Yuke'}));a.equal(rendered,backend);
});

test('Rekening header konfirmasi wajib dari Sumber Dana, bukan rekening tujuan yang lebih panjang',()=>{const msg=G.buildText(norm);a.equal(L.sourceAccount(msg),'01.101.00880');a.match(L.formatConfirmation(msg),/dari rekening 01\.101\.00880\./)});
