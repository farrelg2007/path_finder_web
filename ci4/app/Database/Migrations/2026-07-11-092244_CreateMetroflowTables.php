<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateMetroflowTables extends Migration
{
    public function up()
    {
        // 1. Table: maps
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => '100',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('maps');

        // 2. Table: stations
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'map_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => '100',
            ],
            'x' => [
                'type' => 'DOUBLE',
            ],
            'y' => [
                'type' => 'DOUBLE',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('map_id', 'maps', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('stations');

        // 3. Table: lines
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'map_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   =>   true,
            ],
            'name' => [
                'type'       => 'VARCHAR',
                'constraint' => '100',
            ],
            'color' => [
                'type'       => 'VARCHAR',
                'constraint' => '20',
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('map_id', 'maps', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('lines');

        // 4. Table: connections
        $this->forge->addField([
            'id' => [
                'type'           => 'INT',
                'constraint'     => 11,
                'unsigned'       => true,
                'auto_increment' => true,
            ],
            'map_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'from_station_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'to_station_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'line_id' => [
                'type'       => 'INT',
                'constraint' => 11,
                'unsigned'   => true,
            ],
            'weight' => [
                'type'    => 'DOUBLE',
                'default' => 1.0,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => true,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addForeignKey('map_id', 'maps', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('from_station_id', 'stations', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('to_station_id', 'stations', 'id', 'CASCADE', 'CASCADE');
        $this->forge->addForeignKey('line_id', 'lines', 'id', 'CASCADE', 'CASCADE');
        $this->forge->createTable('connections');
    }

    public function down()
    {
        $this->forge->dropTable('connections', true);
        $this->forge->dropTable('lines', true);
        $this->forge->dropTable('stations', true);
        $this->forge->dropTable('maps', true);
    }
}
