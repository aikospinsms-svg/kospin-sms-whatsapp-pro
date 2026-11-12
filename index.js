'use strict';
// WhatsApp bot for Kospin SMS; no chat-based AI, no payment execution.
const fs=require('fs'),path=require('path'),http=require('http');
const express=require('express');const QRCode=require('qrcode');const {Server}=require('socket.io');
const L=require('./lib');const REPORT=require('./report-export');const G=require('./generator-store');const U=require('./ures-gate');const {SOURCES}=require('./source-accounts');const {AuthManager,ROLES,PERMISSIONS,allowed}=require('./auth-manager');const {permissionFor}=require('./route-permissions');
const PORT=+(process.env.PORT||3002),SESSION_ID=process.env.SESSION_ID||'kospin-sms',DIR=__dirname;
const AUTH=path.join(DIR,'auth',SESSION_ID),DATA=path.join(DIR,'data');const accounts=new AuthManager(DIR);fs.mkdirSync(DATA,{recursive:true});fs.mkdirSync(path.dirname(AUTH),{recursive:true});
function atomic(filename,value){const file=path.join(DIR,filename);fs.mkdirSync(path.dirname(file),{recursive:true});if(fs.existsSync(file)){try{fs.copyFileSync(file,file+'.bak')}catch{}}const tmp=file+'.tmp';fs.writeFileSync(tmp,typeof value==='string'?value:JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file)}
function readJSON(filename,fallback){try{return JSON.parse(fs.readFileSync(path.join(DIR,filename),'utf8'))}catch{try{return JSON.parse(fs.readFileSync(path.join(DIR,filename+'.bak'),'utf8'))}catch{return fallback}}}
const defaults={approvers:[],groupApprovers:{},groups:[],rekapEnabled:true,rekapTime:'14:00',reminderEnabled:true,reminderHours:2,sheetsUrl:'',sheetsSecret:'',generatorUrl:'',generatorSecret:'',botNumber:'628973137777'};
let cfg={...defaults,...readJSON('config.json',{})};if(!Array.isArray(cfg.approvers))cfg.approvers=[];if(!cfg.approvers.length&&Array.isArray(cfg.approverNumbers))cfg.approvers=L.parseApprovers(cfg.approverNumbers.map(n=>String(n)).join('\n'));
if(!cfg.groupApprovers||typeof cfg.groupApprovers!=='object')cfg.groupApprovers={};
let pendingRaw=readJSON('data/pending.json',[]);let queue=Array.isArray(pendingRaw)?pendingRaw:Object.entries(pendingRaw||{}).flatMap(([group,p])=>(Array.isArray(p)?p:[p]).filter(Boolean).map(x=>({...x,group:x.group||group})));
queue=queue.filter(p=>p&&p.group).map(p=>({...p,id:p.id||`${p.group}:${p.messageId||p.createdAt||Date.now()}`,raw:p.raw||p.text||p.message||'',status:p.status||'menunggu',paid:!!p.paid,createdAt:Number(p.createdAt)||Date.parse(p.timestamp||'')||Date.now()}));
let history=readJSON('data/history.json',[]);if(!Array.isArray(history))history=[];let generatorEntries=readJSON('data/generator-entries.json',[]);if(!Array.isArray(generatorEntries))generatorEntries=[];let uresClaims=readJSON('data/ures-claims.json',{});if(!uresClaims||typeof uresClaims!=='object'||Array.isArray(uresClaims))uresClaims={};let rekapSent=readJSON('data/rekap-sent.json',{});
const processed=new Map(),locks=new Set(),groups=new Map(),contacts=new Map();let sock=null,sesiGen=0,qr='',qrAt=0,status='Memulai',connected=false,lastError='',reconnectAttempt=0,reconnectTimer=null,pairingRequested=false;
const logs=[];function log(message){const line=`${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})} ${message}`;logs.unshift(line);if(logs.length>250)logs.pop();console.log(line);try{io?.emit('change',{type:'log'})}catch{}}
let io;function save(){atomic('config.json',cfg);atomic('data/pending.json',queue);atomic('data/history.json',history.slice(-200));writeCsv();queueSheetsSync();}
function allRecords(){const map=new Map();for(const p of history)map.set(p.id,p);for(const p of queue)map.set(p.id,p);return [...map.values()].sort((a,b)=>a.createdAt-b.createdAt)}
// Migrate historical URES claims (including previously accepted submissions) without erasing old records.
for(const p of allRecords())if(p.kode&&!uresClaims[p.kode])uresClaims[p.kode]={id:p.id,group:p.group,receivedAt:p.createdAt,migrated:true};
atomic('data/ures-claims.json',uresClaims);
function activeRecords(){return allRecords().filter(p=>U.approvable(p,generatorEntries,uresClaims))}
function writeCsv(){const all=allRecords();atomic('data/rekap-pengajuan.csv',L.csv([L.HEADERS,...all.map(L.rowOf)]))}
let syncTimer=null,syncStatus='Belum diatur';function queueSheetsSync(){if(syncTimer)clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncSheets().catch(e=>log('Google Sheets: '+e.message)),1200);syncTimer.unref?.()}
function sheetSummary(all){const days=[...new Set(all.map(p=>L.dayOf(p.createdAt)))].sort();const groupIds=[...new Set(all.map(p=>p.group))];return [['Tanggal','Grup','Masuk','DONE','Total Rp','Ditolak','Kedaluwarsa','Menunggu'],...days.flatMap(day=>groupIds.map(group=>{const s=L.dailyStats(all,day,group);return [day,groups.get(group)?.subject||group,s.masuk,s.dikonfirmasi,s.total,s.ditolak,s.kedaluwarsa,s.menunggu]}).filter(row=>row[2]))]}
async function postWebApp(url,body){if(!/^https:\/\//i.test(url)||!url.includes('/exec'))throw Error('Gunakan URL Apps Script HTTPS /exec');const response=await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000),redirect:'follow'});if(!response.ok)throw Error('HTTP '+response.status);const text=await response.text();let obj;try{obj=JSON.parse(text)}catch{throw Error('Balasan Apps Script bukan JSON')};if(obj.ok!==true)throw Error(obj.error||'Apps Script menolak permintaan');return obj;}
async function syncSheets(){syncTimer=null;if(!cfg.sheetsUrl){syncStatus='Belum diatur';return}const all=allRecords();try{await postWebApp(cfg.sheetsUrl,{action:'sync',secret:cfg.sheetsSecret,headers:L.HEADERS,rows:all.map(L.rowOf),summary:sheetSummary(all)});syncStatus='Sukses '+new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'});log('Google Sheets: sinkronisasi sukses')}catch(e){syncStatus='Gagal: '+e.message;log('Google Sheets gagal: '+e.message)}}
const generatorSyncPromises=new Map();
function orderedGeneratorSync(k,job){
 const prev=generatorSyncPromises.get(k)||Promise.resolve();
 const next=prev.catch(()=>{}).then(job);generatorSyncPromises.set(k,next);
 next.then(()=>{if(generatorSyncPromises.get(k)===next)generatorSyncPromises.delete(k)},()=>{if(generatorSyncPromises.get(k)===next)generatorSyncPromises.delete(k)});
 return next;
}
function syncGeneratorEntry(entry){
 if(!cfg.generatorUrl){log('Generator '+entry.kode+' tersimpan lokal; koneksi Sheets Generator belum diatur');return}
 orderedGeneratorSync(entry.kode,()=>postWebApp(cfg.generatorUrl,{action:'upsertPengajuan',secret:cfg.generatorSecret,entry:{...entry,teks:G.buildText(entry)}}))
 .then(()=>log('Generator '+entry.kode+' tersimpan di Google Sheets'))
 .catch(e=>log('Generator '+entry.kode+' tersimpan lokal, sinkronisasi Sheets gagal: '+e.message));
}
function syncGenerator(p,statusValue){
 const candidate=generatorEntries.find(x=>x.kode===p.kode);
 if(candidate&&p.raw&&U.normalize(G.buildText(candidate))!==U.normalize(p.raw)){log('Sheet generator '+p.kode+': teks WA berbeda dari data generator lokal; pembaruan status DITAHAN');return}
 if(!p.kode){log('Sheet generator dilewati: Kode tidak ada');return}
 if(!cfg.generatorUrl){log('Sheet generator dilewati: URL belum diatur');return}
 orderedGeneratorSync(p.kode,()=>postWebApp(cfg.generatorUrl,{action:'updateStatus',secret:cfg.generatorSecret,kode:p.kode,status:statusValue,disetujuiOleh:p.decidedBy||''}))
 .then(()=>log('Generator '+p.kode+' → '+statusValue)).catch(e=>log('Generator '+p.kode+' gagal: '+e.message));
}
function pushHistory(p){const i=history.findIndex(x=>x.id===p.id);if(i>=0)history.splice(i,1);history.push({...p});history=history.slice(-200)}
function setStatus(s,detail=''){status=s;lastError=detail;try{io?.emit('change',{type:'status'})}catch{}}
function isMonitored(group){return Array.isArray(cfg.groups)&&cfg.groups.includes(group)}
function groupActivity(p){return p.groupName||groups.get(p.group)?.subject||p.group}
function validateApprovers(value){if(Array.isArray(value))return L.parseApprovers(value);return L.parseApprovers(value||'')}
function normalizeConfig(input){const c={...cfg};if(input.approvers!==undefined)c.approvers=validateApprovers(input.approvers);if(input.groupApprovers!==undefined){if(typeof input.groupApprovers!=='object'||Array.isArray(input.groupApprovers)||!input.groupApprovers)throw Error('Pengurus per grup harus berupa object');c.groupApprovers={};for(const [jid,v]of Object.entries(input.groupApprovers))if(jid.endsWith('@g.us'))c.groupApprovers[jid]=validateApprovers(v)}
 if(input.groups!==undefined){if(!Array.isArray(input.groups))throw Error('groups harus array');c.groups=[...new Set(input.groups.filter(v=>typeof v==='string'&&v.endsWith('@g.us')))]}
 for(const name of ['rekapEnabled','reminderEnabled'])if(name in input)c[name]=!!input[name];
 if('rekapTime'in input){if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.rekapTime))throw Error('Jam rekap harus HH:MM');c.rekapTime=input.rekapTime}
 if('reminderHours'in input){const h=Number(input.reminderHours);if(!Number.isInteger(h)||h<1||h>24)throw Error('Pengingat harus 1–24 jam');c.reminderHours=h}
 for(const field of ['sheetsUrl','generatorUrl'])if(field in input){if(input[field]&&!/^https:\/\/[^\s]+\/exec(?:\?.*)?$/.test(input[field]))throw Error(field+' harus HTTPS Apps Script /exec');c[field]=String(input[field]||'').trim()}
 for(const field of ['sheetsSecret','generatorSecret'])if(field in input)c[field]=String(input[field]||'');
 return c;}
function pruneProcessed(){if(processed.size<2000)return;for(const [k,time]of processed)if(Date.now()-time>36e5)processed.delete(k)}
function seenMessage(id){if(!id)return false;if(processed.has(id))return true;processed.set(id,Date.now());pruneProcessed();return false}
function storeSubmission(m,text){
 // Ignore all unregistered, legacy, edited, and already-used URES submissions.
 const match=U.validateSubmission(text,generatorEntries,uresClaims,allRecords());
 if(!match.ok){if(L.isPengajuan(text)||L.extractKode(text))log('Diabaikan [URES ONLY] di '+m.group+': '+match.reason);return false}
 const id=m.group+':'+m.messageId;
 if(!m.messageId||allRecords().some(p=>p.id===id))return false;
 const p={id,messageId:m.messageId,group:m.group,groupName:groups.get(m.group)?.subject||m.group,raw:text,senderName:m.senderName||'',senderNumber:m.senderNumber||'',createdAt:m.createdAt||Date.now(),status:'menunggu',account:L.sourceAccount(text),kode:match.kode,items:match.items.items,total:match.items.total,approx:false,paid:false,reminded:0};
 // Reserve URES before entering the queue to prevent duplicates across groups/restarts.
 uresClaims[match.kode]={id:p.id,group:p.group,receivedAt:p.createdAt};
 atomic('data/ures-claims.json',uresClaims);
 queue.push(p);save();if(cfg.generatorUrl)syncGenerator(p,'MENUNGGU');
 log('Pengajuan URES terdaftar diterima diam-diam: '+groupActivity(p)+' | '+p.kode);return true;
}

async function decide(p,decision,approver,origin){if(!p||p.status!=='menunggu'||locks.has(p.id)||p.sending||!U.approvable(p,generatorEntries,uresClaims)){if(p&&!U.approvable(p,generatorEntries,uresClaims))log('Persetujuan DITAHAN: URES tidak terdaftar atau data generator berbeda: '+(p.kode||p.id));return false;} // never confirm from panel without recorded approver
 if(!approver||!approver.number)return false;locks.add(p.id);
 try{if(decision==='no'){p.status='ditolak';p.decidedBy=approver.name||approver.number;p.decidedAt=Date.now();p.decisionProof={by:approver.number,method:origin};accounts.audit('WA:'+approver.number,'PENGAJUAN_DITOLAK',p.kode||p.id,origin);queue=queue.filter(x=>x.id!==p.id);pushHistory(p);save();syncGenerator(p,'DITOLAK');log('Ditolak '+p.id+' oleh '+p.decidedBy);return true}
 if(!connected||!sock)throw Error('WhatsApp belum terhubung');
 // Persist pending delivery intent BEFORE send. Ambiguous network failure does not auto retry.
 p.sending=true;p.decisionProof={by:approver.number,method:origin,at:Date.now()};save();
 try{await sock.sendMessage(p.group,{text:L.formatConfirmation(p.raw,p.createdAt)});}catch(e){p.deliveryError=e.message;save();log('Konfirmasi terkendala; ditahan agar tak terkirim dua kali: '+p.id+' | '+e.message);return false}
 p.status='dikonfirmasi';accounts.audit('WA:'+approver.number,'PENGAJUAN_DISETUJUI',p.kode||p.id,origin);p.sending=false;p.decidedBy=approver.name||approver.number;p.decidedAt=Date.now();queue=queue.filter(x=>x.id!==p.id);pushHistory(p);save();syncGenerator(p,'DISETUJUI');log('DONE: '+p.id+' oleh '+p.decidedBy+' ('+origin+')');return true;
 }finally{locks.delete(p.id)}}
function expire(){let changed=false;for(const p of [...queue]){if(p.status==='menunggu'&&!p.sending&&Date.now()-p.createdAt>=86400000){p.status='kedaluwarsa';p.decidedAt=Date.now();queue=queue.filter(x=>x.id!==p.id);pushHistory(p);changed=true;log('Kedaluwarsa: '+p.id)}}if(changed)save()}
function userIds(raw){return L.identityNumbers(raw,contacts)}
function approvalFor(group,raw){return L.lookupApprover(cfg,group,userIds(raw))}
async function incoming(message){const jid=message?.key?.remoteJid,id=message?.key?.id;if(!jid?.endsWith('@g.us')||!isMonitored(jid)||message.key.fromMe)return;const text=unwrapText(message.message);if(!text)return;
 if(seenMessage(jid+':'+id))return;const info={group:jid,messageId:id,createdAt:Number(message.messageTimestamp||0)*1000||Date.now(),senderName:message.pushName||'',senderNumber:userIds(message)[0]||''};
 if(/^RIWAYAT(?:\s+\d+)?$/i.test(text.trim())){if(!connected)return;const amount=Math.min(10,Math.max(1,parseInt(text.trim().split(/\s+/)[1]||'5',10)||5));const latest=activeRecords().filter(p=>p.group===jid).sort((a,b)=>b.createdAt-a.createdAt).slice(0,amount);await sock.sendMessage(jid,{text:latest.length?'📋 RIWAYAT PENGAJUAN\n'+latest.map(L.historyLine).join('\n'):'Belum ada riwayat pengajuan di grup ini.'});return}
 if(L.isPengajuan(text)||L.extractKode(text)){storeSubmission(info,text);return}
 const d=L.decision(text);if(!d)return;const who=approvalFor(jid,message);if(!who){log('Persetujuan diabaikan: nomor pengirim bukan pengurus terdaftar di '+jid);return}
 const p=U.pickPending(queue,jid,message,generatorEntries,uresClaims,text);if(!p){log('Persetujuan diabaikan: tidak ada antrean URES terdaftar yang cocok'+(U.quotedId(message)?' dengan pesan yang dibalas':'')+' pada '+jid);return}await decide(p,d,who,'pesan '+text.slice(0,30));
}
function unwrapText(m){if(!m)return '';const body=m.ephemeralMessage?.message||m.viewOnceMessage?.message||m.viewOnceMessageV2?.message||m.documentWithCaptionMessage?.message||m;return body.conversation||body.extendedTextMessage?.text||body.imageMessage?.caption||body.documentMessage?.caption||''}
async function onReaction(events){for(const e of events||[]){const target=e.key,react=e.reaction;if(!/^👍[🏻🏼🏽🏾🏿]?$/.test(react?.text||''))continue;const group=target?.remoteJid;if(!group?.endsWith('@g.us')||!isMonitored(group))continue;
 const actor={key:{participant:react.key?.participant||react.key?.participantPn||'',participantPn:react.key?.participantPn||'',senderPn:react.key?.senderPn||''},senderPn:react.senderPn,participantPn:react.participantPn};const who=approvalFor(group,actor);if(!who){log('Reaksi tidak berasal dari pengurus di '+group);continue}
 const p=queue.find(x=>x.group===group&&x.messageId===target.id&&x.status==='menunggu');if(p&&U.approvable(p,generatorEntries,uresClaims))await decide(p,'yes',who,'reaksi 👍');}}
function updateContacts(c){for(const x of c||[]){if(x.id&&x.lid){contacts.set(x.lid,x.id);contacts.set(x.id,x.lid)}if(x.jid&&x.lid)contacts.set(x.lid,x.jid);if(x.id)contacts.set(x.id,x)}}
async function updateGroups(){if(!sock)return;try{for(const [id,meta]of Object.entries(await sock.groupFetchAllParticipating())){groups.set(id,meta);for(const m of meta.participants||[]){if(m.lid&&(m.phoneNumber||m.id)){contacts.set(m.lid,m.phoneNumber||m.id);contacts.set(m.id,m.phoneNumber||m.id)}}}log('Grup diperbarui: '+groups.size)}catch(e){log('Tidak dapat memuat grup: '+e.message)}}
function clearReconnect(){if(reconnectTimer)clearTimeout(reconnectTimer);reconnectTimer=null}
async function stopSocket(){sesiGen++;clearReconnect();connected=false;qr='';if(sock){const old=sock;sock=null;try{old.ev.removeAllListeners()}catch{}try{old.ws?.close()}catch{}}}
async function startWhatsApp(){clearReconnect();if(sock){log('Sesi sudah berjalan; menunggu status');return}
 const myGen=++sesiGen;setStatus('Memulai sesi WA');let Baileys;
 try{Baileys=require('@whiskeysockets/baileys')}catch(e){setStatus('Gagal memuat Baileys',e.message);log('Install dependency gagal: '+e.message);return}
 try{const {state,saveCreds}=await Baileys.useMultiFileAuthState(AUTH);
 let version;try{const latest=await Promise.race([Baileys.fetchLatestBaileysVersion(),new Promise((_,reject)=>setTimeout(()=>reject(Error('timeout 8 detik')),8000))]);version=latest.version}catch(e){log('Cek versi WA dilewati: '+e.message)}
 if(myGen!==sesiGen)return;
 const socket=Baileys.default({auth:state,logger:require('pino')({level:'silent'}),printQRInTerminal:false,...(version?{version}:{})});sock=socket;
 socket.ev.on('creds.update',saveCreds);
 socket.ev.on('contacts.upsert',updateContacts);socket.ev.on('contacts.update',updateContacts);
 socket.ev.on('messages.upsert',({messages,type})=>{if(myGen!==sesiGen||type!=='notify')return;for(const m of messages)incoming(m).catch(e=>log('Pesan gagal: '+e.message))});
 socket.ev.on('messages.reaction',items=>{if(myGen!==sesiGen)return;onReaction(items).catch(e=>log('Reaksi gagal: '+e.message))});
 socket.ev.on('connection.update',async u=>{if(myGen!==sesiGen)return;
 if(u.qr){qr=u.qr;qrAt=Date.now();connected=false;setStatus('Perlu scan QR');log('QR tersedia; buka /qr-view pada tab baru')}
 if(u.connection==='open'){const actual=L.cleanNumber(String(socket.user?.id||'').split(':')[0]);const expected=L.cleanNumber(cfg.botNumber);if(actual!==expected){connected=false;qr='';clearReconnect();setStatus('NOMOR WA TIDAK SESUAI',`Tertaut: ${actual||'tidak diketahui'}, wajib: ${expected}. Logout lalu tautkan nomor yang benar.`);log('DITOLAK: nomor WA tertaut tidak sesuai nomor Kospin SMS');return}connected=true;qr='';reconnectAttempt=0;clearReconnect();setStatus('Terhubung ✅');log('WhatsApp terhubung '+(socket.user?.id||''));updateGroups()}
 if(u.connection==='close'){const code=u.lastDisconnect?.error?.output?.statusCode||u.lastDisconnect?.error?.statusCode||0;connected=false;qr='';sock=null;log('Koneksi terputus: '+code);
 if(code===401||code===Baileys.DisconnectReason?.loggedOut){setStatus('Sesi WA logout; login ulang');try{fs.rmSync(AUTH,{recursive:true,force:true})}catch(e){log('Gagal hapus auth: '+e.message)}reconnectAttempt=0}else setStatus('Koneksi terputus, mencoba ulang',String(code));
 reconnectAttempt++;if(reconnectAttempt>5){setStatus('Gagal 5x; klik Mulai Bot untuk mencoba lagi','Koneksi perlu pemeriksaan manual');log('Auto reconnect berhenti setelah 5x');return}
 const delay=[3000,10000,30000,30000,30000][reconnectAttempt-1];clearReconnect();reconnectTimer=setTimeout(()=>{if(myGen!==sesiGen)return;startWhatsApp().catch(e=>log('Rekoneksi: '+e.message))},delay);
 }});
 }catch(e){if(myGen!==sesiGen)return;sock=null;setStatus('Gagal mulai WhatsApp',e.message);log('Start gagal: '+e.stack?.slice(0,600));}
}
async function requestPairing(number){if(!sock||connected)throw Error('Mulai sesi WA dan tunggu QR dahulu');const digits=L.cleanNumber(number);if(!/^\d{10,15}$/.test(digits))throw Error('Nomor WA tidak valid');const code=await sock.requestPairingCode(digits);log('Kode pairing diminta untuk nomor '+digits.slice(0,4)+'***');return code;}
function maintenance(){expire();if(!connected||!sock)return;const now=new Date(),time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Jakarta',hour:'2-digit',minute:'2-digit',hour12:false}).format(now),today=L.dayOf(Date.now()),all=activeRecords();
 if(cfg.rekapEnabled&&time>=cfg.rekapTime){for(const group of new Set(all.filter(p=>L.dayOf(p.createdAt)===today).map(p=>p.group))){const key=group+'|'+today;if(rekapSent[key])continue;rekapSent[key]=true;atomic('data/rekap-sent.json',rekapSent);sock.sendMessage(group,{text:L.renderRekap(all,group,today)}).then(()=>log('Rekap otomatis terkirim '+group)).catch(e=>{delete rekapSent[key];atomic('data/rekap-sent.json',rekapSent);log('Rekap gagal '+e.message)})}}
 if(cfg.reminderEnabled){const hours=cfg.reminderHours*3600000;for(const p of queue){if(p.sending||p.status!=='menunggu'||!U.approvable(p,generatorEntries,uresClaims))continue;const n=Math.floor((Date.now()-p.createdAt)/hours);if(n<1||n<=(p.reminded||0))continue;p.reminded=n;save();sock.sendMessage(p.group,{text:`⏳ PENGINGAT PENGAJUAN\nPengajuan ${p.kode||p.account||p.id} masih menunggu persetujuan pengurus.\nMohon ditindaklanjuti. Terima kasih.`}).catch(e=>log('Pengingat gagal: '+e.message))}}
}
const app=express(),server=http.createServer(app);io=new Server(server);app.disable('x-powered-by');app.use(express.json({limit:'2mb'}));app.use((req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','no-referrer');res.set('X-Frame-Options','SAMEORIGIN');next()});
// The only publicly reachable pages: health and login. No default / public account setup.
app.get('/login',(req,res)=>{if(accounts.session(req.headers.cookie))return res.redirect('/');res.type('html').send(require('./login-page').html(accounts.hasUsers()))});
app.post('/auth/login',(req,res)=>{try{const result=accounts.login(req.body?.username,req.body?.password,req.socket.remoteAddress||'local');
 const secure=req.secure||String(req.headers['x-forwarded-proto']||'').split(',')[0].trim()==='https';
 res.set('Set-Cookie',accounts.cookie(result.sid,secure));res.json({ok:true,user:result.user});}catch(e){res.status(e.status||400).json({ok:false,error:e.message})}});
function authenticate(req,res,next){const found=accounts.session(req.headers.cookie,req.method!=='GET'||req.path==='/');if(!found){if(req.method==='GET'&&(req.path==='/'||req.accepts('html')==='html'&&!req.path.startsWith('/auth/')))return res.redirect('/login');return res.status(401).json({ok:false,error:'Sesi login tidak ada atau kedaluwarsa. Silakan login.'})}
 req.user=found.user;req.session=found.session;
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!accounts.csrfCorrect(req))return res.status(403).json({ok:false,error:'Token keamanan CSRF tidak sesuai. Muat ulang halaman dan login kembali.'});next()}
app.use('/auth',authenticate);
app.post('/auth/keepalive',(req,res)=>res.json({ok:true}));
app.get('/auth/me',(req,res)=>res.json({ok:true,user:req.user,csrfToken:req.session.csrf,roles:ROLES,permissions:PERMISSIONS[req.user.role]}));
app.post('/auth/logout',(req,res)=>{accounts.audit(req.user,'LOGOUT',req.user.username);accounts.logout(req.headers.cookie);res.set('Set-Cookie',accounts.clearCookie());res.json({ok:true})});
app.post('/auth/password',(req,res)=>{try{accounts.changePassword(req.user,req.body?.currentPassword,req.body?.newPassword);res.set('Set-Cookie',accounts.clearCookie());res.json({ok:true,loginRequired:true})}catch(e){res.status(400).json({ok:false,error:e.message})}});
function superOnly(req,res,next){if(req.user.role!=='super_admin')return res.status(403).json({ok:false,error:'Hanya Super Admin yang dapat mengelola akun.'});next()}
app.get('/auth/users',superOnly,(req,res)=>res.json({ok:true,users:accounts.list()}));
app.post('/auth/users',superOnly,(req,res)=>{try{res.status(201).json({ok:true,user:accounts.create(req.user,req.body||{})})}catch(e){res.status(400).json({ok:false,error:e.message})}});
app.patch('/auth/users/:id',superOnly,(req,res)=>{try{res.json({ok:true,user:accounts.update(req.user,req.params.id,req.body||{})})}catch(e){res.status(400).json({ok:false,error:e.message})}});
app.post('/auth/users/:id/reset-password',superOnly,(req,res)=>{try{accounts.reset(req.user,req.params.id,req.body?.password);res.json({ok:true})}catch(e){res.status(400).json({ok:false,error:e.message})}});
app.get('/auth/audit',(req,res)=>{if(!allowed(req.user,'audit.read'))return res.status(403).json({ok:false,error:'Akses audit log ditolak'});res.json({ok:true,entries:accounts.audits.slice(-500).reverse()})});
app.use((req,res,next)=>{
 if(req.path==='/health')return next();
 authenticate(req,res,()=>{
  const permission=permissionFor(req.method,req.path);
  if(permission&&!allowed(req.user,permission))return res.status(403).json({ok:false,error:'Role '+(ROLES[req.user.role]||req.user.role)+' tidak memiliki hak akses untuk tindakan ini.'});next()
 })
});
io.use((socket,next)=>{const sess=accounts.session(socket.request.headers.cookie);if(!sess)return next(Error('Sesi tidak valid'));socket.data.uid=sess.user.id;next()});

function wrap(fn){return (req,res)=>Promise.resolve(fn(req,res)).catch(e=>{log('API '+req.path+': '+e.message);if(!res.headersSent)res.status(e.status||500).json({ok:false,error:e.message})})}
app.get('/health',(req,res)=>res.json({version:L.VERSION,status,connected,uptime:Math.floor(process.uptime())}));app.get('/status',(req,res)=>res.json({status,connected,qrAvailable:allowed(req.user,'bot.manage')&&!!qr,qrAt:allowed(req.user,'bot.manage')?qrAt:0,error:allowed(req.user,'bot.manage')?lastError:'',version:L.VERSION}));
app.get('/stats',(req,res)=>{const a=req.user.role==='maker'?[]:activeRecords(),s=L.dailyStats(a),approval=req.user.role==='maker'?{approvers:0,missingApproverGroups:[]}:L.approverStats(cfg);res.json({...s,...approval,missingApproverGroups:approval.missingApproverGroups.map(id=>groups.get(id)?.subject||id),groups:groups.size})});
app.get('/diagnostics',(req,res)=>res.json({status,error:lastError,connected,sessionGeneration:sesiGen,reconnectionAttempts:reconnectAttempt,oneSession:true,uresOnly:true,registeredGenerator:generatorEntries.length,validPending:queue.filter(p=>U.approvable(p,generatorEntries,uresClaims)).length,orphanedPending:queue.filter(p=>!U.approvable(p,generatorEntries,uresClaims)).length,pending:queue.length,blockedDelivery:queue.filter(p=>p.sending).map(p=>p.id),waUser:sock?.user?.id||null,sheet:syncStatus}));
app.get('/data',(req,res)=>{const maker=req.user.role==='maker',admin=allowed(req.user,'bot.manage');res.json({pending:maker?[]:queue,history:maker?[]:history.slice(-200).reverse(),groups:admin?[...groups].map(([id,g])=>({id,subject:g.subject||id,monitored:isMonitored(id)})):[],logs:admin?logs.slice(0,100):[],syncStatus:admin?syncStatus:'',status,qr:admin&&!!qr,qrAt:admin?qrAt:0})});
app.get('/config',(req,res)=>res.json(cfg));app.post('/config',wrap((req,res)=>{try{cfg=normalizeConfig(req.body||{})}catch(e){e.status=400;throw e}save();accounts.audit(req.user,'UPDATE_CONFIG','bot',Object.keys(req.body||{}).join(','));res.json({ok:true,approvers:cfg.approvers.length,groupApprovers:Object.values(cfg.groupApprovers).reduce((count,list)=>count+(Array.isArray(list)?list.length:0),0)})}));
// Spreadsheet Generator: distinct from WA queue. Saving a draft never authorizes a confirmation.
app.get('/generator/options',(req,res)=>{const all=[...(cfg.approvers||[]),...Object.values(cfg.groupApprovers||{}).flat()];const names=[...new Set(all.map(x=>String(x?.name||'').trim()).filter(Boolean))];res.json({ok:true,sources:SOURCES,approvers:names})});
app.get('/generator',(req,res)=>res.type('html').send(fs.readFileSync(path.join(DIR,'generator-dashboard.html'),'utf8')));
app.get('/generator/template.xlsx',(req,res)=>res.download(path.join(DIR,'templates','Contoh-Spreadsheet-Pengajuan-Pembayaran.xlsx'),'Contoh-Spreadsheet-Pengajuan-Pembayaran.xlsx'));
app.post('/generator/preview',wrap((req,res)=>{let entry;try{entry=G.validate(req.body)}catch(e){e.status=400;throw e}res.json({ok:true,text:G.buildText(entry),total:entry.nominal,count:entry.items.length})}));
app.get('/generator/data',(req,res)=>{const entries=req.user.role==='maker'?generatorEntries.filter(x=>x.createdBy===req.user.id):generatorEntries;const records=allRecords();res.json({ok:true,headers:G.HEADERS,entries:entries.map(x=>({createdAt:x.createdAt,row:G.row(x,records),...G.state(x,records)})).reverse(),summary:G.summary(entries,records,L.dayOf(Date.now()))})});
app.post('/generator/entries',wrap((req,res)=>{
 let entry;try{entry=G.validate(req.body)}catch(e){e.status=400;throw e}
 if(entry.formatVersion!=='professional-v1')return res.status(400).json({ok:false,error:'Gunakan generator format profesional terbaru (Menu 8). Format lama hanya untuk arsip dan antrean sebelum pembaruan.'});
 const idx=generatorEntries.findIndex(x=>x.kode===entry.kode),existing=idx>=0?generatorEntries[idx]:null;
 if(existing&&req.user.role==='maker'&&existing.createdBy!==req.user.id)return res.status(403).json({ok:false,error:'Maker hanya boleh mengubah pengajuan miliknya sendiri. Data lama tanpa pemilik hanya dapat diubah Admin.'});
 const wa=G.matchedCode(entry,allRecords());
 if((wa.length>0||!!uresClaims[entry.kode])&&(!existing||G.COLS.some(k=>JSON.stringify(existing[k])!==JSON.stringify(entry[k]))))return res.status(409).json({ok:false,error:'Kode URES sudah dipakai/terdaftar di WA. Pengajuan yang pernah digunakan tidak dapat diubah.'});
 const record={...entry,createdAt:existing?.createdAt||Date.now(),updatedAt:Date.now(),createdBy:existing?.createdBy||req.user.id,createdByName:existing?.createdByName||req.user.name};
 if(idx>=0)generatorEntries[idx]=record;else generatorEntries.push(record);
 atomic('data/generator-entries.json',generatorEntries);accounts.audit(req.user,existing?'UPDATE_PENGAJUAN':'CREATE_PENGAJUAN',entry.kode);log('Generator '+entry.kode+' disimpan di dashboard (belum tentu dikirim ke WA)');
 syncGeneratorEntry(record);res.json({ok:true,kode:entry.kode,new:idx<0,status:G.state(record,allRecords()).status});
}));
app.get('/generator.csv',(req,res)=>{
 const safe=v=>typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v;
 const records=allRecords(),rows=[G.HEADERS,...generatorEntries.map(x=>G.row(x,records))];
 res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="spreadsheet-generator-kospin.csv"').send(L.csv(rows.map(row=>row.map(safe))));
});
app.get('/generator/details.csv',(req,res)=>{
 const safe=v=>typeof v==='string'&&/^[=+\-@\t\r]/.test(v)?"'"+v:v;
 const visible=req.user.role==='maker'?generatorEntries.filter(x=>x.createdBy===req.user.id):generatorEntries;
 const records=allRecords(),rows=[G.DETAIL_HEADERS,...visible.flatMap(x=>G.detailRows(x,records))];
 res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="rincian-pengajuan-kospin.csv"').send(L.csv(rows.map(r=>r.map(safe))));
});
// Legacy export endpoints remain unchanged for integrations consuming the old column schema.
app.get('/history.csv',(req,res)=>{res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="riwayat-kospin.csv"').send(L.csv([['Tanggal Pengajuan','Grup','Pengirim','No Pengirim','Rekening','Jumlah Item','Status','Disetujui/Diputuskan Oleh','Waktu Keputusan'],...allRecords().map(p=>[...L.rowOf(p).slice(0,4),p.account||'',p.items?.length||0,L.statusDisplay(p),p.decidedBy||'',p.decidedAt?new Date(p.decidedAt).toISOString():''])]))});
app.get('/rekap.csv',(req,res)=>{writeCsv();res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="rekap-pengajuan.csv"').send(fs.readFileSync(path.join(DATA,'rekap-pengajuan.csv')))});
// New human-facing downloads: Excel-compatible CSV plus professionally styled XLSX.
for(const kind of ['history','rekap']){
 app.get(`/laporan/${kind}.csv`,(req,res)=>{
  const payload=REPORT.csv(REPORT.report(allRecords(),kind));
  res.type('text/csv; charset=utf-8').set('Content-Disposition',`attachment; filename="kospin-sms-${kind}-profesional.csv"`).send(payload);
 });
 app.get(`/laporan/${kind}.xlsx`,(req,res)=>{
  const payload=REPORT.xlsx(REPORT.report(allRecords(),kind));
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').set('Content-Disposition',`attachment; filename="kospin-sms-${kind}-profesional.xlsx"`).send(payload);
 });
}
app.post('/start',wrap(async(req,res)=>{log("Tombol 'Mulai Bot' ditekan…");if(!sock){reconnectAttempt=0;await startWhatsApp()}if(lastError&&status.startsWith('Gagal'))return res.status(503).json({ok:false,error:lastError,status});res.json({ok:true,status})}));
app.post('/logout',wrap(async(req,res)=>{await stopSocket();fs.rmSync(AUTH,{recursive:true,force:true});setStatus('Logout; silakan mulai ulang');res.json({ok:true})}));
app.post('/restart-qr',wrap(async(req,res)=>{await stopSocket();fs.rmSync(AUTH,{recursive:true,force:true});reconnectAttempt=0;await startWhatsApp();if(String(req.headers.accept||'').includes('text/html'))return res.redirect(303,'/qr-view');res.json({ok:true,status})}));
app.post('/pairing',wrap(async(req,res)=>res.json({ok:true,code:await requestPairing(req.body.number)})));
app.post('/rekap',wrap(async(req,res)=>{if(!connected||!sock)return res.status(503).json({ok:false,error:'Bot belum terhubung, rekap tidak dapat dikirim'});const all=activeRecords(),day=L.dayOf(Date.now()),affected=new Set(all.filter(p=>L.dayOf(p.createdAt)===day).map(p=>p.group));for(const g of affected)await sock.sendMessage(g,{text:L.renderRekap(all,g,day)});log('Rekap manual terkirim '+affected.size+' grup');res.json({ok:true,groups:affected.size})}));
app.post('/preview',wrap((req,res)=>{const text=String(req.body.text||'');const check=U.validateSubmission(text,generatorEntries,uresClaims,allRecords());res.json({ok:true,isPengajuan:L.isPengajuan(text),eligible:check.ok,registered:check.ok,reason:check.ok?'':check.reason,preview:check.ok?L.formatConfirmation(text,Date.now()):'',tags:L.parseTags(text),kode:L.extractKode(text),...L.itemAmounts(text)})}));
app.post('/paid/:id',wrap((req,res)=>{const p=allRecords().find(x=>x.id===req.params.id);if(!p||p.status!=='dikonfirmasi')return res.status(400).json({ok:false,error:'Hanya DONE boleh ditandai sudah dibayar'});p.paid=req.body.paid===true;p.paidAt=p.paid?Date.now():null;const h=history.find(x=>x.id===p.id);if(h)Object.assign(h,p);save();accounts.audit(req.user,p.paid?'MARK_PAID':'UNMARK_PAID',p.kode||p.id);res.json({ok:true})}));
app.post('/cancel/:id',wrap((req,res)=>{const p=queue.find(x=>x.id===req.params.id);if(!p||p.status!=='menunggu'||p.sending)return res.status(409).json({ok:false,error:'Pengajuan bukan antrean aktif'});p.status='ditolak';p.decidedBy='Operator Panel (pembatalan manual)';p.decidedAt=Date.now();queue=queue.filter(x=>x.id!==p.id);pushHistory(p);save();syncGenerator(p,'DITOLAK');accounts.audit(req.user,'CANCEL_PENGAJUAN',p.kode||p.id);log('Dibatalkan lewat panel: '+p.id);res.json({ok:true})}));
app.post('/confirm/:id',wrap((req,res)=>res.status(403).json({ok:false,error:'Konfirmasi manual tidak dapat melewati IYA/👍 dari pengurus terdaftar. Gunakan pesan setuju dari pengurus di grup, bukan tombol panel.'})));
app.get('/generator-sheets-test',wrap(async(req,res)=>{if(!cfg.generatorUrl)return res.status(400).json({ok:false,error:'URL belum diatur'});const r=await fetch(cfg.generatorUrl+'?action=health',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Health HTTP '+r.status);res.json({ok:true,health:(await r.text()).slice(0,200)})}));
app.post('/generator-sheets-test',wrap(async(req,res)=>{if(!cfg.generatorUrl)return res.status(400).json({ok:false,error:'URL belum diatur'});const r=await fetch(cfg.generatorUrl+'?action=health',{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Health HTTP '+r.status);res.json({ok:true,health:(await r.text()).slice(0,200)})}));
app.get('/qr.png',wrap(async(req,res)=>{if(!qr)return res.status(404).type('text/plain').send('QR belum tersedia');res.type('image/png').send(await QRCode.toBuffer(qr,{errorCorrectionLevel:'M',width:560,margin:2}))}));
app.get('/qr-view',(req,res)=>{res.type('html').send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta http-equiv="refresh" content="5"><meta name="viewport" content="width=device-width, initial-scale=1"><title>QR WhatsApp Kospin SMS</title><style>body{background:#0C2E5B;color:white;display:grid;place-items:center;min-height:90vh;font:17px Arial;text-align:center}img{width:min(94vw,560px);background:white;padding:10px;border-radius:16px}button{padding:12px 20px;background:#0070f0;border:0;border-radius:10px;color:white;font-size:16px}</style></head><body><main><h1>QR WhatsApp Kospin SMS</h1><p>${escapeHtml(status)}</p>${qr?'<img src="/qr.png?t='+qrAt+'" alt="QR untuk ditautkan">':'<p>QR belum tersedia. Halaman otomatis diperbarui.</p>'}<p>Scan sekali melalui WhatsApp → Perangkat Tertaut</p><form method="post" action="/restart-qr"><button>Minta QR Baru</button></form></main></body></html>`)});
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
app.get('/panel-client.js',(req,res)=>res.type('application/javascript').send(fs.readFileSync(path.join(DIR,'panel-client.js'),'utf8')));
app.get('/account-management-client.js',(req,res)=>res.type('application/javascript').send(fs.readFileSync(path.join(DIR,'account-management-client.js'),'utf8')));
app.get('/',(req,res)=>res.type('html').send(require('./panel').html({status,connected,qrAt,version:L.VERSION,escapeHtml})));
server.on('error',e=>{if(e.code==='EADDRINUSE'){console.error('Port '+PORT+' sudah digunakan. BUKA bot yang sedang berjalan; jangan menjalankan bot kedua.');process.exitCode=1}else{console.error(e);process.exitCode=1}});
if(require.main===module){server.listen(PORT,'127.0.0.1',()=>{log('Panel v'+L.VERSION+' di http://localhost:'+PORT+' | 1 sesi aktif — jangan jalankan bot kedua');writeCsv();setInterval(maintenance,60000).unref();setTimeout(()=>startWhatsApp().catch(e=>log(e.message)),500).unref()})}
process.on('unhandledRejection',err=>log('unhandledRejection: '+String(err)));
process.on('uncaughtException',err=>log('uncaughtException: '+String(err)));
module.exports={app,server,normalizeConfig,storeSubmission,allRecords,queue,decide};
