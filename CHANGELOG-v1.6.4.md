# Perubahan v1.6.4 — Ekspor Riwayat & Rekap Profesional

- Menu 5 Riwayat: pemisahan filter/pencarian dan tombol ekspor, empat opsi unduhan.
- Baru: `/laporan/history.csv` dan `/laporan/rekap.csv` memakai titik koma agar kompatibel dengan pengaturan Excel Indonesia, UTF-8 BOM, pelindung formula CSV, 15–16 kolom standar, tanggal WIB, status DONE dan status bayar yang berbeda.
- Baru: `/laporan/history.xlsx` dan `/laporan/rekap.xlsx` dengan judul, ringkasan, desain korporat biru, kolom numerik dan tanggal, nomor rekening sebagai teks, filter dan freeze header, tanpa dependensi eksternal.
- Status historis Rp0 tidak dimanipulasi, melainkan ditandai perlu pemeriksaan.
- Pertahankan endpoint lama `/history.csv` dan `/rekap.csv`, file internal `data/rekap-pengajuan.csv`, sinkronisasi Google Sheets, login/role, generator URES, dan antrean persetujuan.
- Proteksi ekspor pada endpoint baru tetap melalui permission `report.export` di server.
- Tambahan `test-report-profesional.js`.
