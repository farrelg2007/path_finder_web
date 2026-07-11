<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');

$routes->group('api', function($routes) {
    $routes->get('maps', 'MapController::index');
    $routes->get('maps/(:num)', 'MapController::show/$1');
    $routes->post('maps', 'MapController::save');
    $routes->delete('maps/(:num)', 'MapController::delete/$1');
});
