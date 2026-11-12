'use strict';
const VERSION='1.6.4-PRO-REPORT';
const YES=new Set('IYA YA SETUJU APPROVE ACC OK OKE LANJUT LANJUTKAN LAKSANAKAN PROSES SIAP BOLEH SILAKAN GAS DEAL MANTAP BAIK'.split(' '));
const NO=new Set('TIDAK TOLAK JANGAN BATAL NO BELUM'.split(' '));
const HEADERS=['Tanggal Pengajuan','Grup','Pengirim','No Pengirim','Kode','Rekening','Rincian','Jumlah Item','Total Rp','Status','Proses Bayar','Disetujui/Diputuskan Oleh','Waktu Keputusan','Tanggal Pembayaran'];
function field(text,name){const m=String(text).match(new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*:\\s*(.*)$','im'));return m?m[1].trim():''}
function isGenerator(text){const t=String(text||'').trim();return /^PENGAJUAN PEMBAYARAN\s*$/i.test(t.split(/\r?\n/)[0]||'')&&/^Kode\s*:/im.test(t)&&(/^(?:Nominal|Total Nominal)\s*:/im.test(t))}
function isPengajuan(text){const t=String(text||'').toLowerCase();return isGenerator(text)||t.includes('izin pengajuan pembayaran')||(t.includes('mohon approve')&&t.includes('pembayaran'))||((t.includes('izin pengajuan')||t.includes('pengajuan'))&&(t.includes('pembayaran')||t.includes('ures-')||t.includes('mohon approve')))}
function isEligible(text){const t=String(text||'');return /\b(?:VA|virtual\s+account)\b/i.test(t)||/\bkospin\b/i.test(t)||!!extractRekening(t)}
function decision(text){const s=String(text||'').trim();if(!s||s.length>30||s.split(/\s+/).length>3)return null;const first=(s.split(/\s+/)[0]||'').replace(/[,.!?;:]+$/,'').toUpperCase();return YES.has(first)?'yes':NO.has(first)?'no':null}
function parseRupiah(s){const value=String(s||'').replace(/^.*?Rp\s*/i,'').trim().replace(/\./g,'').replace(',','.');return /^\d+(?:\.\d+)?$/.test(value)?Number(value):null}
function extractKode(text){const s=field(text,'Kode');const m=s.match(/^([A-Z]{2,}-\d+)\b/i);return m?m[1].toUpperCase():null}
function extractRekening(text){const m=String(text||'').match(/\b\d{2}(?:\.\d{2,8}){2,}\b/g)||[];return m.sort((a,b)=>b.length-a.length)[0]||''}
function sourceAccount(text){const source=field(text,'Sumber Dana');
 // Generator: rekening sumber selalu berasal dari baris Sumber Dana, bukan rekening tujuan pada rincian.
 if(isGenerator(text)&&source){const m=source.match(/\b\d{2}(?:\.\d{2,8}){2,}\b/g)||[];return m.sort((a,b)=>b.length-a.length)[0]||source;}
 const num=extractRekening(text);if(num)return num;
 if(source)return source;
 const m=String(text).match(/\bkospin\s+([^\n/,.;]+)/i);
 if(m)return 'kospin '+m[1].replace(/\s+(?:mohon\s+approve|saldo|cc)\b.*$/i,'').trim().replace(/^(?:PT|CV)\s+/i,'');
 return '';
}
function parseTags(text){const t=String(text||'');let names=[];
 if(isGenerator(t)){names=field(t,'Menunggu').split(/[,;]+/).map(v=>v.trim().replace(/^@/,''));}
 else{const lines=t.split(/\r?\n/).filter(line=>!/^\s*cc\b/i.test(line)).map(line=>line.replace(/(?:\/|;)\s*cc\b.*$/i,''));const clean=lines.join('\n');const re=/@([^@\r\n]+)/g;let m;while((m=re.exec(clean))){let s=m[1].trim();if(!s)continue;const tokens=s.split(/\s+/);const found=[];for(const token of tokens){if(found.length>=3)break;if(found.length>0&&/^[a-z]/.test(token)&&!(['tak','dikenal'].includes(token.toLowerCase())&&found[0].toLowerCase()==='pengguna'))break;if(/^(?:mohon|dan|cc|pak,|terima|saldo|izin|pembayaran|untuk|dari|dengan)$/i.test(token))break;found.push(token.replace(/[,;.!]+$/,''));}if(found.length)names.push(found.join(' '));}}
 const seen=new Set;return names.map(v=>v.split(/\s+/).slice(0,3).join(' ').trim()).filter(v=>{const k=v.toLowerCase();if(!v||seen.has(k))return false;seen.add(k);return true});}
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
function parsedDate(text,createdAt=Date.now()){
 let s=field(text,'Tanggal'),m;
 if(!s){m=String(text).match(/\b(?:tanggal|tgl)\s*:?\s*(\d{1,2}[\s/.-]+(?:\d{1,2}|[a-z]+)[\s/.-]+\d{4})\b/i);s=m?.[1]||'';}
 if(s){m=s.match(/^(\d{1,2})[\s/.-]+(\d{1,2}|[A-Za-z]+)[\s/.-]+(\d{4})/);if(m){const d=+m[1],mon=/^\d+$/.test(m[2])?+m[2]:MONTHS.findIndex(x=>x.toLowerCase()===m[2].toLowerCase())+1,y=+m[3];if(mon>=1&&mon<=12&&d>=1&&d<=31){const chk=new Date(Date.UTC(y,mon-1,d));if(chk.getUTCDate()===d&&chk.getUTCMonth()===mon-1)return `${String(d).padStart(2,'0')} ${MONTHS[mon-1]} ${y}`;}}}
 return new Intl.DateTimeFormat('id-ID',{day:'2-digit',month:'long',year:'numeric',timeZone:'Asia/Jakarta'}).format(new Date(createdAt));
}
function normalizeMoney(s){const n=parseRupiah(s);return n===null?'':`Rp${new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(n)}`}
function itemAmounts(text){
 if(isGenerator(text)){
   const lines=String(text||'').split(/\r?\n/),start=lines.findIndex(x=>/^Rincian Pembayaran\s*:/i.test(x));
   if(start!==-1){
     const items=[],values=[];let current=null,nominal=null,malformed=false;
     const push=()=>{if(!current)return;if(nominal===null||!Number.isFinite(nominal))malformed=true;else{values.push(nominal);items.push(`${items.length+1}) ${current} = Rp${new Intl.NumberFormat('id-ID',{maximumFractionDigits:2}).format(nominal)}`)}};
     for(let i=start+1;i<lines.length;i++){
       const line=lines[i];if(/^Total Item\s*:|^Total Nominal\s*:|^Menunggu\s*:/i.test(line.trim()))break;
       const match=line.match(/^\s*(\d{1,2})\)\s*Kategori:\s*(.*)$/i);
       if(match){push();current='';nominal=null;continue}
       if(current!==null&&/^\s*Keperluan\s*:/i.test(line))current=line.replace(/^\s*Keperluan\s*:/i,'').trim();
       if(current!==null&&/^\s*Nominal\s*:/i.test(line)){if(nominal!==null)malformed=true;nominal=parseRupiah(line.replace(/^\s*Nominal\s*:/i,''));}
     }
     push();
     const sum=Math.round(values.reduce((n,v)=>n+v,0)*100)/100;
     const printedTotal=parseRupiah(field(text,'Total Nominal'));
     const printedCount=Number(field(text,'Total Item'));
     if(items.length===0||items.length>30||!Number.isInteger(printedCount)||printedCount!==items.length||printedTotal===null||Math.abs(printedTotal-sum)>.005||malformed){
       return {items,total:0,approx:true,invalid:true};
     }
     return {items,total:sum,approx:false,invalid:false};
   }
   const v=field(text,'Nominal'),n=parseRupiah(v);if(n===null)return {items:[],total:0,approx:true};const purpose=field(text,'Keperluan')||'Pengajuan Pembayaran';return {items:[`1) ${purpose} = ${normalizeMoney(v)}`],total:n,approx:false};
 }
 const lines=String(text||'').split(/\r?\n/);let items=[];let approx=false;let total=0;
 for(const line of lines){if(!/^\s*(?:\d{1,2}\s*[).]|[-•]\s*URES-)/.test(line))continue;
   items.push(line.trim());const filtered=line.replace(/\b[A-Z]{2,}-\d+\b/gi,'').replace(/\b\d{2}(?:\.\d{2,8}){2,}\b/g,'');
   const nums=[...filtered.matchAll(/(?:Rp\s*)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?/gi)].map(m=>parseRupiah(m[0])).filter(n=>n!==null);
   if(nums.length!==1)approx=true;if(nums.length)total+=Math.max(...nums);
 }
 return {items,total,approx};
}
function formatConfirmation(text,createdAt){const tags=parseTags(text);const account=sourceAccount(text);const extra=tags.length?' '+tags.map(n=>'@'+n).join(' '):'';
 const from=account||'[rekening tidak tercantum]';return `Baik Pak${extra}, kami konfirmasi kembali pendebetan tanggal ${parsedDate(text,createdAt)} dari rekening ${from}. Pengajuan sebagai berikut:\n\n${text}\n\nKami bantu proses sesuai konfirmasi di atas ya, Pak. 🙏\nTerima kasih.`;}
function parseApprovers(input){if(Array.isArray(input))return input.map(v=>({name:String(v.name||'').trim(),number:cleanNumber(v.number)})).filter(v=>v.number);const seen=new Set();const result=[];for(const line of String(input||'').split(/\r?\n/)){const s=line.trim();if(!s)continue;const parts=s.split(':');let number='',name='';if(parts.length===1)number=parts[0];else if(/^\+?\d/.test(parts[0].trim())){number=parts[0];name=parts.slice(1).join(':')}else{name=parts.slice(0,-1).join(':');number=parts[parts.length-1]};number=cleanNumber(number);if(!/^\d{10,20}$/.test(number))throw Error('Nomor pengurus tidak valid: '+s);if(!seen.has(number)){result.push({name:name.trim(),number});seen.add(number)}}return result;}
function cleanNumber(v){return String(v||'').replace(/@.*$/,'').replace(/[^\d]/g,'')}
function effectiveApprovers(config,group){const custom=config.groupApprovers?.[group];return Array.isArray(custom)&&custom.length?custom:config.approvers||[]}
function approverStats(config){
 const global=Array.isArray(config?.approvers)?config.approvers:[];
 const monitored=Array.isArray(config?.groups)?config.groups:[];
 const entries=[...global,...monitored.flatMap(group=>Array.isArray(config.groupApprovers?.[group])?config.groupApprovers[group]:[])];
 const numbers=new Set(entries.map(v=>cleanNumber(v.number)).filter(Boolean));
 const missingApproverGroups=monitored.filter(group=>effectiveApprovers(config,group).length===0);
 return {approvers:numbers.size,globalApprovers:global.length,missingApproverGroups};
}
function lookupApprover(config,group,ids){const entries=effectiveApprovers(config,group);const set=[...new Set((Array.isArray(ids)?ids:[ids]).map(cleanNumber).filter(Boolean))];return entries.find(a=>set.includes(cleanNumber(a.number)))||null}
function identityNumbers(msg,contacts=new Map()){const keys=[msg?.key?.participant,msg?.key?.participantPn,msg?.participantPn,msg?.senderPn,msg?.key?.senderPn,msg?.key?.participantAlt,msg?.sender,msg?.reaction?.key?.participant,msg?.reaction?.key?.participantPn].filter(Boolean);
 const out=new Set(keys.map(cleanNumber));for(const id of keys){const c=contacts.get(id);if(c){if(typeof c==='string')out.add(cleanNumber(c));else [c.jid,c.id,c.phoneNumber,c.lid,c.pn].filter(Boolean).forEach(v=>out.add(cleanNumber(v)))}}
 return [...out].filter(Boolean)}
function firstPending(queue,group){return queue.filter(p=>p.group===group&&p.status==='menunggu').sort((a,b)=>a.createdAt-b.createdAt)[0]||null}
function statusDisplay(p){return {menunggu:'MENUNGGU',dikonfirmasi:'DONE',ditolak:'DITOLAK',kedaluwarsa:'KEDALUWARSA'}[p.status]||p.status}
function csv(rows){return '\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n')+'\r\n'}
function rowOf(p){return [new Date(p.createdAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}),p.groupName||p.group,p.senderName||'',p.senderNumber||'',p.kode||'',p.account||'',(p.items||[]).join(' | '),(p.items||[]).length,p.total||0,statusDisplay(p),p.paid?'SUDAH':'BELUM',p.decidedBy||'',p.decidedAt?new Date(p.decidedAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}):'',p.paidAt?new Date(p.paidAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'}):'']}
function dayOf(when){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(when))}
function dailyStats(all,day=dayOf(Date.now()),group=null){const mine=all.filter(p=>dayOf(p.createdAt)===day&&(!group||p.group===group));return {masuk:mine.length,menunggu:mine.filter(p=>p.status==='menunggu').length,dikonfirmasi:mine.filter(p=>p.status==='dikonfirmasi').length,ditolak:mine.filter(p=>p.status==='ditolak').length,kedaluwarsa:mine.filter(p=>p.status==='kedaluwarsa').length,paid:mine.filter(p=>p.paid).length,total:mine.filter(p=>p.status==='dikonfirmasi').reduce((n,p)=>n+(p.total||0),0),approx:mine.some(p=>p.status==='dikonfirmasi'&&p.approx)};}
function historyLine(p){const label={menunggu:'⏳ MENUNGGU',dikonfirmasi:'✅ DIKONFIRMASI',ditolak:'❌ DITOLAK',kedaluwarsa:'⌛ KEDALUWARSA'}[p.status]||p.status;return `${new Date(p.createdAt).toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} | ${p.senderName||p.senderNumber||'-'} | ${label} | ${p.items?.length||0} item | ${p.account||'-'}`;}
function renderRekap(all,group,day=dayOf(Date.now())){const s=dailyStats(all,day,group);return `📊 REKAP PENGAJUAN HARIAN\nTanggal: ${day}\nMasuk: ${s.masuk}\n✅ Dikonfirmasi: ${s.dikonfirmasi}\n💰 Total: Rp${new Intl.NumberFormat('id-ID').format(s.total)}${s.approx?' (perkiraan)':''}\n❌ Ditolak: ${s.ditolak}\n⌛ Kedaluwarsa: ${s.kedaluwarsa}\n⏳ Menunggu: ${s.menunggu}`;}
module.exports={VERSION,HEADERS,field,isGenerator,isPengajuan,isEligible,decision,parseRupiah,extractKode,extractRekening,sourceAccount,parseTags,parsedDate,itemAmounts,formatConfirmation,parseApprovers,cleanNumber,effectiveApprovers,approverStats,lookupApprover,identityNumbers,firstPending,statusDisplay,csv,rowOf,dayOf,dailyStats,historyLine,renderRekap};
