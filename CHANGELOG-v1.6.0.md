# v1.6.0 — RBAC / Management Akun

- Dashboard login, pembuatan Super Admin melalui CLI lokal, tanpa credential bawaan.
- 6 role; izin diverifikasi di server untuk konfigurasi, generator, pembayaran, ekspor, dan pembatalan.
- Menu 10 Management Akun; audit log; perubahan / reset password; logout dashboard independen dari WA.
- Cookie HttpOnly+SameSite Strict; token CSRF pada semua mutasi; pembatasan percobaan login; sesi idle.
- Maker hanya melihat entri generator yang dibuatnya, dan data lama tanpa pemilik tidak dipaksakan ke akun baru.
- Data lama, koneksi Google Sheets, Baileys, antrean FIFO, aturan IYA/👍, dan status DONE/BELUM dipertahankan.
- Panel v1.5.14 adalah basis upgrade. Paket patch tidak berisi data pribadi atau session WhatsApp.
- Catatan: tes offline berhasil, server/WA nyata belum diverifikasi.
