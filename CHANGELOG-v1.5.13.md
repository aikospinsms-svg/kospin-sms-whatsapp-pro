# Perubahan 1.5.13-PRO — Generator & Spreadsheet Dashboard

- Bagian 8: Generator HTML pengguna terintegrasi, simpan lokal, salin, buka WhatsApp, task selesai dan kode berurutan.
- Bagian 9: Tabel 15 kolom sesuai Excel, pencarian, filter status, ringkasan harian, unduh CSV dan template Excel kosong.
- Data generator tersimpan atomik di `data/generator-entries.json`, terpisah dari queue persetujuan dan CSV bot utama.
- Status di spreadsheet dibaca dari rekaman pesan WA bot berdasarkan Kode unik, tidak berubah hanya karena disimpan.
- Google Apps Script Generator kini mendukung `upsertPengajuan` + `updateStatus`. Ganti script lama dan deploy ulang bila menggunakan fitur ini.
- Template Excel bersih berisi 4 tab, tanpa contoh nomor rekening atau nominal.
- 399 tes Node offline PASS; periksa koneksi WA/Google Sheets secara langsung sebelum produksi.

**Penting:** Panel tetap tidak mempunyai autentikasi karena mengikuti spesifikasi, sehingga jangan mempublikasikannya melalui tunnel tanpa kontrol akses eksternal.
