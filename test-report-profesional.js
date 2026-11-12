'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {report,csv,xlsx,humanDate,serial,COLS}=require('./report-export');
const {permissionFor}=require('./route-permissions');
const {html}=require('./panel');
const testData=[
 {id:'B',createdAt:Date.UTC(2026,10,12,3,6,55),groupName:'TEST GRUP',senderName:'Adam',senderNumber:'6280012345678',kode:'URES-00001',account:'01.101.008777',items:['1) Alat = Rp2.332.000'],total:2332000,status:'dikonfirmasi',decidedBy:'Pak Farid',decidedAt:Date.UTC(2026,10,12,3,8),paid:true,paidAt:Date.UTC(2026,10,12,4,15)},
 {id:'A',createdAt:Date.UTC(2026,10,11,3,6,55),groupName:'TEST GRUP',senderName:'Syifa',kode:'URES-00004',account:'01.101.00880',items:[],total:0,status:'dikonfirmasi',paid:false},
];
test('layout riwayat 15 kolom dan rekap 16 kolom',()=>{assert.equal(report(testData).columns.length,15);assert.equal(report(testData,'rekap').columns.length,16)});
test('WIB selalu tanggal jam zona Jakarta',()=>assert.equal(humanDate(testData[0].createdAt),'12/11/2026 10:06:55'));
test('data terbaru muncul paling atas',()=>assert.equal(report([...testData].reverse()).rows[0].kode,'URES-00001'));
test('DONE bukan dibayar',()=>{const r=report(testData);assert.equal(r.rows[1].status,'DONE');assert.equal(r.rows[1].payment,'BELUM DIBAYAR')});
test('nominal lama Rp0 tidak dikarang',()=>assert.match(report(testData).rows[1].note,/Periksa nominal/));
test('ringkasan approved dan paid tepat',()=>assert.deepEqual(report(testData).summary,{count:2,done:2,paid:1,totalApproved:2332000,nominalZero:1}));
test('CSV BOM dan delimiter Excel Indonesia',()=>assert.ok(csv(report(testData)).startsWith('\ufeffsep=;\r\n"No";')));
test('CSV rekening dan nomor HP sebagai teks dan kutip aman',()=>assert.ok(csv(report(testData)).includes("'6280012345678")));
test('CSV mencegah formula injection',()=>{const r=report([{...testData[0],senderName:'=HYPERLINK("x")'}]);assert.match(csv(r),/"'=HYPERLINK\(""x""\)"/)});
test('CSV semicolon dan baris baru di-escape',()=>{const r=report([{...testData[0],groupName:'A;\nB'}]);assert.ok(csv(r).includes('"A;\nB"'))});
test('XLSX adalah ZIP OOXML',()=>{const b=xlsx(report(testData));assert.equal(b.readUInt32LE(0),0x04034b50);assert.ok(b.length>2500)});
test('XLSX rekening diperlakukan sebagai teks dan total sebagai angka',()=>{const b=xlsx(report(testData));assert.ok(b.length>2500)});
test('tanggal serial Excel valid',()=>assert.ok(Math.abs(serial(testData[0].createdAt)-46338)<365));
test('Role report.export wajib bagi Excel dan CSV',()=>{for(const ext of ['csv','xlsx'])for(const type of ['history','rekap'])assert.equal(permissionFor('GET',`/laporan/${type}.${ext}`),'report.export')});
test('Dashboard memiliki tombol Excel dan CSV',()=>{const h=html({status:'Tes',version:'1.6.4',escapeHtml:x=>x});for(const path of ['/laporan/history.csv','/laporan/history.xlsx','/laporan/rekap.csv','/laporan/rekap.xlsx'])assert.ok(h.includes(path))});
test('Export tidak mengubah format internal 14 kolom untuk Google Sheets',()=>{const L=require('./lib');assert.equal(L.HEADERS.length,14)});
