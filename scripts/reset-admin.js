'use strict';
// Physical machine recovery only: requires local filesystem access and interactive terminal.
const readline=require('node:readline');const path=require('node:path');
const {AuthManager}=require('../auth-manager');const auth=new AuthManager(path.resolve(__dirname,'..'));
const rl=readline.createInterface({input:process.stdin,output:process.stdout,terminal:true});
function ask(prompt,hidden=false){return new Promise(resolve=>{if(hidden){rl.stdoutMuted=true;rl._writeToOutput=function(s){if(this.stdoutMuted){if(s.startsWith(prompt)||s==='\r\n'||s==='\n')this.output.write(s)}else this.output.write(s)}}else rl.stdoutMuted=false;rl.question(prompt,s=>{if(hidden){rl.stdoutMuted=false;process.stdout.write('\n')}resolve(s)})})}
(async()=>{try{const name=await ask('Username Super Admin yang akan di-reset: ');const u=auth.findUsername(name);
 if(!u||u.role!=='super_admin'||!u.active)throw Error('Super Admin aktif tidak ditemukan');const p=await ask('Password baru (min 12, huruf + angka): ',true),c=await ask('Ulangi password: ',true);if(p!==c)throw Error('Password tidak sama');auth.setPassword(u,p);auth.revokeUser(u.id);auth.audit('local-cli','RECOVER_ADMIN',u.username);console.log('Password berhasil direset. Semua sesi akun pada proses ini dicabut.')}
 catch(e){console.error('GAGAL:',e.message);process.exitCode=1}finally{rl.close()}})();
