<?php

$grafRute = [
    "Kampus" => [
        "PasarKranji" => 2, 
        "Summarecon" => 5
    ],
    "PasarKranji" => [
        "Kampus" => 2, 
        "HarapanIndah" => 4
    ],
    "HarapanIndah" => [
        "PasarKranji" => 4, 
        "Stasiun" => 6
    ],
    "Summarecon" => [
        "Kampus" => 5, 
        "Stasiun" => 2
    ],
    "Stasiun" => [
        "Summarecon" => 2, 
        "HarapanIndah" => 6
    ]
];