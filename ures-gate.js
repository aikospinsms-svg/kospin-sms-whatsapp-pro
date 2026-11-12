'use strict';
// Fail-closed: only saved Generator Dashboard entries may become WhatsApp approvals.
const L=require('./lib'),G=require('./generator-store');
function normalize(text){return G.normalizeText(text)}
function validateSubmission(text,entries,claims={},records=[]){
 const kode=L.extractKode(text);
 if(!kode||!/^URES-\d{1,12}$/.test(kode))return {ok:false,reason:'Kode URES valid tidak ditemukan; pesan tidak diproses'};
 if(!L.isGenerator(text)||!L.isPengajuan(text))return {ok:false,kode,reason:'Hanya format resmi Generator Dashboard yang diproses'};
 const entry=(entries||[]).find(x=>x.kode===kode);
 if(!entry)return {ok:false,kode,reason:'Kode '+kode+' belum disimpan di Generator Dashboard'};
 if(!L.isEligible(text))return {ok:false,kode,reason:'Pengajuan bukan rekening Kospin/VA'};
 const check=L.itemAmounts(text);
 if(check.invalid||!check.items.length||check.approx||Math.abs(check.total-entry.nominal)>.005||check.items.length!==G.itemList(entry).length)return {ok:false,kode,reason:'Rincian pembayaran/nominal tidak valid atau tidak cocok dengan Generator'};
 if(normalize(text)!==normalize(G.buildText(entry)))return {ok:false,kode,reason:'Teks WA berbeda dari pengajuan tersimpan pada Generator; periksa rekening, rincian, tanggal, dan tag'};
 if(claims[kode]||(records||[]).some(x=>x.kode===kode))return {ok:false,kode,reason:'Kode '+kode+' sudah pernah didaftarkan/diproses; tidak boleh dipakai dua kali'};
 return {ok:true,kode,entry,items:check};
}
function approvable(p,entries,claims={}){
 if(!p||!p.kode||!p.id)return false;
 const entry=(entries||[]).find(x=>x.kode===p.kode);
 if(!entry||!L.isEligible(p.raw)||!L.isGenerator(p.raw))return false;
 const parsed=L.itemAmounts(p.raw);
 if(parsed.invalid||!parsed.items.length||parsed.approx||Math.abs(parsed.total-entry.nominal)>.005||parsed.items.length!==G.itemList(entry).length)return false;
 if(normalize(p.raw)!==normalize(G.buildText(entry)))return false;
 // Claim is immutable and bound to the first accepted WhatsApp message.
 return !claims[p.kode]||claims[p.kode].id===p.id;
}
function quotedId(message){const m=message?.message||{},body=m.ephemeralMessage?.message||m.viewOnceMessage?.message||m.viewOnceMessageV2?.message||m;return body.extendedTextMessage?.contextInfo?.stanzaId||body.imageMessage?.contextInfo?.stanzaId||body.documentMessage?.contextInfo?.stanzaId||''}
function pickPending(queue,group,message,entries,claims={},decisionText=''){
 const pending=(queue||[]).filter(p=>p.group===group&&p.status==='menunggu'&&!p.sending&&approvable(p,entries,claims)).sort((a,b)=>a.createdAt-b.createdAt);
 const quote=quotedId(message);
 // Explicit code in IYA URES-xxxxx must never approve another code.
 const code=(String(decisionText).match(/\bURES-\d+\b/i)||[])[0]?.toUpperCase()||'';
 if(quote){const match=pending.find(p=>p.messageId===quote)||null;return code&&match?.kode!==code?null:match}
 return code?pending.find(p=>p.kode===code)||null:pending[0]||null;
}
module.exports={normalize,validateSubmission,approvable,quotedId,pickPending};
