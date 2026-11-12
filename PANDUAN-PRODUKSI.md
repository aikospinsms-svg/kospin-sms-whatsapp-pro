# DOKUMEN PANDUAN LAMA (V1.5.13)

**Untuk fitur terbaru v1.6.1, ikuti README.md dan INSTALL-PATCH-v1.6.1.txt.** Versi terbaru sudah menggunakan login dan 6 role; pernyataan lama tentang dashboard tanpa login tidak lagi berlaku.

# Panduan Produksi — Kospin SMS

**Status saat paket dibuat:** parser, generator terpadu, spreadsheet CSV/XLSX template, aturan persetujuan, dan kelengkapan route dites offline. Koneksi WhatsApp sungguhan, reaksi, sinkronisasi Apps Script, QR dan Tunnel belum dapat diverifikasi tanpa komputer serta nomor WA Kospin SMS.

## Checklist persiapan

- Ekstrak ke `C:\KospinSMS\WhatsApp-Konfirmasi-PRO\` dan jalankan `MULAI-WINDOWS.bat`.
- Periksa `/health`, `/diagnostics`, dan versi panel.
- Scan QR melalui **tab baru** `/qr-view`, gunakan nomor bot **628973137777**, jangan scan dari nomor pengurus.
- Cek WA yang ditautkan benar; jika salah, tekan Logout dan scan ulang.
- Masukkan nomor pengurus terdaftar **per grup atau global**, pilih hanya grup tes.
- Simulasikan format lama serta format generator melalui Bagian 4 sebelum tes WA.
- Jalankan 2 pengajuan di satu grup; IYA pertama harus memproses yang paling lama. IYA kedua pengajuan kedua.
- Tes IYA dari nomor **bukan pengurus** harus diabaikan.
- Tes TIDAK dari pengurus, dan reaksi 👍 di pesan pengajuan dari pengurus.
- Tes `RIWAYAT`, CSV, mark SUDAH DIBAYAR, batal tanda, dan rekap manual.
- Jika generator dipakai, validasi status DISETUJUI di baris berkode yang benar dan penyetuju tercatat.
- Jangan gunakan grup rekanan asli sebelum seluruh hasil tes konsisten dan nomor bot cocok.

## Uji generator yang kini menyatu di dashboard

1. Buka `http://localhost:3002/#generator`, isi kode URES unik dan semua kolom wajib, klik **Simpan ke Spreadsheet Dashboard**.
2. Buka bagian 9, pastikan baris muncul dengan status **BELUM TERDETEKSI WA** dan saldo sesudah = saldo sebelum dikurangi nominal.
3. Salin teks, kirim sendiri melalui WhatsApp ke **grup tes yang dipantau**.
4. Setelah pesan grup terdeteksi, status menjadi **MENUNGGU**. Lakukan IYA/👍 pengurus yang sudah terdaftar; harus berubah menjadi **DISETUJUI**.
5. Status **SUDAH DIBAYAR** masih harus ditandai terpisah di panel Riwayat. Jangan menganggap DISETUJUI adalah transfer yang sudah terjadi.
6. Jika Google Sheets digunakan, pasang Apps Script Generator versi paket ini pada spreadsheet yang memiliki tab Pengajuan; atur URL dan secret terpisah di bagian 7. Uji penambahan baris, lalu uji pembaruan status ke baris kode yang sama.
7. Untuk tes Excel lokal, unduh `http://localhost:3002/generator/template.xlsx`; template contoh sengaja kosong. Unduhan CSV pada `/generator.csv` berisi baris yang betul-betul disimpan di dashboard.

## Kenapa reaksi mungkin tidak terdeteksi?

Baileys memakai event `messages.reaction`. Identitas pengirim bisa LID; bot mencoba `participantPn`, `senderPn`, pemetaan kontak, dan data grup. Jika tidak ada identitas yang bisa dipadankan ke daftar pengurus, reaksi **tidak dianggap sah**, demi mencegah persetujuan salah orang. Tambahkan LID yang diketahui secara tepercaya ke daftar pengurus jika perlu.

## Link publik Cloudflare

Jalankan `TUNNEL-WINDOWS.bat` **setelah** bot berjalan. Skrip mencoba QUIC dan fallback HTTP2; bila berhasil URL ditulis ke `LINK-PANEL.txt` dan terbuka di Notepad. Link berubah saat tunnel dijalankan ulang dan berhenti ketika proses tunnel berhenti. **Panel tidak memiliki sandi. Setiap orang yang mengetahui URL dapat melihat/mengubah data; lebih aman tidak membuat tunnel untuk operasi yang menyangkut pengajuan pembayaran.**

## Jika bot tidak menyimpan pengajuan

Periksa grup sudah dicentang, pesan merupakan pengajuan dengan `izin pengajuan pembayaran` atau pola yang didukung, dan sumber/tujuan terkait VA atau Kospin. Pesan transfer bank BCA/Mandiri saja sengaja diabaikan. Jika persetujuan gagal, periksa log nomor pengurus, pemetaan LID dan koneksi WA.

## Jika status `Pengiriman tidak pasti`

**Jangan kirim ulang otomatis.** Lihat pesan di grup WhatsApp lebih dulu. Jika benar-benar tidak terkirim, butuh pemeriksaan admin serta keputusan tindak lanjut yang tidak berisiko menggandakan konfirmasi. Tombol panel tetap tidak bisa mengirim tanpa persetujuan pengurus terdaftar.

## File penting

`config.json` berada di root (bukan data), `data/pending.json` adalah antrean, `data/history.json` riwayat maksimum 200, `data/rekap-pengajuan.csv` rekap lokal, `data/generator-entries.json` pengajuan generator yang tersimpan. File disimpan atomik dengan `.tmp` dan `.bak` sederhana. **Jangan membagikan file auth, config, atau data asli.**

## Mode URES Terdaftar — v1.6.2

Bot sekarang hanya mengirim konfirmasi setelah menerima format Generator Dashboard yang **sudah disimpan lokal** dengan kode `URES-...`, isi teks sama persis, dan persetujuan dari nomor pengurus terdaftar. Satu kode hanya boleh dipakai sekali pada satu pesan gabungan. Kode asing, format teks bebas, perubahan nominal/rekening/tujuan, dan kode ganda diabaikan. Alasan masuk Log. Balasan IYA yang *reply* ke pesan tidak dikenal tidak menyetujui antrean lain. Reaksi 👍 harus dipasang pada pesan URES valid. Data lama disimpan untuk audit tetapi tidak memicu konfirmasi baru. Backup file baru `data/ures-claims.json` setelah bot menjalankan versi ini. Baca `INSTALL-PATCH-v1.6.2.txt`.
