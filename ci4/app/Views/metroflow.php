<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MetroFlow — Visualisasi Pencarian Rute Terpendek</title>
    <meta name="description" content="Aplikasi interaktif untuk mendesain jaringan transit dan memvisualisasikan algoritma pencarian rute terpendek Dijkstra & BFS.">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="<?= base_url('css/metroflow.css') ?>">
</head>
<body>
<div class="app-container">

    <!-- ================================= SIDEBAR ================================= -->
    <aside class="sidebar">
        <div class="brand">
            <i class="fa-solid fa-train-subway brand-icon"></i>
            <h1>Metro<span>Flow</span></h1>
            <button id="btn-help" class="btn-help-trigger" title="Buka Panduan Penggunaan">
                <i class="fa-solid fa-circle-question"></i>
            </button>
        </div>

        <!-- Manajemen Peta -->
        <section class="panel-section">
            <h2><i class="fa-solid fa-map"></i> Manajemen Peta</h2>
            <div class="form-group">
                <label for="map-selector">Pilih Peta:</label>
                <div class="select-wrapper">
                    <select id="map-selector"><option value="">Memuat peta...</option></select>
                </div>
            </div>
            <div class="button-row">
                <button id="btn-save-map" class="btn btn-primary btn-sm"><i class="fa-solid fa-floppy-disk"></i> Simpan</button>
                <button id="btn-new-map" class="btn btn-outline btn-sm"><i class="fa-solid fa-plus"></i> Baru</button>
                <button id="btn-delete-map" class="btn btn-danger btn-sm"><i class="fa-solid fa-trash"></i> Hapus</button>
            </div>
        </section>

        <!-- Jalur Transit -->
        <section class="panel-section">
            <h2><i class="fa-solid fa-route"></i> Jalur Transit</h2>
            <div class="line-list-container">
                <ul id="line-list" class="styled-list"></ul>
            </div>
            <div class="add-line-form">
                <input type="text" id="new-line-name" placeholder="Nama jalur baru..." maxlength="30">
                <input type="color" id="new-line-color" value="#00ffcc">
                <button id="btn-add-line" class="btn btn-icon-only" title="Tambah Jalur"><i class="fa-solid fa-plus"></i></button>
            </div>
        </section>

        <!-- Pencarian Rute -->
        <section class="panel-section highlight">
            <h2><i class="fa-solid fa-compass"></i> Rute Terpendek</h2>
            <div class="form-group">
                <label for="start-station">Stasiun Asal:</label>
                <select id="start-station"><option value="">-- Pilih Stasiun --</option></select>
            </div>
            <div class="form-group">
                <label for="end-station">Stasiun Tujuan:</label>
                <select id="end-station"><option value="">-- Pilih Stasiun --</option></select>
            </div>
            <div class="form-group">
                <label for="algorithm-select">Algoritma:</label>
                <select id="algorithm-select">
                    <option value="dijkstra">Dijkstra (Waktu Tempuh Tercepat)</option>
                    <option value="bfs">BFS (Transfer Stasiun Paling Sedikit)</option>
                </select>
            </div>
            <div class="form-group">
                <div class="slider-header">
                    <label for="speed-slider">Kecepatan Animasi:</label>
                    <span id="speed-value">500ms</span>
                </div>
                <input type="range" id="speed-slider" min="50" max="2000" step="50" value="500">
            </div>
            <div class="button-column">
                <button id="btn-find-path" class="btn btn-success btn-lg"><i class="fa-solid fa-play"></i> Temukan Rute</button>
                <button id="btn-clear-path" class="btn btn-outline btn-md"><i class="fa-solid fa-rotate-left"></i> Reset Jalur</button>
            </div>
        </section>
    </aside>

    <!-- ================================= CANVAS AREA ================================= -->
    <main class="canvas-area">
        <!-- Header Kanvas -->
        <header class="canvas-header">
            <div class="map-title-container">
                <span class="badge">PETA AKTIF</span>
                <input type="text" id="map-name-input" value="Loading Map..." title="Klik untuk mengubah nama peta">
            </div>
            <!-- Toolbar Zoom & Mode -->
            <div class="canvas-toolbar">
                <div class="toolbar-group">
                    <button id="btn-mode-select" class="toolbar-btn active" title="Mode Seleksi (S): Klik/drag untuk memilih stasiun">
                        <i class="fa-solid fa-arrow-pointer"></i>
                    </button>
                    <button id="btn-mode-pan" class="toolbar-btn" title="Mode Geser (P): Klik dan drag untuk menggeser peta">
                        <i class="fa-solid fa-hand"></i>
                    </button>
                    <button id="btn-mode-connect" class="toolbar-btn" title="Mode Hubung (C): Klik stasiun lalu klik stasiun lain untuk membuat rel">
                        <i class="fa-solid fa-link"></i>
                    </button>
                    <button id="btn-mode-add" class="toolbar-btn" title="Mode Tambah Stasiun (A): Klik area kosong untuk menambah stasiun baru">
                        <i class="fa-solid fa-location-pin"></i>
                    </button>
                </div>
                <div class="toolbar-divider"></div>
                <div class="toolbar-group">
                    <button id="btn-zoom-in" class="toolbar-btn" title="Perbesar (+ / Scroll Atas)"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
                    <span id="zoom-level-display" class="zoom-display">100%</span>
                    <button id="btn-zoom-out" class="toolbar-btn" title="Perkecil (- / Scroll Bawah)"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
                    <button id="btn-zoom-fit" class="toolbar-btn" title="Sesuaikan Semua Stasiun (F)"><i class="fa-solid fa-expand"></i></button>
                    <button id="btn-zoom-reset" class="toolbar-btn" title="Reset Zoom (0)"><i class="fa-solid fa-house"></i></button>
                </div>
            </div>
        </header>

        <!-- Kontainer SVG + Indikator Mode -->
        <div class="svg-container" id="svg-container">
            <!-- Mode Badge Aktif -->
            <div id="active-mode-badge" class="mode-badge mode-select">
                <i class="fa-solid fa-arrow-pointer"></i> Mode: Seleksi
            </div>
            <!-- Info Seleksi Ganda -->
            <div id="selection-info-bar" class="selection-info hidden">
                <span id="selection-count-text"><i class="fa-solid fa-check-square"></i> 0 stasiun dipilih</span>
                <div class="selection-actions">
                    <button id="btn-move-selection" class="btn btn-sm btn-outline" title="Drag stasiun terpilih untuk memindahkan semuanya"><i class="fa-solid fa-arrows-up-down-left-right"></i> Geser</button>
                    <button id="btn-delete-selection" class="btn btn-sm btn-danger"><i class="fa-solid fa-trash"></i> Hapus Semua</button>
                    <button id="btn-clear-selection" class="btn btn-sm btn-outline"><i class="fa-solid fa-xmark"></i></button>
                </div>
            </div>

            <svg id="metro-canvas" xmlns="http://www.w3.org/2000/svg">
                <!-- Grup transformasi utama untuk pan & zoom -->
                <g id="viewport-group">
                    <g id="edge-group"></g>
                    <g id="path-highlight-group"></g>
                    <g id="node-group"></g>
                </g>
                <!-- Box selection rectangle (di luar viewport agar tidak ikut transform) -->
                <rect id="selection-box" class="selection-box hidden" x="0" y="0" width="0" height="0"></rect>
            </svg>

            <!-- Hasil Rute Card -->
            <div id="path-results-card" class="glass-card hidden">
                <div class="card-header">
                    <h3><i class="fa-solid fa-circle-check text-green"></i> Rute Ditemukan!</h3>
                    <button id="btn-close-results" class="btn-close">&times;</button>
                </div>
                <div class="card-body">
                    <div class="stats-row">
                        <div class="stat-box">
                            <span class="stat-label">Total Waktu</span>
                            <span id="res-total-time" class="stat-value">0 menit</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-label">Jumlah Hentian</span>
                            <span id="res-total-stops" class="stat-value">0 stasiun</span>
                        </div>
                    </div>
                    <div class="directions-list-container">
                        <h4>Panduan Langkah Perjalanan:</h4>
                        <ol id="directions-list" class="directions-list"></ol>
                    </div>
                </div>
            </div>
        </div>
    </main>
</div>

<!-- ========================= MODAL TUTORIAL ONBOARDING ========================= -->
<div id="tutorial-modal" class="modal">
    <div class="modal-content tutorial-modal-content glass-card">
        <div class="tutorial-header">
            <div class="tutorial-brand">
                <i class="fa-solid fa-train-subway"></i>
                <h2>Selamat Datang di <span>MetroFlow</span>!</h2>
            </div>
        </div>
        <div class="tutorial-body">
            <p class="tutorial-desc">MetroFlow adalah editor visual untuk merancang jaringan transit dan memvisualisasikan algoritma pencarian rute terpendek <strong>Dijkstra</strong> & <strong>BFS</strong>.</p>
            
            <div class="tutorial-grid">
                <div class="tutorial-card">
                    <div class="tutorial-icon"><i class="fa-solid fa-location-pin" style="color: #00f0ff;"></i></div>
                    <h4>Tambah Stasiun</h4>
                    <p>Pilih mode <strong>"Tambah Stasiun"</strong> (ikon pin), lalu <strong>klik di area kosong</strong> untuk menambahkan stasiun baru.</p>
                </div>
                <div class="tutorial-card">
                    <div class="tutorial-icon"><i class="fa-solid fa-link" style="color: #ff3366;"></i></div>
                    <h4>Hubungkan Rel</h4>
                    <p>Pilih mode <strong>"Hubung"</strong> (ikon rantai), klik stasiun asal, lalu klik stasiun tujuan untuk membuat rel kereta.</p>
                </div>
                <div class="tutorial-card">
                    <div class="tutorial-icon"><i class="fa-solid fa-arrow-pointer" style="color: #ffcc00;"></i></div>
                    <h4>Seleksi & Drag</h4>
                    <p>Di mode <strong>"Seleksi"</strong> (ikon kursor), drag di area kosong untuk memilih beberapa stasiun sekaligus, lalu geser atau hapus bersama.</p>
                </div>
                <div class="tutorial-card">
                    <div class="tutorial-icon"><i class="fa-solid fa-hand" style="color: #9d4edd;"></i></div>
                    <h4>Geser & Zoom Peta</h4>
                    <p>Mode <strong>"Geser"</strong> (ikon tangan) untuk menggeser peta. Gunakan <strong>scroll roda mouse</strong> atau tombol <kbd>+</kbd>/<kbd>-</kbd> untuk zoom.</p>
                </div>
                <div class="tutorial-card">
                    <div class="tutorial-icon"><i class="fa-solid fa-compass" style="color: #00ff66;"></i></div>
                    <h4>Cari Rute Terpendek</h4>
                    <p>Pilih <strong>Stasiun Asal & Tujuan</strong> di sidebar kiri, pilih algoritma, lalu tekan <strong>"Temukan Rute"</strong>.</p>
                </div>
                <div class="tutorial-card">
                    <div class="tutorial-icon"><i class="fa-solid fa-floppy-disk" style="color: #9d4edd;"></i></div>
                    <h4>Simpan Peta</h4>
                    <p>Klik <strong>"Simpan"</strong> di bagian Manajemen Peta untuk menyimpan desain jaringan Anda ke database.</p>
                </div>
            </div>

            <div class="tutorial-shortcut-box">
                <h4><i class="fa-solid fa-keyboard"></i> Pintasan Keyboard</h4>
                <div class="shortcut-grid">
                    <span><kbd>S</kbd> Mode Seleksi</span>
                    <span><kbd>P</kbd> Mode Geser</span>
                    <span><kbd>C</kbd> Mode Hubung Rel</span>
                    <span><kbd>A</kbd> Mode Tambah Stasiun</span>
                    <span><kbd>F</kbd> Sesuaikan Peta</span>
                    <span><kbd>Del</kbd> Hapus Terpilih</span>
                    <span><kbd>Esc</kbd> Batalkan Aksi</span>
                    <span><kbd>Scroll</kbd> Zoom In/Out</span>
                </div>
            </div>
        </div>
        <div class="tutorial-footer">
            <label class="checkbox-label">
                <input type="checkbox" id="tutorial-dont-show-again">
                Jangan tampilkan lagi
            </label>
            <button id="btn-close-tutorial" class="btn btn-success btn-md">
                <i class="fa-solid fa-rocket"></i> Mulai Eksplorasi!
            </button>
        </div>
    </div>
</div>

<!-- ========================= MODAL EDIT STASIUN ========================= -->
<div id="station-modal" class="modal hidden">
    <div class="modal-content glass-card">
        <div class="modal-header">
            <h3><i class="fa-solid fa-train-subway text-cyan"></i> Edit Stasiun</h3>
            <span class="modal-close" id="btn-close-station-modal">&times;</span>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <label for="station-name-input">Nama Stasiun:</label>
                <input type="text" id="station-name-input">
            </div>
            <div class="button-row-spaced">
                <button id="btn-delete-station" class="btn btn-danger"><i class="fa-solid fa-trash"></i> Hapus Stasiun</button>
                <button id="btn-save-station" class="btn btn-primary"><i class="fa-solid fa-check"></i> Simpan</button>
            </div>
        </div>
    </div>
</div>

<!-- ========================= MODAL EDIT KONEKSI ========================= -->
<div id="connection-modal" class="modal hidden">
    <div class="modal-content glass-card">
        <div class="modal-header">
            <h3><i class="fa-solid fa-link text-cyan"></i> Edit Koneksi Rel</h3>
            <span class="modal-close" id="btn-close-connection-modal">&times;</span>
        </div>
        <div class="modal-body">
            <div class="form-group">
                <p id="connection-details-text" class="connection-detail-text">A &harr; B</p>
            </div>
            <div class="form-group">
                <label for="connection-weight-input">Waktu Perjalanan (menit):</label>
                <input type="number" id="connection-weight-input" min="0.5" step="0.5" value="3">
            </div>
            <div class="form-group">
                <label for="connection-line-select">Jalur (Metro Line):</label>
                <select id="connection-line-select"></select>
            </div>
            <div class="button-row-spaced">
                <button id="btn-delete-connection" class="btn btn-danger"><i class="fa-solid fa-trash"></i> Hapus Rel</button>
                <button id="btn-save-connection" class="btn btn-primary"><i class="fa-solid fa-check"></i> Simpan</button>
            </div>
        </div>
    </div>
</div>

<script src="<?= base_url('js/metroflow.js') ?>"></script>
</body>
</html>
