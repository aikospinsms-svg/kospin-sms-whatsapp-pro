# Kospin SMS WhatsApp PRO v1.6.3 — Generator Profesional

## Perubahan
- Field No. Ref / Token dihapus dari formulir per rincian dan payload pengajuan baru.
- Satu pesan URES menggunakan format profesional: pembuka formal, rincian bernomor, total pembayaran, saldo sesudah, tag pengurus, dan permohonan persetujuan.
- `formatVersion: professional-v1` disimpan pada pengajuan baru sebagai penanda format, sehingga kode URES dan teks WA dibandingkan dengan versi yang tepat.
- Pengajuan yang dibuat sebelum pembaruan tetap menggunakan formatter lama untuk validasi antrean, rekap, dan audit. Tidak ada konversi otomatis yang berisiko membatalkan approval yang masih menunggu.
- Kolom No. Ref pada template/CSV/Google Sheets lama sengaja tidak dihapus; baris baru mengisinya kosong agar tidak memecahkan integrasi dan 15 kolom sebelumnya.
- Backend menolak pembuatan pengajuan baru dengan formatter lama. Daftar 17 rekening, pengurus, login, persetujuan WA, dan filter URES tidak berubah.
- Tidak ada perubahan Apps Script; deployment ulang tidak diperlukan apabila sudah memakai Apps Script v1.6.1 atau terbaru.

## Pengujian
- `npm run check` dan `npm test` diverifikasi offline.
- Pengujian baru mencakup penghapusan No. Ref, format surat profesional, satu dan beberapa rincian, total, hak persetujuan URES terdaftar, perubahan rekening, serta kompatibilitas pengajuan lama.
- WhatsApp, Google Sheets nyata, dan dashboard Windows tetap harus diuji di lingkungan pengguna.
