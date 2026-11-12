#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if ! curl -fsS --connect-timeout 2 http://127.0.0.1:3002/status >/dev/null; then
  ./mulai-mac-linux.sh >tools/bot.log 2>&1 &
  ok=0
  for i in $(seq 1 90); do if curl -fsS --connect-timeout 2 http://127.0.0.1:3002/status >/dev/null 2>&1; then ok=1; break; fi; sleep 1; done
  if [ "$ok" -eq 0 ]; then echo 'Bot tidak siap setelah 90 detik'; exit 1; fi
fi
mkdir -p tools
if [ ! -x tools/cloudflared ]; then
  case "$(uname -s):$(uname -m)" in
    Darwin:arm64) url='https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz' ;;
    Darwin:x86_64) url='https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz' ;;
    Linux:x86_64) url='https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64' ;;
    Linux:aarch64) url='https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64' ;;
    *) echo 'Platform tidak didukung; pasang cloudflared resmi secara manual'; exit 1 ;;
  esac
  if [[ "$url" == *.tgz ]]; then curl -fsSL "$url" | tar xz -C tools cloudflared; else curl -fsSL "$url" -o tools/cloudflared; fi
  chmod +x tools/cloudflared
fi
for proto in quic http2; do
  echo "Menjalankan tunnel ($proto)..."
  : > "tools/tunnel-$proto.log"
  tools/cloudflared tunnel --no-autoupdate --protocol "$proto" --url http://localhost:3002 >"tools/tunnel-$proto.log" 2>&1 & pid=$!
  url=''
  for i in $(seq 1 40); do
    url=$(grep -Eo 'https://[a-zA-Z0-9-]+\.trycloudflare\.com' "tools/tunnel-$proto.log" | tail -1 || true)
    [ -n "$url" ] && break
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  if [ -n "$url" ]; then printf '%s\n' "$url" > LINK-PANEL.txt; echo "URL: $url"; echo 'PERINGATAN: Tidak ada login. Jangan sebarkan URL!'; wait "$pid"; exit 0; fi
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
done
exit 1
