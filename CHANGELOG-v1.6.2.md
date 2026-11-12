# Changelog v1.6.2 — Mode WA hanya URES yang terdaftar di Generator

## Perubahan penting

- Pengajuan WhatsApp diproses **hanya jika berformat resmi Generator Dashboard, mempunyai Kode: URES-..., dan kodenya sudah tersimpan di data/generator-entries.json** melalui Menu 8.
- Teks WA harus cocok dengan teks Generator yang tersimpan (termasuk tanggal, rekening sumber, tujuan, rincian, nominal, dan Menunggu). Perbedaan teks ditolak tanpa balasan WA; alasannya dicatat di Log dashboard.
- Satu URES untuk satu pesan gabungan berisi 1–30 rincian, satu kali persetujuan.
- Duplikasi URES lintas grup dan lintas restart ditahan melalui data/ures-claims.json (data baru, dibuat otomatis saat aplikasi berjalan).
- Kata IYA/TIDAK hanya bekerja untuk antrean yang lolos validasi URES; persetujuan tetap harus dari nomor pengurus terdaftar pada grup terpantau.
- Jika IYA/TIDAK adalah balasan (*reply*) ke pesan tertentu, bot memproses **hanya pengajuan terdaftar yang dikutip**. Jika mengutip pesan lain, tidak ada pengajuan yang dikonfirmasi. Jika tidak mengutip, perilaku antrean FIFO tetap berlaku hanya untuk URES valid.
- Reaksi 👍 hanya dapat menyetujui pesan URES terdaftar yang masih menunggu.
- Rekap dan pengingat WA otomatis hanya menggunakan antrean URES terdaftar. Data lama tetap disimpan untuk audit namun pengajuan lama tanpa URES atau tanpa kecocokan generator tidak dapat disetujui.
- Panel menampilkan keterangan **MODE URES TERDAFTAR SAJA**.
- Generator hanya mengizinkan kode dengan awalan URES-.

## Keamanan & kompatibilitas

- Tidak ada bypass persetujuan. Tidak ada perubahan pada hak akses Management Akun.
- Folder `auth/`, folder `data/`, dan `config.json` lama **jangan dihapus/timpa** saat menerapkan patch.
- Kode yang telah pernah diterima bot **tidak dapat digunakan ulang**, sekalipun riwayat tampilan dibatasi 200 entri.
- Pembuatan draft di generator **tidak otomatis mengirim pesan**. Kirim teks secara manual ke grup yang dipantau setelah menekan tombol SIMPAN.
- Integrasi Google Sheets masih opsional; **hanya data Generator lokal yang menjadi sumber validasi**, bukan sekadar kemunculan kode dalam sheet Google.
- Pesan WhatsApp harus disalin tanpa perubahan. Tag `@Nama` pada teks belum menjadi mention native WhatsApp.

## Validasi

- `npm run check` dan `npm test` dilakukan offline (488 pengujian lulus).
- Scan QR WhatsApp, pengiriman IYA/👍 nyata, dan Google Sheets produksi belum diuji di mesin pengguna.
