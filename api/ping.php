<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    // Teste simples de conexão
    $db = getDB();
    $db->query('SELECT 1');
    echo json_encode([
        'ok' => true,
        'app' => APP_NAME,
        'version' => APP_VERSION,
        'db' => 'connected'
    ], JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'Backend indisponível: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>

