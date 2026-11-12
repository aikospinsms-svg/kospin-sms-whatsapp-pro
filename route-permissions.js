'use strict';
// Only mapped routes may perform privileged operations. All other routes still require login.
const rules=[
 ['GET',/^\/config$/,'config.manage'],['POST',/^\/config$/,'config.manage'],
 ['GET',/^\/diagnostics$/,'bot.manage'],['GET',/^\/qr-view$/,'bot.manage'],['GET',/^\/qr\.png$/,'bot.manage'],
 ['GET',/^\/generator$/,'submission.create'],['GET',/^\/generator\/template\.xlsx$/,'submission.create'],
 ['POST',/^\/generator\/entries$/,'submission.create'],['POST',/^\/generator\/preview$/,'submission.create'],['GET',/^\/generator\/options$/,'submission.create'],
 ['GET',/^\/generator\.csv$/,'report.export'],['GET',/^\/generator\/details\.csv$/,'report.export'],['GET',/^\/history\.csv$/,'report.export'],['GET',/^\/rekap\.csv$/,'report.export'],['GET',/^\/laporan\/(?:history|rekap)\.(?:csv|xlsx)$/,'report.export'],
 ['POST',/^\/(?:start|logout|restart-qr|pairing|rekap)$/,'bot.manage'],
 ['POST',/^\/preview$/,'preview'],['POST',/^\/paid\/[^/]+$/,'payment.manage'],['POST',/^\/cancel\/[^/]+$/,'submission.cancel'],
 ['GET',/^\/generator-sheets-test$/,'config.manage'],['POST',/^\/generator-sheets-test$/,'config.manage']
];
function permissionFor(method,path){const item=rules.find(([m,regex])=>m===String(method).toUpperCase()&&regex.test(path));return item?item[2]:null}
module.exports={permissionFor};
