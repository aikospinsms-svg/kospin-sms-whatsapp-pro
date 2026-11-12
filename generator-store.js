'use strict';
// One URES = one WhatsApp submission containing 1..30 itemized payments.
// Older records without `items` remain readable and keep their original message format.
const HEADERS=['Tanggal','Kode','Unit','Kategori','Keperluan','No. Ref','Nominal','Sumber Dana','Saldo Sebelum','Saldo Sesudah','Tujuan','Status','Disetujui Oleh','Menunggu Persetujuan','Teks WhatsApp (Copy)'];
const COLS=['tanggal','kode','unit','kategori','keperluan','noref','nominal','saldo','sumber','tujuan','menunggu','items','formatVersion'];
const ITEM_COLS=['kategori','keperluan','noref','nominal','tujuan'];
function normalizeText(text){return String(text??'').replace(/\r\n?/g,'\n').split('\n').map(x=>x.trimEnd()).join('\n').trim()}
const DETAIL_HEADERS=['Kode','No. Item','Kategori','Keperluan','No. Ref','Nominal','Tujuan','Sumber Dana','Status'];
function fmt(value,decimals=0){return Number(value).toLocaleString('id-ID',{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}
function clean(v,max=250){return String(v??'').trim().slice(0,max)}
function money(v,label){if(v===undefined||v===null||String(v).trim()==='')throw Error(label+' wajib diisi');const n=Number(v);if(!Number.isFinite(n)||n<=0||n>1e15)throw Error(label+' harus lebih dari nol');return Math.round(n*100)/100}
function itemList(entry){if(Array.isArray(entry.items)&&entry.items.length)return entry.items;return [{kategori:entry.kategori||'',keperluan:entry.keperluan||'',noref:entry.noref||'',nominal:entry.nominal,tujuan:entry.tujuan||''}]}
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Data generator tidak valid');
 const o={};for(const k of COLS.filter(x=>x!=='items'))o[k]=k==='nominal'||k==='saldo'?input[k]:clean(input[k],k==='keperluan'||k==='tujuan'?500:250);
 if(!['','professional-v1'].includes(o.formatVersion))throw Error('Versi format generator tidak dikenali');
 o.kode=o.kode.toUpperCase();
 if(!/^URES-\d{1,12}$/.test(o.kode))throw Error('Kode wajib berformat URES-01458');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(o.tanggal)||!Number.isFinite(Date.parse(o.tanggal+'T12:00:00Z'))||new Date(o.tanggal+'T12:00:00Z').toISOString().slice(0,10)!==o.tanggal)throw Error('Tanggal tidak valid');
 if(!o.unit||!o.sumber)throw Error('Unit dan sumber dana wajib diisi');
 if(o.saldo===undefined||o.saldo===null||String(o.saldo).trim()==='')throw Error('Saldo Sebelum wajib diisi');
 o.saldo=Number(o.saldo);if(!Number.isFinite(o.saldo)||o.saldo<0||o.saldo>1e15)throw Error('Saldo Sebelum harus angka tidak negatif');o.saldo=Math.round(o.saldo*100)/100;
 if(input.items!==undefined&&(!Array.isArray(input.items)||input.items.length<1||input.items.length>30))throw Error('Rincian pembayaran harus berisi 1–30 item');
 const rows=input.items===undefined?[{kategori:o.kategori,keperluan:o.keperluan,noref:o.noref,nominal:o.nominal,tujuan:o.tujuan}]:input.items;
 o.items=rows.map((x,i)=>{if(!x||typeof x!=='object'||Array.isArray(x))throw Error('Rincian #'+(i+1)+' tidak valid');const item={};for(const k of ITEM_COLS)item[k]=k==='nominal'?money(x[k],input.items===undefined?'Nominal':'Nominal rincian #'+(i+1)):clean(x[k],k==='keperluan'||k==='tujuan'?500:250);if(!item.keperluan||!item.tujuan)throw Error('Rincian #'+(i+1)+': keperluan dan tujuan wajib diisi');return item});
 // Format profesional tidak menerima No. Ref/Token, termasuk dari draft lama.
 if(o.formatVersion==='professional-v1'){o.noref='';o.items.forEach(it=>{it.noref=''})}
 const sum=Math.round(o.items.reduce((n,it)=>n+it.nominal,0)*100)/100;
 if(input.items!==undefined&&o.nominal!==undefined&&o.nominal!==null&&String(o.nominal).trim()!==''&&Math.abs(Number(o.nominal)-sum)>.005)throw Error('Total nominal tidak sama dengan penjumlahan rincian');
 o.nominal=sum;
 // Backward compatible summary fields, also used as the original 15-column sheet data.
 if(o.items.length===1){Object.assign(o,{kategori:o.items[0].kategori,keperluan:o.items[0].keperluan,noref:o.items[0].noref,tujuan:o.items[0].tujuan})}
 else{Object.assign(o,{kategori:'MULTI ('+o.items.length+' rincian)',keperluan:o.items.map((it,i)=>(i+1)+') '+it.keperluan).join('\n'),noref:o.formatVersion==='professional-v1'?'':o.items.map((it,i)=>(i+1)+') '+it.noref).join('\n'),tujuan:o.items.map((it,i)=>(i+1)+') '+it.tujuan).join('\n')})}
 o.menunggu=clean(input.menunggu,250);
 return o;
}
function buildLegacyText(o){
 const t=o.tanggal.split('-'),decimals=Number(o.saldo)%1===0?0:2,items=itemList(o);
 if(items.length===1){const it=items[0];return 'PENGAJUAN PEMBAYARAN\n'+
 `Kode: ${o.kode}\nTanggal: ${t[2]}/${t[1]}/${t[0]}\nUnit: ${o.unit}\nKategori: ${it.kategori}\nKeperluan: ${it.keperluan}\nNo. Ref/Token: ${it.noref}\nNominal: Rp${fmt(it.nominal,2).replace(/,00$/,'')}\nSumber Dana: ${o.sumber}\nSaldo Sebelum: Rp${fmt(o.saldo,decimals)}\nTujuan: ${it.tujuan}\nMenunggu: ${o.menunggu}`;}
 const detail=items.map((it,i)=>`${i+1}) Kategori: ${it.kategori}\n   Keperluan: ${it.keperluan}\n   No. Ref/Token: ${it.noref}\n   Nominal: Rp${fmt(it.nominal,2).replace(/,00$/,'')}\n   Tujuan: ${it.tujuan}`).join('\n');
 return `PENGAJUAN PEMBAYARAN\nKode: ${o.kode}\nTanggal: ${t[2]}/${t[1]}/${t[0]}\nUnit: ${o.unit}\nSumber Dana: ${o.sumber}\nSaldo Sebelum: Rp${fmt(o.saldo,decimals)}\nRincian Pembayaran:\n${detail}\nTotal Item: ${items.length}\nTotal Nominal: Rp${fmt(o.nominal,2).replace(/,00$/,'')}\nMenunggu: ${o.menunggu}`;
}
function buildProfessionalText(o){
 const t=o.tanggal.split('-'),items=itemList(o),decimals=Number(o.saldo)%1===0?0:2;
 const after=Math.round((o.saldo-o.nominal)*100)/100;
 const details=items.map((it,i)=>`${i+1}) Kategori: ${it.kategori}\n   Keperluan: ${it.keperluan}\n   Tujuan: ${it.tujuan}\n   Nominal: Rp${fmt(it.nominal,2).replace(/,00$/,'')}`).join('\n\n');
 return `PENGAJUAN PEMBAYARAN
Kode: ${o.kode}
Tanggal: ${t[2]}/${t[1]}/${t[0]}
Unit: ${o.unit}

Yth. Bapak/Ibu Pengurus,
Dengan hormat, kami mengajukan permohonan persetujuan pembayaran dengan rincian berikut:

Sumber Dana: ${o.sumber}
Saldo Sebelum: Rp${fmt(o.saldo,decimals)}

Rincian Pembayaran:
${details}

Total Item: ${items.length}
Total Nominal: Rp${fmt(o.nominal,2).replace(/,00$/,'')}
Estimasi Saldo Sesudah: Rp${fmt(after,2).replace(/,00$/,'')}

Menunggu: ${o.menunggu}

Mohon persetujuan Bapak/Ibu agar pengajuan ini dapat ditindaklanjuti sesuai prosedur.
Terima kasih atas perhatian dan kerja samanya.`;
}
function buildText(o){return o.formatVersion==='professional-v1'?buildProfessionalText(o):buildLegacyText(o)}
function matchedCode(entry,waRecords){return waRecords.filter(p=>p.kode===entry.kode)}
function state(entry,waRecords){const m=matchedCode(entry,waRecords);if(m.length>1)return {status:'KODE GANDA — PERIKSA',by:'',paid:false,waDetected:true};if(!m.length)return {status:'BELUM TERDETEKSI WA',by:'',paid:false,waDetected:false};const p=m[0];if(p.raw&&normalizeText(p.raw)!==normalizeText(buildText(entry)))return {status:'DATA WA BERBEDA — PERIKSA',by:'',paid:false,waDetected:true};return {status:({menunggu:'MENUNGGU',dikonfirmasi:'DISETUJUI',ditolak:'DITOLAK',kedaluwarsa:'KEDALUWARSA'})[p.status]||'PERIKSA',by:p.decidedBy||'',paid:!!p.paid,waDetected:true};}
function row(entry,waRecords){const s=state(entry,waRecords);return [entry.tanggal,entry.kode,entry.unit,entry.kategori,entry.keperluan,entry.noref,entry.nominal,entry.sumber,entry.saldo,Math.round((entry.saldo-entry.nominal)*100)/100,entry.tujuan,s.status,s.by,entry.menunggu,buildText(entry)];}
function summary(entries,waRecords,day){const today=entries.filter(x=>x.tanggal===day);const states=entries.map(x=>({entry:x,state:state(x,waRecords)}));return {totalEntries:entries.length,hariIni:today.length,nominalHariIni:today.reduce((a,x)=>a+x.nominal,0),disetujui:states.filter(x=>x.state.status==='DISETUJUI').length,nominalDisetujui:states.filter(x=>x.state.status==='DISETUJUI').reduce((a,x)=>a+x.entry.nominal,0),menunggu:states.filter(x=>x.state.status==='MENUNGGU').length,belumTerpantau:states.filter(x=>x.state.status==='BELUM TERDETEKSI WA').length,ditolak:states.filter(x=>x.state.status==='DITOLAK').length,kedaluwarsa:states.filter(x=>x.state.status==='KEDALUWARSA').length};}
function detailRows(entry,waRecords){const status=state(entry,waRecords).status;return itemList(entry).map((it,i)=>[entry.kode,i+1,it.kategori,it.keperluan,it.noref,it.nominal,it.tujuan,entry.sumber,status]);}
module.exports={normalizeText,HEADERS,DETAIL_HEADERS,COLS,ITEM_COLS,validate,itemList,buildText,row,detailRows,state,summary,matchedCode};
