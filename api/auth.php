<?php
/**
 * API de Autenticação
 * CSC Geórgia Contábil - Centro de Serviços Compartilhados
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

require_once '../config/database.php';

try {
    $db = getDB();
    
    $method = $_SERVER['REQUEST_METHOD'];
    $action = $_GET['action'] ?? '';
    
    switch ($method) {
        case 'POST':
            switch ($action) {
                case 'login':
                    handleLogin();
                    break;
                case 'register':
                    handleRegister();
                    break;
                case 'logout':
                    handleLogout();
                    break;
                default:
                    jsonError('Ação não encontrada', 404);
            }
            break;
            
        case 'GET':
            switch ($action) {
                case 'me':
                    handleGetMe();
                    break;
                case 'users':
                    handleGetUsers();
                    break;
                default:
                    jsonError('Ação não encontrada', 404);
            }
            break;
            
        case 'PUT':
            switch ($action) {
                case 'update-user':
                    handleUpdateUser();
                    break;
                default:
                    jsonError('Ação não encontrada', 404);
            }
            break;
            
        default:
            jsonError('Método não permitido', 405);
    }
    
} catch (Exception $e) {
    jsonError('Erro interno do servidor: ' . $e->getMessage(), 500);
}

/**
 * Função para lidar com login
 */
function handleLogin() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        jsonError('Dados inválidos');
    }
    
    $rules = [
        'nome' => 'required|min:2',
        'email' => 'required|email',
        'area' => 'required',
        'quadro' => 'required'
    ];
    
    $errors = validateInput($input, $rules);
    if (!empty($errors)) {
        jsonError('Dados inválidos: ' . implode(', ', $errors));
    }
    
    $email = strtolower(trim($input['email']));
    
    // Verificar se email é autorizado
    if (!isEmailAllowed($email)) {
        jsonError('Email não autorizado. Use um domínio corporativo ou entre em contato com o administrador.');
    }
    
    try {
        $db = getDB();
        
        // Verificar se usuário já existe
        $user = $db->fetch("SELECT * FROM users WHERE email = ?", [$email]);
        
        if (!$user) {
            // Criar novo usuário
            $role = determineUserRole($email);
            $userId = $db->insert('users', [
                'nome' => sanitizeInput($input['nome']),
                'email' => $email,
                'area' => sanitizeInput($input['area']),
                'quadro' => sanitizeInput($input['quadro']),
                'role' => $role,
                'is_active' => 1,
                'last_login' => date('Y-m-d H:i:s'),
                'created_at' => date('Y-m-d H:i:s')
            ]);
            
            $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$userId]);
        } else {
            // Atualizar último login
            $db->update('users', 
                ['last_login' => date('Y-m-d H:i:s')], 
                'id = ?', 
                [$user['id']]
            );
        }
        
        // Gerar token JWT
        $token = generateJWT([
            'user_id' => $user['id'],
            'email' => $user['email'],
            'role' => $user['role'],
            'exp' => time() + (24 * 60 * 60) // 24 horas
        ]);
        
        // Log de auditoria
        logAudit($user['id'], 'login', 'Login realizado com sucesso');
        
        // Remover senha do response
        unset($user['password']);
        
        jsonSuccess([
            'user' => $user,
            'token' => $token
        ], 'Login realizado com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao realizar login: ' . $e->getMessage());
    }
}

/**
 * Função para lidar com registro
 */
function handleRegister() {
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        jsonError('Dados inválidos');
    }
    
    $rules = [
        'nome' => 'required|min:2',
        'email' => 'required|email',
        'area' => 'required',
        'quadro' => 'required'
    ];
    
    $errors = validateInput($input, $rules);
    if (!empty($errors)) {
        jsonError('Dados inválidos: ' . implode(', ', $errors));
    }
    
    $email = strtolower(trim($input['email']));
    
    // Verificar se email é autorizado
    if (!isEmailAllowed($email)) {
        jsonError('Email não autorizado. Use um domínio corporativo ou entre em contato com o administrador.');
    }
    
    try {
        $db = getDB();
        
        // Verificar se usuário já existe
        $existingUser = $db->fetch("SELECT id FROM users WHERE email = ?", [$email]);
        if ($existingUser) {
            jsonError('Usuário já cadastrado com este email');
        }
        
        // Criar novo usuário
        $role = determineUserRole($email);
        $userId = $db->insert('users', [
            'nome' => sanitizeInput($input['nome']),
            'email' => $email,
            'area' => sanitizeInput($input['area']),
            'quadro' => sanitizeInput($input['quadro']),
            'role' => $role,
            'is_active' => 1,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$userId]);
        unset($user['password']);
        
        // Log de auditoria
        logAudit($userId, 'register', 'Novo usuário registrado');
        
        jsonSuccess($user, 'Usuário registrado com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao registrar usuário: ' . $e->getMessage());
    }
}

/**
 * Função para lidar com logout
 */
function handleLogout() {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? '';
    
    if (strpos($token, 'Bearer ') === 0) {
        $token = substr($token, 7);
    }
    
    if (!$token) {
        jsonError('Token não fornecido');
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        jsonError('Token inválido');
    }
    
    // Log de auditoria
    logAudit($payload['user_id'], 'logout', 'Logout realizado');
    
    jsonSuccess(null, 'Logout realizado com sucesso');
}

/**
 * Função para obter dados do usuário atual
 */
function handleGetMe() {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? '';
    
    if (strpos($token, 'Bearer ') === 0) {
        $token = substr($token, 7);
    }
    
    if (!$token) {
        jsonError('Token não fornecido');
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        jsonError('Token inválido');
    }
    
    try {
        $db = getDB();
        $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$payload['user_id']]);
        
        if (!$user) {
            jsonError('Usuário não encontrado');
        }
        
        unset($user['password']);
        
        // Adicionar permissões
        $user['permissions'] = getUserPermissions($user['role']);
        $user['capabilities'] = getUserCapabilities($user['role']);
        
        jsonSuccess($user);
        
    } catch (Exception $e) {
        jsonError('Erro ao obter dados do usuário: ' . $e->getMessage());
    }
}

/**
 * Função para obter lista de usuários (apenas admin)
 */
function handleGetUsers() {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? '';
    
    if (strpos($token, 'Bearer ') === 0) {
        $token = substr($token, 7);
    }
    
    if (!$token) {
        jsonError('Token não fornecido');
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        jsonError('Token inválido');
    }
    
    // Verificar permissão
    if (!hasPermission($payload['role'], 'user:manage')) {
        jsonError('Acesso negado');
    }
    
    try {
        $db = getDB();
        
        $page = (int)($_GET['page'] ?? 1);
        $limit = (int)($_GET['limit'] ?? 20);
        $offset = ($page - 1) * $limit;
        
        $search = $_GET['search'] ?? '';
        $role = $_GET['role'] ?? '';
        $status = $_GET['status'] ?? '';
        
        $where = [];
        $params = [];
        
        if ($search) {
            $where[] = "(nome LIKE ? OR email LIKE ?)";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
        }
        
        if ($role) {
            $where[] = "role = ?";
            $params[] = $role;
        }
        
        if ($status !== '') {
            $where[] = "is_active = ?";
            $params[] = (int)$status;
        }
        
        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';
        
        // Contar total
        $countSql = "SELECT COUNT(*) as total FROM users {$whereClause}";
        $total = $db->fetch($countSql, $params)['total'];
        
        // Buscar usuários
        $sql = "SELECT * FROM users {$whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $users = $db->fetchAll($sql, $params);
        
        // Remover senhas
        foreach ($users as &$user) {
            unset($user['password']);
        }
        
        jsonSuccess([
            'users' => $users,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit)
            ]
        ]);
        
    } catch (Exception $e) {
        jsonError('Erro ao obter usuários: ' . $e->getMessage());
    }
}

/**
 * Função para atualizar usuário
 */
function handleUpdateUser() {
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? '';
    
    if (strpos($token, 'Bearer ') === 0) {
        $token = substr($token, 7);
    }
    
    if (!$token) {
        jsonError('Token não fornecido');
    }
    
    $payload = validateJWT($token);
    if (!$payload) {
        jsonError('Token inválido');
    }
    
    // Verificar permissão
    if (!hasPermission($payload['role'], 'user:manage')) {
        jsonError('Acesso negado');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || !isset($input['user_id'])) {
        jsonError('Dados inválidos');
    }
    
    try {
        $db = getDB();
        
        $userId = (int)$input['user_id'];
        
        // Verificar se usuário existe
        $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$userId]);
        if (!$user) {
            jsonError('Usuário não encontrado');
        }
        
        $updateData = [];
        
        if (isset($input['nome'])) {
            $updateData['nome'] = sanitizeInput($input['nome']);
        }
        
        if (isset($input['area'])) {
            $updateData['area'] = sanitizeInput($input['area']);
        }
        
        if (isset($input['quadro'])) {
            $updateData['quadro'] = sanitizeInput($input['quadro']);
        }
        
        if (isset($input['role'])) {
            $updateData['role'] = sanitizeInput($input['role']);
        }
        
        if (isset($input['is_active'])) {
            $updateData['is_active'] = (int)$input['is_active'];
        }
        
        if (empty($updateData)) {
            jsonError('Nenhum dado para atualizar');
        }
        
        $updateData['updated_at'] = date('Y-m-d H:i:s');
        
        $db->update('users', $updateData, 'id = ?', [$userId]);
        
        // Log de auditoria
        logAudit($payload['user_id'], 'update_user', "Usuário {$userId} atualizado");
        
        jsonSuccess(null, 'Usuário atualizado com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao atualizar usuário: ' . $e->getMessage());
    }
}

/**
 * Função para obter permissões do usuário
 */
function getUserPermissions($role) {
    $permissions = [
        'SUPER_ADMIN' => ['*'],
        'ADMIN' => ['ticket:create', 'ticket:read', 'ticket:update', 'ticket:assign', 'ticket:close', 'user:manage', 'reports:view'],
        'USER' => ['ticket:create', 'ticket:read']
    ];
    
    return $permissions[$role] ?? [];
}

/**
 * Função para obter capacidades do usuário
 */
function getUserCapabilities($role) {
    $capabilities = [
        'SUPER_ADMIN' => [
            'canAssign' => true,
            'canClose' => true,
            'canManageUsers' => true,
            'canViewReports' => true,
            'canManageSystem' => true
        ],
        'ADMIN' => [
            'canAssign' => true,
            'canClose' => true,
            'canManageUsers' => true,
            'canViewReports' => true,
            'canManageSystem' => false
        ],
        'USER' => [
            'canAssign' => false,
            'canClose' => false,
            'canManageUsers' => false,
            'canViewReports' => false,
            'canManageSystem' => false
        ]
    ];
    
    return $capabilities[$role] ?? [];
}
?>
