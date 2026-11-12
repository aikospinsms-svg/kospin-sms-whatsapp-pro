'use strict';
// Local dashboard accounts: no default credentials, no public first-run setup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROLES = Object.freeze({
  super_admin:'Super Admin', admin_operasional:'Admin Operasional',
  maker:'Maker / Staff', approver:'Pengurus / Approver',
  accounting:'Accounting / Finance', auditor:'Auditor / Viewer'
});
const PERMISSIONS = Object.freeze({
  super_admin:['*'],
  admin_operasional:['bot.manage','config.manage','submission.read','submission.create','submission.cancel','report.export','preview'],
  maker:['submission.create','submission.own','preview'],
  approver:['submission.read','report.export'],
  accounting:['submission.read','payment.manage','report.export'],
  auditor:['submission.read','report.export','audit.read']
});
const COOKIE='ksms_sid', IDLE=30*60*1000, MAX=12*60*60*1000;
function atomic(file, data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),{encoding:'utf8',mode:0o600});fs.renameSync(tmp,file);try{fs.chmodSync(file,0o600)}catch{}}
function safe(v){return {id:v.id,username:v.username,name:v.name,role:v.role,active:v.active,createdAt:v.createdAt,updatedAt:v.updatedAt,lastLogin:v.lastLogin||null};}
function hashPassword(password,salt){return crypto.scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex')}
function validatePassword(p){if(typeof p!=='string'||p.length<12||p.length>128||!/[A-Za-z]/.test(p)||!/[0-9]/.test(p))throw Error('Password minimal 12 karakter, terdiri dari huruf dan angka (maksimal 128).')}
function allowed(user,permission){const list=PERMISSIONS[user?.role]||[];return !!user?.active&&(list.includes('*')||list.includes(permission))}
function getCookies(header=''){const cookies={};for(const chunk of String(header).split(';')){const n=chunk.indexOf('=');if(n>0)cookies[chunk.slice(0,n).trim()]=chunk.slice(n+1).trim()}return cookies}
class AuthManager{
 constructor(root){this.usersFile=path.join(root,'data','users.json');this.auditFile=path.join(root,'data','audit-log.json');this.users=this.load(this.usersFile,[]);this.audits=this.load(this.auditFile,[]);this.sessions=new Map();this.loginAttempts=new Map();}
 load(file,otherwise){try{const result=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(result)?result:otherwise}catch{return otherwise}}
 save(){atomic(this.usersFile,this.users)}
 audit(actor,action,target='',details=''){this.audits.push({time:new Date().toISOString(),actor:actor?.username||actor||'system',action,target:String(target).slice(0,120),details:String(details).slice(0,250)});this.audits=this.audits.slice(-3000);atomic(this.auditFile,this.audits)}
 hasUsers(){return this.users.length>0}
 _newUser({username,name,role,password}){
  username=String(username||'').trim().toLowerCase();name=String(name||'').trim();
  if(!/^[a-z][a-z0-9_.-]{2,31}$/.test(username))throw Error('Username harus 3–32 karakter: huruf kecil, angka, titik, _ atau -.');
  if(name.length<2||name.length>100)throw Error('Nama harus 2–100 karakter');
  if(!ROLES[role])throw Error('Role tidak dikenal');
  if(this.users.some(u=>u.username===username))throw Error('Username sudah dipakai');
  validatePassword(password);const salt=crypto.randomBytes(24).toString('hex');const now=new Date().toISOString();
  return {id:crypto.randomUUID(),username,name,role,active:true,salt,passwordHash:hashPassword(password,salt),createdAt:now,updatedAt:now,pwChangedAt:now};
 }
 bootstrap(params){if(this.hasUsers())throw Error('Super Admin awal sudah tersedia; gunakan Management Akun.');const u=this._newUser({...params,role:'super_admin'});this.users.push(u);this.save();this.audit('local-cli','BOOTSTRAP_ADMIN',u.username);return safe(u)}
 create(actor,params){if(!allowed(actor,'*')&&actor?.role!=='super_admin')throw Error('Akses ditolak');const u=this._newUser(params);this.users.push(u);this.save();this.audit(actor,'CREATE_USER',u.username,u.role);return safe(u)}
 list(){return this.users.map(safe)}
 find(id){return this.users.find(u=>u.id===id)}
 findUsername(n){return this.users.find(u=>u.username===String(n||'').trim().toLowerCase())}
 update(actor,id,patch){if(actor?.role!=='super_admin')throw Error('Akses ditolak');const u=this.find(id);if(!u)throw Error('Akun tidak ditemukan');
  const name=patch.name!==undefined?String(patch.name).trim():u.name;
  if(name.length<2||name.length>100)throw Error('Nama harus 2–100 karakter');
  const role=patch.role!==undefined?patch.role:u.role;
  if(!ROLES[role])throw Error('Role tidak dikenal');
  if(patch.active!==undefined&&typeof patch.active!=='boolean')throw Error('Status aktif harus boolean');
  const active=patch.active===undefined?u.active:patch.active;
  if(u.id===actor.id&&(!active||role!=='super_admin'))throw Error('Tidak bisa menonaktifkan atau menurunkan role akun sendiri');
  if(u.role==='super_admin'&&(!active||role!=='super_admin')&&this.users.filter(x=>x.active&&x.role==='super_admin').length<=1)throw Error('Super Admin aktif terakhir tidak boleh dinonaktifkan');
  const oldRole=u.role;u.name=name;u.role=role;u.active=active;u.updatedAt=new Date().toISOString();this.save();
  if(!active||role!==oldRole)this.revokeUser(u.id);
  this.audit(actor,'UPDATE_USER',u.username,`${role}; aktif=${active}`);return safe(u);
 }
 reset(actor,id,password){if(actor?.role!=='super_admin')throw Error('Akses ditolak');const u=this.find(id);if(!u)throw Error('Akun tidak ditemukan');this.setPassword(u,password);this.revokeUser(u.id);this.audit(actor,'RESET_PASSWORD',u.username);return true}
 setPassword(user,password){validatePassword(password);user.salt=crypto.randomBytes(24).toString('hex');user.passwordHash=hashPassword(password,user.salt);user.pwChangedAt=new Date().toISOString();user.updatedAt=user.pwChangedAt;this.save();}
 changePassword(user,current,next){if(!this.verify(user,current))throw Error('Password saat ini salah');this.setPassword(user,next);this.revokeUser(user.id);this.audit(user,'CHANGE_PASSWORD',user.username)}
 verify(user,password){if(!user||typeof password!=='string'||!user.salt||!user.passwordHash)return false;const actual=hashPassword(password,user.salt);return crypto.timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(user.passwordHash,'hex'))}
 login(username,password,key='local'){
  const k=String(key).slice(0,140);const now=Date.now();const old=this.loginAttempts.get(k)||{count:0,until:0};
  if(old.until>now)throw Object.assign(Error('Terlalu banyak percobaan. Coba lagi setelah 15 menit.'),{status:429});
  const user=this.findUsername(username);let valid=false;try{valid=!!user?.active&&this.verify(user,password)}catch{}
  if(!valid){const count=old.count+1;this.loginAttempts.set(k,{count:count>=5?0:count,until:count>=5?now+15*60*1000:0});this.audit('unauthenticated','LOGIN_FAILED',String(username||'').slice(0,32));throw Object.assign(Error('Username atau password salah'),{status:401})}
  this.loginAttempts.delete(k);const sid=crypto.randomBytes(32).toString('base64url'),csrf=crypto.randomBytes(32).toString('base64url');
  const session={uid:user.id,csrf,created:now,lastSeen:now};this.sessions.set(crypto.createHash('sha256').update(sid).digest('hex'),session);
  user.lastLogin=new Date(now).toISOString();this.save();this.audit(user,'LOGIN',user.username);return {sid,csrf,user:safe(user)};
 }
 session(header,touch=false){const sid=getCookies(header)[COOKIE];if(!sid||sid.length>200)return null;const key=crypto.createHash('sha256').update(sid).digest('hex');const s=this.sessions.get(key);if(!s)return null;
  const now=Date.now(),user=this.find(s.uid);if(!user?.active||now-s.lastSeen>IDLE||now-s.created>MAX){this.sessions.delete(key);return null} if(touch)s.lastSeen=now;return {session:s,user:safe(user),sidKey:key};}
 logout(header){const sid=getCookies(header)[COOKIE];if(sid)this.sessions.delete(crypto.createHash('sha256').update(sid).digest('hex'))}
 revokeUser(uid){for(const [key,s]of this.sessions)if(s.uid===uid)this.sessions.delete(key)}
 cookie(sid,secure=false){return `${COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(MAX/1000)}${secure?'; Secure':''}`}
 clearCookie(){return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`}
 csrfCorrect(req){const token=req.headers['x-csrf-token'];const a=Buffer.from(String(token||'')),b=Buffer.from(String(req.session?.csrf||''));return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b)}
}
module.exports={AuthManager,ROLES,PERMISSIONS,COOKIE,allowed,safe};
