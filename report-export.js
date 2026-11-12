'use strict';
// Human-readable CSV + styled XLSX export. Uses only built-in Node modules.
// The 14-column internal Google Sheets sync CSV is deliberately left unchanged.
const zlib = require('node:zlib');
const {statusDisplay} = require('./lib');

const COLS = [
  ['No', 'no', 7, 'number'],
  ['Tanggal Pengajuan (WIB)', 'createdAt', 25, 'date'],
  ['Kode URES', 'kode', 19, 'text'],
  ['Grup WhatsApp', 'group', 30, 'text'],
  ['Nama Pengirim', 'sender', 26, 'text'],
  ['Nomor WA Pengirim', 'phone', 22, 'text'],
  ['Rekening Sumber', 'account', 22, 'text'],
  ['Jumlah Item', 'itemCount', 14, 'number'],
  ['Total Nominal (Rp)', 'total', 24, 'currency'],
  ['Status Pengajuan', 'status', 20, 'status'],
  ['Disetujui / Diputuskan Oleh', 'decidedBy', 28, 'text'],
  ['Waktu Keputusan (WIB)', 'decidedAt', 25, 'date'],
  ['Status Pembayaran', 'payment', 22, 'payment'],
  ['Waktu Pembayaran (WIB)', 'paidAt', 25, 'date'],
  ['Catatan / Validasi', 'note', 40, 'text'],
];
const EXTRA = ['Rincian Pembayaran', 'items', 55, 'text'];
const esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const WIB_OFFSET = 7*3600000;
function serial(ms) { return Number.isFinite(ms) && ms>0 ? 25569+(ms+WIB_OFFSET)/86400000 : null; }
function humanDate(ms) {
  if(!Number.isFinite(ms)||ms<=0)return '';
  const d=new Date(ms+WIB_OFFSET);
  return `${String(d.getUTCDate()).padStart(2,'0')}/${String(d.getUTCMonth()+1).padStart(2,'0')}/${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}:${String(d.getUTCSeconds()).padStart(2,'0')}`;
}
function millis(v) { if(typeof v==='number')return v; if(typeof v==='string'&&v.trim()) { const t=Date.parse(v); return Number.isFinite(t)?t:null; } return null; }
function report(records,mode='history') {
  if(!['history','rekap'].includes(mode))throw Error('Jenis laporan tidak dikenal');
  const columns=mode==='rekap'?[...COLS,EXTRA]:COLS;
  const sorted=[...records].sort((a,b)=>(millis(b.createdAt)||0)-(millis(a.createdAt)||0));
  const rows=sorted.map((p,i)=>{
    const notes=[];
    if(!Number.isFinite(Number(p.total)) || Number(p.total)===0)notes.push('Periksa nominal (data tersimpan Rp0)');
    if(p.approx)notes.push('Perkiraan nominal');
    if(p.sending)notes.push('Status pengiriman WA perlu diperiksa');
    return {
      no:i+1, createdAt:millis(p.createdAt), kode:String(p.kode||''),
      group:String(p.groupName||p.group||''), sender:String(p.senderName||p.senderNumber||''),
      phone:String(p.senderNumber||''),account:String(p.account||''),
      itemCount:Array.isArray(p.items)?p.items.length:0,
      total:Number.isFinite(Number(p.total))?Number(p.total):0,
      status:statusDisplay(p),decidedBy:String(p.decidedBy||''),decidedAt:millis(p.decidedAt),
      payment:p.paid?'SUDAH DIBAYAR':'BELUM DIBAYAR',paidAt:millis(p.paidAt),
      note:notes.join('; '),items:Array.isArray(p.items)?p.items.join(' | '):''
    };
  });
  const approved=rows.filter(r=>r.status==='DONE');
  const summary={count:rows.length,done:approved.length,paid:rows.filter(r=>r.payment==='SUDAH DIBAYAR').length,
    totalApproved:approved.reduce((a,r)=>a+r.total,0),nominalZero:rows.filter(r=>r.total===0).length};
  return {kind:mode,columns,rows,summary};
}
function spreadsheetSafe(s,forceText=false){let v=String(s??'');if(/^[\s\t\r\n]*[=+@\-]/.test(v))v="'"+v;
  // Prevent Excel automatic scientific notation / leading-zero loss in CSV. XLSX is preferred.
  if(forceText && /^\d{10,}$/.test(v))v="'"+v;
  return v;
}
function csv(reportObj) {
  const line=arr=>arr.map(v=>'"'+spreadsheetSafe(v).replace(/"/g,'""')+'"').join(';');
  const header=line(reportObj.columns.map(c=>c[0]));
  const body=reportObj.rows.map(r=>line(reportObj.columns.map(([name,key,,kind])=>{
    const val=r[key];
    if(kind==='date')return humanDate(val);
    if(kind==='number'||kind==='currency')return String(val??0);
    return spreadsheetSafe(val,kind==='text'&&['phone','account'].includes(key));
  })));
  return '\ufeffsep=;\r\n'+[header,...body].join('\r\n')+'\r\n';
}
// Minimal ZIP writer for ECMA-376 XLSX; no npm dependencies, no temp files.
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(b){let c=0xFFFFFFFF;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zip(files){const parts=[],central=[];let offset=0;
  for(const [name,content]of Object.entries(files)){
    const fn=Buffer.from(name),raw=Buffer.from(content,'utf8'),def=zlib.deflateRawSync(raw),crc=crc32(raw);
    const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0,6);head.writeUInt16LE(8,8);head.writeUInt32LE(crc,14);head.writeUInt32LE(def.length,18);head.writeUInt32LE(raw.length,22);head.writeUInt16LE(fn.length,26);
    parts.push(head,fn,def);
    const cent=Buffer.alloc(46);cent.writeUInt32LE(0x02014b50,0);cent.writeUInt16LE(20,4);cent.writeUInt16LE(20,6);cent.writeUInt16LE(8,10);cent.writeUInt32LE(crc,16);cent.writeUInt32LE(def.length,20);cent.writeUInt32LE(raw.length,24);cent.writeUInt16LE(fn.length,28);cent.writeUInt32LE(offset,42);central.push(cent,fn);offset+=head.length+fn.length+def.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0),count=Object.keys(files).length,end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...parts,...central,end]);
}
function colLetter(i){let out='';for(let n=i+1;n>0;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;}
function c(address,val,style=0){if(val===undefined||val===null)return `<c r="${address}" s="${style}"/>`;
  if(typeof val==='number'&&Number.isFinite(val))return `<c r="${address}" s="${style}"><v>${val}</v></c>`;
  return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(val).slice(0,32000))}</t></is></c>`;
}
const STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="&quot;Rp&quot; #,##0;[Red](&quot;Rp&quot; #,##0)"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm:ss"/><numFmt numFmtId="166" formatCode="#,##0"/></numFmts>
<fonts count="5"><font><sz val="10"/><name val="Aptos"/><color rgb="FF243A52"/></font><font><b/><sz val="20"/><name val="Aptos Display"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="10"/><name val="Aptos"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="9"/><name val="Aptos"/><color rgb="FF496484"/></font><font><b/><sz val="16"/><name val="Aptos"/><color rgb="FF0C2E5B"/></font></fonts>
<fills count="7"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0C2E5B"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE7F2FD"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7FBFF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3F4E9"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF2D9"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="hair"><color rgb="FFD4E4F2"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="15"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment wrapText="1" horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="164" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/>
<xf numFmtId="165" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="3" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="49" fontId="0" fillId="4" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function xlsx(rep){const n=rep.columns.length,last=colLetter(n-1),rows=[],merges=[];
  const row=(idx,cells,height)=>`<row r="${idx}"${height?` ht="${height}" customHeight="1"`:''}>${cells.join('')}</row>`;
  rows.push(row(1,[c('A1',`KOSPIN SMS  |  ${rep.kind==='history'?'LAPORAN RIWAYAT PENGAJUAN':'REKAP PENGAJUAN PEMBAYARAN'}`,1)],32));merges.push(`A1:${last}2`);
  rows.push(row(3,[c('A3','PERSETUJUAN WHATSAPP • Seluruh waktu menggunakan WIB (UTC+7) • Nominal rupiah',10)],23));merges.push(`A3:${last}3`);
  rows.push(row(4,[c('A4','Ekspor data dari Dashboard Kospin SMS • Status DONE = disetujui, bukan berarti sudah dibayar',10)],21));merges.push(`A4:${last}4`);
  const metric=[['TOTAL PENGAJUAN',rep.summary.count],['DONE / DISETUJUI',rep.summary.done],['SUDAH DIBAYAR',rep.summary.paid],['TOTAL NOMINAL DONE',rep.summary.totalApproved],['PERIKSA NOMINAL Rp0',rep.summary.nominalZero]];
  const label=[],value=[];for(let i=0;i<5;i++){const start=colLetter(i*3),end=colLetter(i*3+2);label.push(c(`${start}5`,metric[i][0],10));value.push(c(`${start}6`,i===3?'Rp'+new Intl.NumberFormat('id-ID').format(metric[i][1]):metric[i][1],11));merges.push(`${start}5:${end}5`,`${start}6:${end}7`)}
  rows.push(row(5,label,21));rows.push(row(6,value,27));
  rows.push(row(8,[c('A8','Catatan: Nilai Rp0 berasal dari data tersimpan; verifikasi sebelum laporan dipakai untuk keputusan pembayaran.',12)],26));merges.push(`A8:${last}8`);
  rows.push(row(10,rep.columns.map((col,i)=>c(`${colLetter(i)}10`,col[0],3)),32));
  for(let ri=0;ri<rep.rows.length;ri++){
    const obj=rep.rows[ri],num=11+ri,odd=ri%2!==0,cellList=[];
    for(let j=0;j<n;j++){
      const [,key,,kind]=rep.columns[j];let value=obj[key];let style=odd?5:4;
      if(kind==='currency')style=odd?7:6;
      if(kind==='date'){style=odd?9:8;value=serial(value)}
      if(['phone','account','kode'].includes(key))style=odd?14:13;
      if(key==='note'&&value)style=12;
      cellList.push(c(`${colLetter(j)}${num}`,value,style));
    }
    rows.push(row(num,cellList,23));
  }
  const lastRow=10+Math.max(1,rep.rows.length),cols=rep.columns.map(([name,key,width],i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('');
  const mergeXml=`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`;
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="10" topLeftCell="A11" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="19"/><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData>${mergeXml}<autoFilter ref="A10:${last}${lastRow}"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
  const wb=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${rep.kind==='history'?'Riwayat':'Rekap'}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  return zip({
    '[Content_Types].xml':`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    '_rels/.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml':wb,
    'xl/_rels/workbook.xml.rels':`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml':STYLES,
    'xl/worksheets/sheet1.xml':sheet
  });
}
module.exports={COLS,report,csv,xlsx,humanDate,serial};
