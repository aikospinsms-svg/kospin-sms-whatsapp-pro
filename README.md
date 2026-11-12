# Kospin SMS WhatsApp Konfirmasi PRO — v1.6.3 (Generator Profesional Tanpa No. Ref)

**Fitur terbaru:** Generator v1.6.3 tanpa input No. Ref / Token, dengan format WhatsApp formal. Satu kode URES untuk beberapa rincian pembayaran dalam **satu pesan WhatsApp**, pilihan tag pengurus dari Menu 1, dropdown 17 rekening sumber dana, laporan utama 15 kolom, dan rincian per item di CSV/Google Sheets.

**Instalasi baru:** gunakan paket FULL; jalankan `SETUP-ADMIN-WINDOWS.bat` sebelum `MULAI-WINDOWS.bat`, lalu login di `http://localhost:3002/login`.

**Upgrade dari v1.6.2:** gunakan ZIP PATCH v1.6.3. Matikan bot, backup aplikasi, salin isi patch (timpa file kode); **jangan hapus** `auth/`, `data/`, dan `config.json`. Akun Super Admin lama tetap berlaku; **tidak perlu membuat akun baru**. Baca `INSTALL-PATCH-v1.6.3.txt`.

## Cara menggunakan Menu 8 — Generator

1. Login sebagai Super Admin, Admin Operasional, atau Maker; buka **Menu 8**.
2. Isi **kode URES**, tanggal, unit, **pilih salah satu dari 17 rekening sumber**, dan saldo sebelum.
3. Masukkan rincian pertama (kategori, keperluan, nominal, tujuan/VA). **Kolom No. Ref / Token sudah dihapus dari Generator.**
4. Klik **+ Tambah Rincian** untuk pembayaran berikutnya (maks. 30 rincian per URES). Perhatikan **Total** dan **Perkiraan Saldo Sesudah**.
5. Centang pengurus yang telah didaftarkan di Menu 1 (tersedia nama dari daftar global dan per-grup). Nama lain bisa diketik, dipisahkan koma. **Pemilihan nama tidak memberikan hak approval otomatis.**
6. Klik **SIMPAN KE SPREADSHEET DASHBOARD** sampai sukses, lalu **SALIN TEKS** atau **KIRIM KE WHATSAPP**. Semua rincian harus masuk dalam **satu pesan ke satu grup rekanan yang dipantau**.
7. Pengurus yang nomor WA-nya terdaftar di grup membalas `IYA` / `ACC` / `OK` atau memberi reaksi 👍 pada pesan pengajuan. Satu persetujuan berlaku untuk seluruh item dalam satu URES. `TIDAK` membatalkan seluruhnya.
8. **TASK SELESAI** menyimpan draft terakhir lalu menaikkan kode URES dan menyiapkan rincian baru; **bukan** tanda setuju atau tanda sudah dibayar.

**Catatan mention:** teks `@Pak Miji` yang dihasilkan generator dan tautan WhatsApp **belum menciptakan mention notifikasi native WhatsApp**. Di grup, pilih kontak pengurus dengan fitur mention WhatsApp bila dibutuhkan, kemudian **pastikan teks hasil kirim tetap cocok dengan teks tersimpan** untuk pencocokan status. Bila WhatsApp mengubah isi teks, dashboard akan menandai `DATA WA BERBEDA — PERIKSA`. Jangan anggap tag teks biasa sebagai bukti pengurus menerima notifikasi.

**Rekening sumber:** penamaan dan angka mengikuti daftar yang Anda berikan; `01.101.00880` (SIP RESTO) sengaja **tidak ditambah angka nol**, karena harus diverifikasi oleh operator sebelum digunakan. Pemilihan sumber dana tidak melakukan transfer.

## Menu 9 — Spreadsheet

- **Tab Pengajuan**: tetap 15 kolom, **satu baris per URES**, nominal merupakan total rincian, daftar keperluan dan tujuan disimpan sebagai gabungan berbaris.
- **Tab Rincian Pengajuan**: satu baris per item, berisi kode, nomor item, kategori, keperluan, nominal, tujuan, sumber dana, dan status. Kolom No. Ref dipertahankan untuk kompatibilitas tetapi kosong untuk data baru.
- Ekspor CSV rekap `http://localhost:3002/generator.csv`; ekspor per item `http://localhost:3002/generator/details.csv`.
- Di Menu 9 ada pencarian, filter status, dan unduh template Excel.
- Status `BELUM TERDETEKSI WA` sampai pesan dicocokkan, kemudian `MENUNGGU`, `DISETUJUI` atau `DITOLAK`. **DISETUJUI ≠ SUDAH DIBAYAR**.
- Jangan kirim dua pesan dengan kode URES yang sama. Beberapa rincian harus berada dalam **satu pengajuan gabungan**. Bot menahan pengajuan berikutnya yang memakai kode sama agar status tidak rancu.

## Google Sheets (Menu 7)

- Google Sheets Rekap tetap menggunakan `APPS-SCRIPT-REKAP.gs` (tidak berubah).
- **Sheet Generator:** Apps Script lama **wajib diganti** dengan `APPS-SCRIPT-GENERATOR-CONTOH.gs` v1.6.1 dan **di-deploy ulang** sebagai Web App. Secret dan URL `/exec` harus sesuai dengan Menu 7.
- Apps Script baru membuat tab `Rincian Pengajuan` jika belum ada. Tab `Pengajuan` harus memiliki 15 header sesuai template.
- **Backup spreadsheet lama terlebih dahulu**. Bila Anda sudah memiliki proyek Apps Script dengan `doGet`/`doPost`, jangan membuat fungsi duplikat; ganti kode generator atau pisahkan project.
- Simpan data ke dashboard lokal tetap bekerja walau Google Sheets belum diatur atau gagal tersinkronisasi. Periksa Log dashboard untuk kegagalan sync.

## Management Akun

Login tersedia pada `http://localhost:3002/login` dengan 6 role: Super Admin, Admin Operasional, Maker, Approver, Accounting, Auditor. Menu 10 untuk mengelola akun. Role Approver dashboard **tidak** memberikan persetujuan; hanya **nomor pengurus WA terdaftar** yang bisa menyetujui pesan.

Sesi `auth/`, file `config.json`, data `data/users.json`, `data/audit-log.json`, dan seluruh CSV berisi data penting — jangan dikirimkan ke pihak lain. Dashboard dapat diakses melalui perangkat yang diizinkan, jangan membuka Cloudflare Tunnel publik sembarangan. Bot memakai Baileys tidak resmi, perubahan WhatsApp bisa memengaruhi operasional.

## Instalasi Windows & Uji

Untuk folder aplikasi `C:\KospinSMS\WhatsApp-Konfirmasi-PRO`:

```bat
cd /d "C:\KospinSMS\WhatsApp-Konfirmasi-PRO"
npm run check
npm test
```

Jika paket Node belum terpasang, jalankan `MULAI-WINDOWS.bat` dengan internet aktif agar dependensi tersedia. Tidak ada sesi WA asli/libsignal yang disertakan dalam ZIP.

**Wajib tes di grup WhatsApp khusus pengujian**: 2 rincian, 1 URES, nominal total benar, nomor pengurus terdaftar membalas IYA, konfirmasi bot 1 kali, rekapan benar, status Google Sheets dan item detail benar. Jangan gunakan rekening/uang produksi untuk tes.

Pengujian kode offline tidak menjamin WhatsApp, browser Windows, dan Apps Script produksi sudah berfungsi. Baca `PANDUAN-MANAGEMENT-AKUN-v1.6.0.md` untuk detail role dan keamanan.

## Pembaruan v1.6.2 — Mode hanya URES dari Generator Dashboard

Mulai versi ini, bot WhatsApp **tidak mengantrekan pengajuan teks bebas**. Pesan hanya diterima bila kodenya diawali `URES-`, sudah disimpan melalui **Menu 8 Generator** di dashboard lokal, dan isi pesannya cocok dengan data tersimpan. URES yang pernah dipakai tidak bisa dipakai ulang, termasuk sesudah bot dimulai ulang. Satu URES berisi 1–30 rincian dan mendapat satu persetujuan dari pengurus terdaftar.

Urutan wajib: **Buat → Simpan Dashboard → Salin teks utuh → Kirim ke grup dipantau → Pengurus reply IYA atau reaksi 👍 → Bot konfirmasi**. Jangan ubah teks sesudah disimpan. Pesan yang diubah, kode asing, atau format lama hanya dicatat di Log tanpa balasan WhatsApp. Google Sheets online tidak menjadi acuan otorisasi; sumbernya adalah data Generator lokal. Detail di `CHANGELOG-v1.6.2.md` dan `INSTALL-PATCH-v1.6.2.txt`.


## Pembaruan v1.6.3 — WhatsApp Profesional dan Tanpa No. Ref / Token

- **Menu 8 Generator**: field No. Ref / Token telah dihapus dari setiap rincian, dan tidak ikut terkirim dalam pesan WA baru.
- Pesan WhatsApp baru selalu menggunakan pembuka formal, satu kode URES, sumber dana, saldo, rincian bernomor, total, estimasi saldo sesudah, tag pengurus, serta kalimat permohonan persetujuan. Tidak ada pembayaran otomatis.
- **Kode lama yang sudah tersimpan tidak diubah**. Bot tetap dapat mencocokkan format lama untuk pengajuan yang masuk sebelum pembaruan. Semua pengajuan baru harus dibuat melalui generator profesional.
- Kolom **No. Ref** tetap ada pada ekspor CSV dan dua tab Google Sheets agar pengaturan sinkronisasi yang sudah ada tidak rusak; nilainya kosong untuk pengajuan baru. **Tidak perlu deploy ulang Apps Script** hanya untuk revisi ini.
- Jika nama pengurus di WhatsApp diubah menjadi mention native atau teks WA diedit, pencocokan ketat dapat menahan pengajuan. Kirim teks persis seperti hasil generator; nama `@` di dalam teks belum tentu menimbulkan notifikasi tag.
- Untuk pembaruan, jangan menghapus `auth/`, `data/`, `config.json`, dan `data/ures-claims.json`. Uji di grup tes sebelum operasional.
