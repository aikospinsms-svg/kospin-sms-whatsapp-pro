# Kospin SMS WhatsApp PRO v1.6.1 — Generator Multi-Rincian

- Satu URES = satu pesan WA yang berisi hingga 30 rincian, satu total, dan satu keputusan pengurus.
- Dropdown sumber dana berisi 17 rekening berdasarkan daftar pengguna; tidak mengubah angka rekening atau menambah akunnya secara otomatis.
- Pengurus dari Menu 1 bisa dipilih di generator; nama menjadi teks @Nama, bukan mention native WhatsApp otomatis.
- Parser WA mendeteksi rincian multi, memeriksa jumlah item dan nominal total serta menolak format yang tidak konsisten.
- Duplicate URES di antrean/riwayat diabaikan agar tidak menyebabkan ambigu dalam keputusan.
- Google Sheets Generator memiliki tab Pengajuan utama 15 kolom + tab Rincian Pengajuan 9 kolom per item.
- Export lokal per item: /generator/details.csv. Preview server mencegah ketidaksamaan antara teks final disalin dan disimpan.
- Endpoint daftar sumber/pengurus tidak membocorkan nomor telepon ke Maker; permissions server tetap aktif.
- Login/6 role, approval WA, nomor WhatsApp bot, status DONE/BELUM, folder auth/data/config.json tidak berubah.
- Konfirmasi rekening untuk format generator mengambil nomor dari `Sumber Dana` terlebih dahulu (tidak keliru memilih nomor rekening tujuan yang lebih panjang).
