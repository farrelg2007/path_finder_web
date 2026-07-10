<?php
namespace App\Database\Migrations;
use CodeIgniter\Database\Migration;

class RuteJalan extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'        => ['type' => 'INT', 'constraint' => 5, 'unsigned' => true, 'auto_increment' => true],
            'asal_id'   => ['type' => 'INT', 'constraint' => 5, 'unsigned' => true],
            'tujuan_id' => ['type' => 'INT', 'constraint' => 5, 'unsigned' => true],
            'jarak_km'  => ['type' => 'FLOAT'],
        ]);
        $this->forge->addKey('id', true);
        // Menambahkan Foreign Key untuk integritas data
        $this->forge->addForeignKey('asal_id', 'titik_lokasi', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('tujuan_id', 'titik_lokasi', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('rute_jalan');
    }

    public function down()
    {
        $this->forge->dropTable('rute_jalan');
    }
}