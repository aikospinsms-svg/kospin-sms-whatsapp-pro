/**
 * Contoh Web App Google Apps Script untuk Spreadsheet Rekap Kospin SMS.
 * Ganti SECRET dan deploy sebagai Web App dengan akses sesuai kebijakan Anda.
 * PERINGATAN: URL dan secret adalah kredensial; jangan bagikan.
 */
const SECRET_REKAP = 'GANTI_DENGAN_SECRET_PANJANG_ACAK';
function doGet(e) { return json_({ok:true,service:'Rekap Kospin SMS',health:'ready'}); }
function doPost(e) {
  try {
    const input=JSON.parse(e.postData.contents);
    if(input.secret!==SECRET_REKAP) throw Error('Unauthorized');
    if(input.action!=='sync'||!Array.isArray(input.headers)||!Array.isArray(input.rows)||!Array.isArray(input.summary)) throw Error('Payload tidak valid');
    if(input.headers.length!==14) throw Error('Header harus 14 kolom');
    const ss=SpreadsheetApp.getActiveSpreadsheet();
    replace_(ss,'Rekap',[input.headers,...input.rows]);
    replace_(ss,'Ringkasan Harian',input.summary);
    return json_({ok:true,count:input.rows.length,updatedAt:new Date().toISOString()});
  } catch(err){return json_({ok:false,error:String(err.message||err)});}
}
function replace_(ss,title,rows){
  const sh=ss.getSheetByName(title)||ss.insertSheet(title);
  sh.clearContents();if(!rows.length)return;
  const w=Math.max(...rows.map(r=>r.length));
  const normalized=rows.map(r=>Array.from({length:w},(_,i)=>r[i]===undefined?'':r[i]));
  sh.getRange(1,1,normalized.length,w).setValues(normalized);
  sh.setFrozenRows(1);sh.getRange(1,1,1,w).setFontWeight('bold').setBackground('#0C2E5B').setFontColor('#ffffff');
}
function json_(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
