$ErrorActionPreference='Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$bin=Join-Path (Get-Location) 'tools\cloudflared.exe'
$uri='http://127.0.0.1:3002/status'
try {$null=Invoke-RestMethod -Uri $uri -TimeoutSec 2} catch {
 Write-Host 'Bot belum aktif. Menyalakan bot dalam jendela baru...'
 Start-Process -FilePath 'cmd.exe' -ArgumentList '/k','MULAI-WINDOWS.bat' -WorkingDirectory (Get-Location)
 $ready=$false
 for($i=0;$i -lt 90;$i++){Start-Sleep -Seconds 1;try {$null=Invoke-RestMethod -Uri $uri -TimeoutSec 2;$ready=$true;break}catch{}}
 if(-not $ready){Write-Error 'Bot tidak siap setelah 90 detik';exit 1}
}
if(-not (Test-Path $bin)){
 Write-Host 'Mengunduh Cloudflared resmi...'
 Invoke-WebRequest -Uri 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile $bin
}
function Start-Tunnel([string]$proto){
 $log=Join-Path (Get-Location) "tools\tunnel-$proto.log"
 $err=Join-Path (Get-Location) "tools\tunnel-$proto.err"
 Remove-Item $log,$err -ErrorAction SilentlyContinue
 $p=Start-Process -FilePath $bin -ArgumentList @('tunnel','--no-autoupdate','--protocol',$proto,'--url','http://localhost:3002') -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
 $url=$null
 for($i=0;$i -lt 40;$i++){
  Start-Sleep -Seconds 1
  $joined=((Get-Content $log -Raw -ErrorAction SilentlyContinue)+' '+(Get-Content $err -Raw -ErrorAction SilentlyContinue))
  $found=[regex]::Matches($joined,'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
  if($found.Count -gt 0){$url=$found[$found.Count-1].Value;break}
  if($p.HasExited){break}
 }
 if($url){$url | Set-Content -Encoding UTF8 'LINK-PANEL.txt';Write-Host "LINK PANEL PUBLIK: $url";Start-Process notepad.exe 'LINK-PANEL.txt';Write-Host 'JANGAN BAGIKAN LINK. Panel belum dilindungi password.';$p.WaitForExit();return $true}
 Write-Host "Gagal mendapatkan URL dari protokol $proto"
 if(-not $p.HasExited){$p.Kill()}
 return $false
}
if(-not (Start-Tunnel 'quic')){if(-not (Start-Tunnel 'http2')){exit 1}}
