<?php

namespace App\Controllers;

use App\Models\MapModel;
use App\Models\StationModel;
use App\Models\LineModel;
use App\Models\ConnectionModel;
use CodeIgniter\API\ResponseTrait;

class MapController extends BaseController
{
    use ResponseTrait;

    protected $mapModel;
    protected $stationModel;
    protected $lineModel;
    protected $connectionModel;

    public function __construct()
    {
        $this->mapModel = new MapModel();
        $this->stationModel = new StationModel();
        $this->lineModel = new LineModel();
        $this->connectionModel = new ConnectionModel();
    }

    /**
     * Mengambil semua daftar peta transit.
     * Jika kosong, buat peta contoh (preset).
     */
    public function index()
    {
        $maps = $this->mapModel->findAll();

        if (empty($maps)) {
            $this->createDefaultPreset();
            $maps = $this->mapModel->findAll();
        }

        return $this->respond($maps);
    }

    /**
     * Memuat peta transit tertentu beserta seluruh stasiun, jalur, dan koneksinya.
     */
    public function show($id = null)
    {
        $map = $this->mapModel->find($id);
        if (!$map) {
            return $this->failNotFound('Peta tidak ditemukan.');
        }

        $stations = $this->stationModel->where('map_id', $id)->findAll();
        $lines = $this->lineModel->where('map_id', $id)->findAll();
        $connections = $this->connectionModel->where('map_id', $id)->findAll();

        return $this->respond([
            'map' => $map,
            'stations' => $stations,
            'lines' => $lines,
            'connections' => $connections
        ]);
    }

    /**
     * Menyimpan peta transit baru atau memperbarui peta yang ada.
     */
    public function save()
    {
        $json = $this->request->getJSON(true);
        if (!$json) {
            return $this->fail('Request JSON tidak valid.');
        }

        $db = \Config\Database::connect();
        $db->transStart();

        $mapId = $json['id'] ?? null;
        $mapData = ['name' => $json['name'] ?? 'Peta Tanpa Nama'];

        if ($mapId) {
            // Update nama peta
            $this->mapModel->update($mapId, $mapData);
            // Hapus data lama untuk diganti dengan data baru dari kanvas
            $this->connectionModel->where('map_id', $mapId)->delete();
            $this->lineModel->where('map_id', $mapId)->delete();
            $this->stationModel->where('map_id', $mapId)->delete();
        } else {
            // Buat peta baru
            $mapId = $this->mapModel->insert($mapData);
        }

        // Simpan Stasiun (Nodes)
        $stationMapping = []; // Menyimpan mapping temp_id -> db_id
        if (!empty($json['stations'])) {
            foreach ($json['stations'] as $station) {
                $insertedId = $this->stationModel->insert([
                    'map_id' => $mapId,
                    'name'   => $station['name'],
                    'x'      => $station['x'],
                    'y'      => $station['y']
                ]);
                $stationMapping[$station['id']] = $insertedId;
            }
        }

        // Simpan Jalur (Lines)
        $lineMapping = []; // Menyimpan mapping temp_id -> db_id
        if (!empty($json['lines'])) {
            foreach ($json['lines'] as $line) {
                $insertedId = $this->lineModel->insert([
                    'map_id' => $mapId,
                    'name'   => $line['name'],
                    'color'  => $line['color']
                ]);
                $lineMapping[$line['id']] = $insertedId;
            }
        }

        // Simpan Koneksi Rel (Edges)
        if (!empty($json['connections'])) {
            foreach ($json['connections'] as $conn) {
                // Konversi temp_id ke database ID asli
                $fromId = $stationMapping[$conn['from_station_id']] ?? null;
                $toId = $stationMapping[$conn['to_station_id']] ?? null;
                $lineId = $lineMapping[$conn['line_id']] ?? null;

                if ($fromId && $toId && $lineId) {
                    $this->connectionModel->insert([
                        'map_id'          => $mapId,
                        'from_station_id' => $fromId,
                        'to_station_id'   => $toId,
                        'line_id'         => $lineId,
                        'weight'          => floatval($conn['weight'] ?? 1.0)
                    ]);
                }
            }
        }

        $db->transComplete();

        if ($db->transStatus() === false) {
            return $this->fail('Gagal menyimpan peta ke database.');
        }

        return $this->respond([
            'status' => 'success',
            'map_id' => $mapId,
            'message' => 'Peta berhasil disimpan.'
        ]);
    }

    /**
     * Menghapus peta transit.
     */
    public function delete($id = null)
    {
        $map = $this->mapModel->find($id);
        if (!$map) {
            return $this->failNotFound('Peta tidak ditemukan.');
        }

        // Karena relasi foreign key diset CASCADE ON DELETE di migrasi,
        // menghapus baris peta akan otomatis menghapus stasiun, jalur, dan koneksinya.
        $this->mapModel->delete($id);

        return $this->respond([
            'status' => 'success',
            'message' => 'Peta berhasil dihapus.'
        ]);
    }

    /**
     * Membuat peta preset default (Demo MRT/LRT Jakarta Mockup).
     */
    private function createDefaultPreset()
    {
        $db = \Config\Database::connect();
        $db->transStart();

        // 1. Buat peta
        $mapId = $this->mapModel->insert(['name' => 'Demo MRT/LRT Jakarta']);

        // 2. Buat Jalur (Lines)
        $mrtLineId = $this->lineModel->insert([
            'map_id' => $mapId,
            'name'   => 'MRT North-South',
            'color'  => '#0052cc'
        ]);

        $lrtLineId = $this->lineModel->insert([
            'map_id' => $mapId,
            'name'   => 'LRT Jabodebek',
            'color'  => '#e6005c'
        ]);

        // 3. Buat Stasiun (Stations)
        // MRT Stations
        $sLebakBulus = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Lebak Bulus', 'x' => 150, 'y' => 500]);
        $sFatmawati  = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Fatmawati', 'x' => 280, 'y' => 460]);
        $sCipete     = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Cipete Raya', 'x' => 410, 'y' => 420]);
        $sBlokM      = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Blok M BCA', 'x' => 540, 'y' => 380]);
        $sSenayan    = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Senayan', 'x' => 670, 'y' => 340]);
        $sDukuhAtas  = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Dukuh Atas', 'x' => 800, 'y' => 300]);
        $sBundaranHI = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Bundaran HI', 'x' => 930, 'y' => 260]);

        // LRT Stations (berpotongan di Dukuh Atas)
        $sPalmerah   = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Palmerah', 'x' => 580, 'y' => 120]);
        $sKuningan   = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Kuningan', 'x' => 690, 'y' => 210]);
        // Dukuh Atas (Hub) sudah dibuat di MRT
        $sCawang     = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Cawang', 'x' => 910, 'y' => 390]);
        $sHalim      = $this->stationModel->insert(['map_id' => $mapId, 'name' => 'Halim HSR', 'x' => 1020, 'y' => 480]);

        // 4. Buat Koneksi (Connections)
        // MRT Connections (berat/waktu dalam menit)
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sLebakBulus, 'to_station_id' => $sFatmawati, 'line_id' => $mrtLineId, 'weight' => 4]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sFatmawati, 'to_station_id' => $sCipete, 'line_id' => $mrtLineId, 'weight' => 3]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sCipete, 'to_station_id' => $sBlokM, 'line_id' => $mrtLineId, 'weight' => 5]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sBlokM, 'to_station_id' => $sSenayan, 'line_id' => $mrtLineId, 'weight' => 3]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sSenayan, 'to_station_id' => $sDukuhAtas, 'line_id' => $mrtLineId, 'weight' => 6]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sDukuhAtas, 'to_station_id' => $sBundaranHI, 'line_id' => $mrtLineId, 'weight' => 2]);

        // LRT Connections
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sPalmerah, 'to_station_id' => $sKuningan, 'line_id' => $lrtLineId, 'weight' => 5]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sKuningan, 'to_station_id' => $sDukuhAtas, 'line_id' => $lrtLineId, 'weight' => 3]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sDukuhAtas, 'to_station_id' => $sCawang, 'line_id' => $lrtLineId, 'weight' => 8]);
        $this->connectionModel->insert(['map_id' => $mapId, 'from_station_id' => $sCawang, 'to_station_id' => $sHalim, 'line_id' => $lrtLineId, 'weight' => 6]);

        $db->transComplete();
    }
}
