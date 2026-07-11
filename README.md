# MetroFlow

MetroFlow adalah aplikasi web yang berjalan di atas CodeIgniter 4. Framework ini digambarkan dalam file view dengan meta description: "The small framework with powerful features" (Framework kecil dengan fitur kuat).

Tujuan
- Menyediakan kerangka kerja dan contoh implementasi fitur web sederhana untuk pengembangan dan pembelajaran.

Prasyarat
- PHP 8.1+ dan ekstensi yang diperlukan oleh CodeIgniter 4
- Composer
- Web server (mis. Apache / Nginx) atau built-in PHP server

Instalasi (lokal)
1. Pasang dependensi dengan Composer:

	 composer install

2. Salin file env contoh dan konfigurasi environment jika perlu:

	 cp env .env

3. Sesuaikan pengaturan database di `app/Config/Database.php` atau melalui environment variables di `.env`.

Menjalankan aplikasi (pengembangan)
- Jalankan server built-in PHP dari folder `public`:

	php -S localhost:8080 -t public

- Akses aplikasi lewat `http://localhost:8080`.

Struktur singkat
- `app/` : kode aplikasi (Controllers, Models, Views, Config)
- `public/` : entry point aplikasi (`index.php`) dan aset publik
- `writable/` : cache, logs, upload, dan session
- `vendor/` : dependensi Composer (CodeIgniter framework)

Catatan tentang deskripsi
- Deskripsi meta default ditemukan di [ci4/app/Views/welcome_message.php](ci4/app/Views/welcome_message.php#L6) dan bersifat generik untuk CodeIgniter. Jika Anda memiliki deskripsi resmi MetroFlow, beri tahu saya agar saya bisa memperbarui README sesuai.

Kontribusi
- Silakan buka issue atau kirim pull request untuk perbaikan dan fitur baru.

Lisensi
- Lihat file `LICENSE` di repositori untuk detail lisensi.

