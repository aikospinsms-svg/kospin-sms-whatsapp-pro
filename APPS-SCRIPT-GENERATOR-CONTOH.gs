/**
 * KOSPIN SMS - Sheet Generator v1.6.1 (satu URES, banyak rincian).
 * Dua tab: Pengajuan (15 kolom lama, 1 baris/URES) dan Rincian Pengajuan (1 baris/item).
 * Deploy ulang versi Apps Script setelah memperbarui kode ini dan backup sheet lama.
 * Apps Script Web App harus terlindungi dengan SECRET yang kuat; URL jangan dipublikasikan.
 */
const SECRET_GENERATOR='GANTI_SECRET_GENERATOR_BERBEDA';
const GENERATOR_TAB='Pengajuan';
const RINCIAN_TAB='Rincian Pengajuan';
const COLS=['Tanggal','Kode','Unit','Kategori','Keperluan','No. Ref','Nominal','Sumber Dana','Saldo Sebelum','Saldo Sesudah','Tujuan','Status','Disetujui Oleh','Menunggu Persetujuan','Teks WhatsApp (Copy)'];
const DETAIL_COLS=['Kode','No. Item','Kategori','Keperluan','No. Ref','Nominal','Tujuan','Sumber Dana','Status'];
function json_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function doGet(e){return json_({ok:true,service:'Generator Kospin SMS',version:'1.6.1',health:'ready'})}
function doPost(e){
 const lock=LockService.getScriptLock();let acquired=false;
 try{
  const req=JSON.parse((e.postData||{}).contents||'{}');
  if(SECRET_GENERATOR.startsWith('GANTI_')||req.secret!==SECRET_GENERATOR)throw Error('SECRET salah atau belum dikonfigurasi');
  acquired=lock.tryLock(10000);if(!acquired)throw Error('Spreadsheet sedang sibuk');
  if(req.action==='upsertPengajuan')return json_(upsertPengajuan_(req.entry||{}));
  if(req.action==='updateStatus')return json_(updateStatus_(req));
  throw Error('Action tidak dikenal');
 }catch(err){return json_({ok:false,error:String(err.message||err)})}
 finally{if(acquired)lock.releaseLock()}
}
function mapSheet_(name,headers){
 const ss=SpreadsheetApp.getActiveSpreadsheet();let sh=ss.getSheetByName(name);
 if(!sh){sh=ss.insertSheet(name);sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1)}
 const got=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getDisplayValues()[0],map={};
 got.forEach((v,i)=>{map[String(v).toLowerCase().trim()]=i+1});
 headers.forEach(h=>{if(!map[h.toLowerCase()])throw Error('Kolom '+h+' tidak ditemukan pada '+name)});
 return {sh,map};
}
function rowsByCode_(sh,map,kode){const n=sh.getLastRow();if(n<2)return [];return sh.getRange(2,map['kode'],n-1,1).getDisplayValues().map((r,i)=>String(r[0]).trim().toUpperCase()===kode?i+2:null).filter(Boolean)}
function valueSafe_(v){return typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v}
function detailItems_(entry){
 const src=Array.isArray(entry.items)&&entry.items.length?entry.items:[{kategori:entry.kategori,keperluan:entry.keperluan,noref:entry.noref,nominal:entry.nominal,tujuan:entry.tujuan}];
 if(!src.length||src.length>30)throw Error('Rincian harus 1 sampai 30 item');
 return src.map((it,i)=>{const nom=Number(it.nominal);if(!Number.isFinite(nom)||nom<=0||!String(it.keperluan||'').trim()||!String(it.tujuan||'').trim())throw Error('Rincian '+(i+1)+' tidak lengkap');return {kategori:String(it.kategori||''),keperluan:String(it.keperluan),noref:String(it.noref||''),nominal:nom,tujuan:String(it.tujuan)}});
}
function saveDetails_(entry,items,status){
 const {sh,map}=mapSheet_(RINCIAN_TAB,DETAIL_COLS),previous=rowsByCode_(sh,map,entry.kode);
 previous.reverse().forEach(r=>sh.deleteRow(r));
 const rows=items.map((it,i)=>({Kode:entry.kode,'No. Item':i+1,Kategori:it.kategori,Keperluan:it.keperluan,'No. Ref':it.noref,Nominal:it.nominal,Tujuan:it.tujuan,'Sumber Dana':entry.sumber,Status:status}));
 const width=sh.getLastColumn();const values=rows.map(r=>{const out=new Array(width).fill('');Object.keys(r).forEach(k=>out[map[k.toLowerCase()]-1]=valueSafe_(r[k]));return out});
 const row=sh.getLastRow()+1;sh.getRange(row,1,values.length,width).setValues(values);
 sh.getRange(row,map['nominal'],values.length,1).setNumberFormat('#,##0.00');
 sh.getRange(row,map['no. ref'],values.length,1).setNumberFormat('@');
}
function upsertPengajuan_(entry){
 const kode=String(entry.kode||'').trim().toUpperCase();if(!/^[A-Z]{2,}-\d{1,12}$/.test(kode))throw Error('Kode generator tidak valid');entry.kode=kode;
 ['tanggal','unit','sumber'].forEach(k=>{if(!String(entry[k]||'').trim())throw Error('Field '+k+' wajib diisi')});
 const date=String(entry.tanggal);if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Tanggal tidak valid');
 const items=detailItems_(entry),sum=Math.round(items.reduce((a,x)=>a+x.nominal,0)*100)/100;
 const nominal=Number(entry.nominal),saldo=Number(entry.saldo);if(!Number.isFinite(saldo)||saldo<0||Math.abs(nominal-sum)>0.005)throw Error('Saldo/total nominal tidak konsisten');
 const {sh,map}=mapSheet_(GENERATOR_TAB,COLS),matches=rowsByCode_(sh,map,kode);if(matches.length>1)throw Error('Kode URES duplikat di tab Pengajuan');
 const old=matches.length?matches[0]:null,oldStatus=old?String(sh.getRange(old,map['status']).getDisplayValue()).trim().toUpperCase():'BELUM TERDETEKSI WA';
 if(oldStatus!=='BELUM TERDETEKSI WA'){
  // Retries for a completed application sync are harmless only if contents match existing data.
  const oldText=String(sh.getRange(old,map['teks whatsapp (copy)']).getDisplayValue()).trim();
  if(oldText===String(entry.teks||'').trim())return {ok:true,kode,existed:true,ignored:true,status:oldStatus};
  throw Error('URES sudah dalam proses persetujuan; data tidak boleh diubah');
 }
 const t=date.split('-'),tgl=new Date(Number(t[0]),Number(t[1])-1,Number(t[2]),12,0,0);
 const value={Tanggal:tgl,Kode:kode,Unit:entry.unit,Kategori:entry.kategori,Keperluan:entry.keperluan,'No. Ref':String(entry.noref||''),Nominal:nominal,'Sumber Dana':entry.sumber,'Saldo Sebelum':saldo,'Saldo Sesudah':Math.round((saldo-nominal)*100)/100,Tujuan:entry.tujuan,Status:oldStatus,'Disetujui Oleh':'','Menunggu Persetujuan':entry.menunggu,'Teks WhatsApp (Copy)':String(entry.teks||'')};
 const width=sh.getLastColumn(),out=new Array(width).fill('');Object.keys(value).forEach(k=>out[map[k.toLowerCase()]-1]=valueSafe_(value[k]));
 const row=old||sh.getLastRow()+1;sh.getRange(row,1,1,width).setValues([out]);
 sh.getRange(row,map['tanggal']).setNumberFormat('dd/mm/yyyy');sh.getRange(row,map['no. ref']).setNumberFormat('@');
 sh.getRange(row,map['nominal']).setNumberFormat('#,##0.00');sh.getRange(row,map['saldo sebelum']).setNumberFormat('#,##0.00');sh.getRange(row,map['saldo sesudah']).setNumberFormat('#,##0.00');
 saveDetails_(entry,items,oldStatus);
 return {ok:true,kode,existed:!!old,row,jumlahItem:items.length,total:nominal};
}
function updateStatus_(req){
 const kode=String(req.kode||'').trim().toUpperCase(),status=String(req.status||'').trim().toUpperCase();
 if(!/^[A-Z]{2,}-\d{1,12}$/.test(kode)||!['MENUNGGU','DISETUJUI','DITOLAK'].includes(status))throw Error('Kode/status tidak valid');
 const {sh,map}=mapSheet_(GENERATOR_TAB,COLS),rows=rowsByCode_(sh,map,kode);if(rows.length!==1)throw Error('Kode URES tidak ditemukan atau duplikat: '+kode);
 const r=rows[0],previous=String(sh.getRange(r,map['status']).getDisplayValue()).trim().toUpperCase();
 if(status==='MENUNGGU'&&['DISETUJUI','DITOLAK'].includes(previous))return {ok:true,kode,status:previous,ignored:true};
 if(['DISETUJUI','DITOLAK'].includes(previous)&&previous!==status)throw Error('Status akhir tidak dapat ditimpa tanpa koreksi manual');
 sh.getRange(r,map['status']).setValue(status);sh.getRange(r,map['disetujui oleh']).setValue(status==='DISETUJUI'?String(req.disetujuiOleh||''):'');
 const d=mapSheet_(RINCIAN_TAB,DETAIL_COLS);const details=rowsByCode_(d.sh,d.map,kode);details.forEach(r=>d.sh.getRange(r,d.map['status']).setValue(status));
 return {ok:true,kode,status,row:r,jumlahItem:details.length};
}
