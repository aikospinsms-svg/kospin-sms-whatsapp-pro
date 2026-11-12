#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if curl -fsS --connect-timeout 2 http://127.0.0.1:3002/health >/dev/null 2>&1; then echo 'Bot sudah berjalan; jangan menjalankan dua sesi.'; exit 0; fi
command -v node >/dev/null || { echo 'Node.js belum terpasang'; exit 1; }
[ -d node_modules ] || npm install
node scripts/fix-libsignal.js
exec node index.js
