<?php
/**
 * Configuração da conexão com o banco de dados
 * CSC Geórgia Contábil - Centro de Serviços Compartilhados
 */

// Configurações do banco de dados
define('DB_HOST', 'cscgeorgia.mysql.dbaas.com.br');
define('DB_NAME', 'cscgeorgia');
define('DB_USER', 'cscgeorgia');
define('DB_PASS', 'G30rg14@2025');
define('DB_CHARSET', 'utf8mb4');

// Configurações da aplicação
define('APP_NAME', 'CSC Geórgia Contábil');
define('APP_VERSION', '1.0.0');
define('APP_URL', 'http://localhost/csc');

// Configurações de segurança
define('SESSION_SECRET', 'csc-georgia-secret-key-2024');
define('JWT_SECRET', 'csc-georgia-jwt-secret-2024');

// Configurações de email
define('SMTP_HOST', 'smtp.office365.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'noreply@georgiacontabil.com.br');
define('SMTP_PASS', '');

// Configurações de domínios autorizados
define('ALLOWED_DOMAINS', ['georgiacontabil.com.br', 'nine9.com.br']);
define('ALLOWED_EMAILS', ['ryan31624@gmail.com']);

// Configurações de upload
define('UPLOAD_PATH', '../uploads/');
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB
define('ALLOWED_FILE_TYPES', ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'xls', 'xlsx']);

/**
 * Classe de conexão com o banco de dados
 */
class Database {
    private static $instance = null;
    private $connection;
    
    private function __construct() {
        try {
            $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ];
            
            $this->connection = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            throw new Exception("Erro na conexão com o banco de dados: " . $e->getMessage());
        }
    }
    
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection() {
        return $this->connection;
    }
    
    public function query($sql, $params = []) {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            throw new Exception("Erro na execução da query: " . $e->getMessage());
        }
    }
    
    public function fetchAll($sql, $params = []) {
        return $this->query($sql, $params)->fetchAll();
    }
    
    public function fetch($sql, $params = []) {
        return $this->query($sql, $params)->fetch();
    }
    
    public function insert($table, $data) {
        $fields = array_keys($data);
        $placeholders = ':' . implode(', :', $fields);
        $sql = "INSERT INTO {$table} (" . implode(', ', $fields) . ") VALUES ({$placeholders})";
        
        $this->query($sql, $data);
        return $this->connection->lastInsertId();
    }
    
    public function update($table, $data, $where, $whereParams = []) {
        $fields = array_keys($data);
        $setClause = implode(' = ?, ', $fields) . ' = ?';
        $sql = "UPDATE {$table} SET {$setClause} WHERE {$where}";
        
        $params = array_values($data);
        $params = array_merge($params, $whereParams);
        
        return $this->query($sql, $params)->rowCount();
    }
    
    public function delete($table, $where, $params = []) {
        $sql = "DELETE FROM {$table} WHERE {$where}";
        return $this->query($sql, $params)->rowCount();
    }
    
    public function beginTransaction() {
        return $this->connection->beginTransaction();
    }
    
    public function commit() {
        return $this->connection->commit();
    }
    
    public function rollback() {
        return $this->connection->rollback();
    }
}

/**
 * Função para obter conexão com o banco
 */
function getDB() {
    return Database::getInstance();
}

/**
 * Função para validar email autorizado
 */
function isEmailAllowed($email) {
    $domain = strtolower(substr(strrchr($email, "@"), 1));
    return in_array($domain, ALLOWED_DOMAINS) || in_array(strtolower($email), ALLOWED_EMAILS);
}

/**
 * Função para determinar role do usuário
 */
function determineUserRole($email) {
    if (strtolower($email) === 'ryan31624@gmail.com') {
        return 'SUPER_ADMIN';
    }
    return 'USER';
}

/**
 * Função para gerar token JWT
 */
function generateJWT($payload) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $payload = json_encode($payload);
    
    $base64Header = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($header));
    $base64Payload = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($payload));
    
    $signature = hash_hmac('sha256', $base64Header . "." . $base64Payload, JWT_SECRET, true);
    $base64Signature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($signature));
    
    return $base64Header . "." . $base64Payload . "." . $base64Signature;
}

/**
 * Função para validar token JWT
 */
function validateJWT($token) {
    $parts = explode('.', $token);
    if (count($parts) !== 3) {
        return false;
    }
    
    $header = $parts[0];
    $payload = $parts[1];
    $signature = $parts[2];
    
    $validSignature = hash_hmac('sha256', $header . "." . $payload, JWT_SECRET, true);
    $validSignature = str_replace(['+', '/', '='], ['-', '_', ''], base64_encode($validSignature));
    
    if ($signature !== $validSignature) {
        return false;
    }
    
    $payload = json_decode(base64_decode(str_replace(['-', '_'], ['+', '/'], $payload)), true);
    return $payload;
}

/**
 * Função para log de auditoria
 */
function logAudit($userId, $action, $details = '') {
    try {
        $db = getDB();
        $db->insert('audit_logs', [
            'user_id' => $userId,
            'action' => $action,
            'details' => $details,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'created_at' => date('Y-m-d H:i:s')
        ]);
    } catch (Exception $e) {
        error_log("Erro ao registrar log de auditoria: " . $e->getMessage());
    }
}

/**
 * Função para resposta JSON
 */
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Função para resposta de erro
 */
function jsonError($message, $status = 400) {
    jsonResponse(['error' => $message], $status);
}

/**
 * Função para resposta de sucesso
 */
function jsonSuccess($data = null, $message = 'Sucesso') {
    jsonResponse(['success' => true, 'message' => $message, 'data' => $data]);
}

/**
 * Função para validar dados de entrada
 */
function validateInput($data, $rules) {
    $errors = [];
    
    foreach ($rules as $field => $rule) {
        if (!isset($data[$field]) || empty($data[$field])) {
            if (strpos($rule, 'required') !== false) {
                $errors[$field] = "O campo {$field} é obrigatório";
            }
            continue;
        }
        
        $value = $data[$field];
        
        if (strpos($rule, 'email') !== false && !filter_var($value, FILTER_VALIDATE_EMAIL)) {
            $errors[$field] = "Email inválido";
        }
        
        if (strpos($rule, 'min:') !== false) {
            preg_match('/min:(\d+)/', $rule, $matches);
            $min = (int)$matches[1];
            if (strlen($value) < $min) {
                $errors[$field] = "O campo {$field} deve ter pelo menos {$min} caracteres";
            }
        }
        
        if (strpos($rule, 'max:') !== false) {
            preg_match('/max:(\d+)/', $rule, $matches);
            $max = (int)$matches[1];
            if (strlen($value) > $max) {
                $errors[$field] = "O campo {$field} deve ter no máximo {$max} caracteres";
            }
        }
    }
    
    return $errors;
}

/**
 * Função para sanitizar dados
 */
function sanitizeInput($data) {
    if (is_array($data)) {
        return array_map('sanitizeInput', $data);
    }
    return htmlspecialchars(trim($data), ENT_QUOTES, 'UTF-8');
}

/**
 * Função para gerar número do ticket
 */
function generateTicketNumber() {
    $db = getDB();
    $year = date('Y');
    $sql = "SELECT COUNT(*) as count FROM tickets WHERE YEAR(created_at) = ?";
    $result = $db->fetch($sql, [$year]);
    $count = $result['count'] + 1;
    return $year . str_pad($count, 4, '0', STR_PAD_LEFT);
}

/**
 * Função para formatar data
 */
function formatDate($date, $format = 'd/m/Y H:i') {
    return date($format, strtotime($date));
}

/**
 * Função para verificar se usuário tem permissão
 */
function hasPermission($userRole, $permission) {
    $permissions = [
        'SUPER_ADMIN' => ['*'],
        'ADMIN' => ['ticket:create', 'ticket:read', 'ticket:update', 'ticket:assign', 'ticket:close', 'user:manage', 'reports:view'],
        'USER' => ['ticket:create', 'ticket:read']
    ];
    
    if (!isset($permissions[$userRole])) {
        return false;
    }
    
    return in_array('*', $permissions[$userRole]) || in_array($permission, $permissions[$userRole]);
}
?>
