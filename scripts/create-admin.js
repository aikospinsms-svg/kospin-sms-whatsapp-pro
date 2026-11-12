'use strict';
// Run ONLY on the machine holding the bot data. Never ships default credentials.
const readline=require('node:readline');
const {AuthManager}=require('../auth-manager');
const root=require('node:path').resolve(__dirname,'..');
const auth=new AuthManager(root);
if(auth.hasUsers()){console.error('Akun sudah tersedia. Buat akun tambahan melalui Menu 10. Untuk reset lokal, gunakan scripts/reset-admin.js.');process.exit(1)}
const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
function ask(prompt,hidden=false){return new Promise(resolve=>{if(hidden){rl.stdoutMuted=true;rl._writeToOutput=function(s){if(this.stdoutMuted){if(s.startsWith(prompt)||s==='\r\n'||s==='\n')this.output.write(s)}else this.output.write(s)}}else rl.stdoutMuted=false;rl.question(prompt,ans=>{if(hidden){rl.stdoutMuted=false;process.stdout.write('\n')}resolve(ans)})})}
(async()=>{try{
 console.log('=== KOSPIN SMS | Buat Super Admin PERTAMA (lokal) ===');
 const username=await ask('Username (contoh: adminsms): '),name=await ask('Nama lengkap: '),password=await ask('Password (min 12, huruf + angka): ',true),confirm=await ask('Ulangi password: ',true);
 if(password!==confirm)throw Error('Konfirmasi password tidak sama');
 const u=auth.bootstrap({username,name,password});console.log('Akun berhasil dibuat:',u.username,'|',u.role,'\nBuka http://localhost:3002/login');
 }catch(e){console.error('GAGAL:',e.message);process.exitCode=1}finally{rl.close()}})();
