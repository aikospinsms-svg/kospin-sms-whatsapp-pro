# Panduan Upload GitHub — Kospin SMS PRO v1.6.4

## Rekomendasi repository
Buat repository **Private**. Source ini menyertakan daftar rekening `source-accounts.js` dan integrasi internal yang tidak cocok dipublikasikan.

## Upload via browser
1. Buat repository Private di https://github.com/new (jangan pilih Add README).
2. Ekstrak ZIP GitHub-Ready.
3. Pada repository baru, klik **uploading an existing file** atau **Add file > Upload files**.
4. **Pilih seluruh isi folder hasil ekstrak** (file .js/.html/.gs/.bat/.sh, folder scripts, vendor/README, serta `.gitignore`), bukan file ZIP saja.
5. Pastikan **tidak ada** `auth/`, `data/`, `config.json`, `.env`, `node_modules/`, token, atau password.
6. Commit dengan pesan `Initial source v1.6.4`.

## Install pada PC Windows baru
Clone/download repo, jalankan `npm install`, kemudian `SETUP-ADMIN-WINDOWS.bat` (pertama kali), lalu `MULAI-WINDOWS.bat`. Folder data dan config akan dibuat lokal saat diperlukan. Proses WA harus dihubungkan lewat QR di perangkat yang berwenang.

## Peringatan
- `.gitignore` tidak menyaring file saat upload langsung via browser.
- `source-accounts.js` berisi nomor rekening. **Jangan ubah repository ke Public** tanpa menghapus dan meninjau ulang semua data sensitif.
- Tidak ada sesi WhatsApp, data transaksi, atau akun pengguna pada paket ini.
- Aplikasi hanya source code; GitHub **tidak otomatis menjalankan bot**. Menjalankan bot memerlukan PC/server yang aktif dan koneksi WhatsApp.
- Jika sebelumnya pernah terlanjur mengunggah secret, menghapus file dari versi terbaru saja tidak cukup: secret harus dirotasi dan riwayat Git ditangani.
