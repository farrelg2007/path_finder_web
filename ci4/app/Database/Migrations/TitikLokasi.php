<?php
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

class TitikLokasi extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'constraint' => 5, 'unsigned' => true, 'auto_increment' => true],
            'nama_lokasi' => ['type' => 'VARCHAR', 'constraint' => '100'],
            'kategori'    => ['type' => 'VARCHAR', 'constraint' => '50'],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('titik_lokasi');
    }

    public function down()
    {
        $this->forge->dropTable('titik_lokasi');
    }
}
