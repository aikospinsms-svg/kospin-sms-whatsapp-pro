# Kospin SMS — Panduan Management Akun v1.6.0

## Apa yang baru

Menambahkan **Menu 10 — Management Akun** ke WhatsApp Konfirmasi PRO, login dashboard, 6 role, pengaturan pengguna, reset password, audit log, proteksi route server, CSRF, session cookie HttpOnly + SameSite Strict, rate limit login, dan pembatasan data Maker hanya untuk pengajuan miliknya.

Tidak ada password bawaan. **Persetujuan WA tetap membutuhkan IYA / 👍 dari nomor pengurus yang terdaftar di Menu 1**. Role Approver pada dashboard TIDAK menggantikan persetujuan WA dan tidak memungkinkan persetujuan melalui tombol panel.

## Sebelum upgrade — wajib backup

1. **Matikan jendela bot** sebelum menyalin file patch. Jangan Logout WhatsApp.
2. Simpan salinan folder aplikasi lama, khususnya `auth/`, `data/`, dan `config.json`.
3. Ekstrak ZIP patch, salin folder/file patch ke folder aplikasi yang berisi `index.js`, dan izinkan **Replace/Timpa**.
4. **JANGAN menyalin** contoh `config.json` dari ZIP full ke aplikasi lama. Patch hanya memuat kode, tidak membawa config atau data lama.
5. Pastikan struktur tetap sama dan `SETUP-ADMIN-WINDOWS.bat` sejajar dengan `index.js`.

## Instalasi pertama dan akun Super Admin

1. Pada Windows Explorer buka folder aplikasi yang berisi `index.js` (misalnya `C:\KospinSMS\WhatsApp-Konfirmasi-PRO\`).
2. Jalankan **`SETUP-ADMIN-WINDOWS.bat`** **saat bot dalam keadaan mati**. Isi username, nama lengkap, dan password baru dua kali.
3. Syarat username 3–32 karakter (huruf kecil, angka, titik, `_`, `-`), dimulai huruf. Password min. **12 karakter mengandung huruf dan angka**, maksimal 128 karakter. Gunakan password unik yang lebih kuat.
4. Super Admin pertama tersimpan lokal sebagai `data/users.json` (password dalam bentuk scrypt hash bersalt) dan `data/audit-log.json`.
5. **Baru jalankan** `MULAI-WINDOWS.bat` dan buka `http://localhost:3002/login`, login dengan akun yang dibuat.
6. Buka **Menu 10**, buat akun lain sesuai role. Tidak perlu membuat akun tambahan untuk nomor WA bot; role dashboard dan nomor pengurus WA adalah dua sistem terpisah.

**Jika bot terlanjur dijalankan sebelum Super Admin dibuat, matikan dan jalankan ulang bot setelah menjalankan setup.** Akun baru dibaca saat proses server mulai. Tidak ada menu setup publik melalui browser.

## Enam role dan wewenangnya

| Role | Aktivitas dashboard |
|---|---|
| Super Admin | Semua menu, mengatur akun dan akses, konfigurasi, konfirmasi tetap hanya melalui WA, audit |
| Admin Operasional | Pengaturan bot, pengurus/grup, Google Sheets, antrean, generator, pembatalan, ekspor |
| Maker / Staff | Membuat pengajuan dan melihat catatan generator miliknya sendiri; tak bisa membatalkan atau menandai pembayaran |
| Pengurus / Approver | Melihat pengajuan, riwayat, ekspor; menyetujui **hanya melalui WA terdaftar** |
| Accounting / Finance | Membaca pengajuan dan menandai **SUDAH DIBAYAR** setelah status DONE, ekspor |
| Auditor / Viewer | Membaca laporan, ekspor dan audit log; tanpa akses mengubah data |

Tidak ada opsi persetujuan lewat dashboard. Tindakan `POST /confirm/:id` ditolak server.

## Menu 10 — Management Akun

- Tambah akun: username, nama, role, password sementara (min 12 karakter).
- Ubah akun: nama, role, aktif/nonaktif. Tidak dapat mematikan Super Admin aktif terakhir, atau menurunkan role akun Super Admin sendiri.
- Reset password: Super Admin menulis password baru; session login akun tersebut dicabut (pengguna wajib login lagi).
- Pengguna dapat mengubah password sendiri dari header dashboard.
- Logout dashboard **tidak** sama dengan Logout WA dan **tidak** memutus koneksi bot WhatsApp.
- Audit mencatat login, login gagal, perubahan akun, konfigurasi, generator, keputusan WA, pembatalan, pembayaran.
- Pengajuan generator lama (sebelum v1.6.0) tidak mempunyai pemilik akun, maka hanya terlihat oleh Admin/Pengurus/Accounting/Auditor, **bukan Maker baru**. Pengajuan lama tidak diubah/diklaim otomatis.

## Penyimpanan, sesi, dan keamanan

- `data/users.json`: daftar akun dan hash password, **jangan dibagikan**.
- `data/audit-log.json`: audit terbaru, maks. 3.000 catatan. File CSV asli dan sesi WA tetap pada lokasi lama.
- Sesi login tersimpan dalam memori server. Restart bot mengharuskan login kembali. Sesi idle 30 menit atau maksimal 12 jam (jika terdeteksi interaksi pengguna), polling otomatis tidak memperpanjang idle.
- Login dikunci sementara setelah 5 kegagalan dari alamat koneksi yang sama selama 15 menit.
- Akun baru harus dibuat oleh Super Admin; tidak ada akun demo, password bawaan, atau setup pengguna anonim.
- Untuk lupa password Super Admin, **matikan bot**, jalankan `RESET-ADMIN-WINDOWS.bat` pada komputer lokal, lalu nyalakan bot kembali.
- Gunakan Windows account / folder ACL yang dibatasi hanya operator tepercaya, terutama folder `auth/`, `data/` dan `config.json`.
- Jangan membuka tunnel ke publik sebelum memastikan HTTPS berfungsi dan admin memahami risiko jaringan publik. Login web saja bukan pengganti pengamanan perangkat dan akses jaringan.
- Hindari browser bersama; generator mempertahankan pilihan di localStorage dengan prefix per akun pada perangkat tersebut. Informasi yang sangat sensitif sebaiknya tidak disimpan di browser umum.

## Saran tes setelah update

1. Login Super Admin, buat 1 akun Maker, 1 Accounting, 1 Auditor dan 1 Approver dummy.
2. Coba login Maker: hanya pengajuan yang dibuat akun itu sendiri yang terlihat; `/config` harus mengembalikan HTTP 403.
3. Coba login Accounting: tindakan pembayaran hanya boleh pada pengajuan dengan status DONE; buat pengajuan dummy di grup tes untuk pengujian.
4. Coba akun Auditor: tidak bisa POST `/config` atau mengubah pembayaran.
5. Ubah role Maker menjadi Accounting dari Super Admin: sesi lamanya harus tidak berlaku.
6. Reset password salah satu akun: password lama tidak bisa login.
7. Uji status dan konfirmasi real via WhatsApp di **grup tes**, bukan grup pembayaran nyata.
8. Periksa audit log merekam tindakan-tindakan tadi.

## Status pengujian

Pengujian offline (`node --test test-*.js`) dan syntax check lulus; **belum ada tes integrasi WhatsApp/Browser Windows/Google Sheets nyata dalam sandbox ini**. npm install tidak berhasil diselesaikan dalam lingkungan tes, jadi server Express belum dijalankan di sini. Perlu pengujian end-to-end di komputer user sebelum digunakan operasional.
