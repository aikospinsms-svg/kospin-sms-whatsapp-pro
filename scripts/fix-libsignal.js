'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'..'),installed=path.join(root,'node_modules','libsignal'),vendor=path.join(root,'vendor','libsignal');
function copy(from,to){fs.mkdirSync(to,{recursive:true});for(const entry of fs.readdirSync(from,{withFileTypes:true})){if(['node_modules','.git'].includes(entry.name))continue;const s=path.join(from,entry.name),d=path.join(to,entry.name);if(entry.isFile())fs.copyFileSync(s,d);else if(entry.isDirectory())copy(s,d)}}
try{
 if(fs.existsSync(path.join(vendor,'package.json'))){fs.rmSync(installed,{recursive:true,force:true});copy(vendor,installed)}
 else if(fs.existsSync(path.join(installed,'package.json'))){copy(installed,vendor);console.log('libsignal asli terpasang dari registry NPM, disalin ke vendor/libsignal untuk restart berikutnya.')}
 else throw Error('libsignal belum tersedia. Jalankan npm install dari direktori ini (butuh internet). Jangan mengisi folder vendor dengan stub atau kunci sesi.');
 const lib=require.resolve('libsignal',{paths:[root]});if(!lib)throw Error('Tidak dapat menemukan libsignal');
 require(path.join(root,'node_modules','@whiskeysockets','baileys'));
 console.log('libsignal OK — Baileys bisa dimuat.');
}catch(e){console.error('GAGAL memeriksa libsignal/Baileys: '+e.message);process.exitCode=1}
