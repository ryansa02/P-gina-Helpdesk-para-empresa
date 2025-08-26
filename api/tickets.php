<?php
/**
 * API de Gestão de Chamados
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
    $ticketId = $_GET['id'] ?? null;
    
    switch ($method) {
        case 'POST':
            switch ($action) {
                case 'create':
                    handleCreateTicket();
                    break;
                case 'assign':
                    handleAssignTicket($ticketId);
                    break;
                case 'close':
                    handleCloseTicket($ticketId);
                    break;
                case 'update':
                    handleAddUpdate($ticketId);
                    break;
                default:
                    jsonError('Ação não encontrada', 404);
            }
            break;
            
        case 'GET':
            switch ($action) {
                case 'list':
                    handleListTickets();
                    break;
                case 'get':
                    handleGetTicket($ticketId);
                    break;
                case 'stats':
                    handleGetStats();
                    break;
                default:
                    jsonError('Ação não encontrada', 404);
            }
            break;
            
        case 'PUT':
            switch ($action) {
                case 'update-ticket':
                    handleUpdateTicket($ticketId);
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
 * Função para criar novo chamado
 */
function handleCreateTicket() {
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
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        jsonError('Dados inválidos');
    }
    
    $rules = [
        'title' => 'required|min:3',
        'description' => 'required|min:10',
        'area' => 'required',
        'priority' => 'required',
        'quadro' => 'required'
    ];
    
    $errors = validateInput($input, $rules);
    if (!empty($errors)) {
        jsonError('Dados inválidos: ' . implode(', ', $errors));
    }
    
    try {
        $db = getDB();
        
        // Obter dados do usuário
        $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$payload['user_id']]);
        if (!$user) {
            jsonError('Usuário não encontrado');
        }
        
        // Gerar número do ticket
        $ticketNumber = generateTicketNumber();
        
        // Inserir ticket
        $ticketId = $db->insert('tickets', [
            'ticket_number' => $ticketNumber,
            'title' => sanitizeInput($input['title']),
            'description' => sanitizeInput($input['description']),
            'area' => sanitizeInput($input['area']),
            'priority' => sanitizeInput($input['priority']),
            'quadro' => sanitizeInput($input['quadro']),
            'status' => 'Aberto',
            'requester_id' => $user['id'],
            'requester_name' => $user['nome'],
            'requester_email' => $user['email'],
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
        
        // Inserir primeira atualização
        $db->insert('ticket_updates', [
            'ticket_id' => $ticketId,
            'user_id' => $user['id'],
            'user_name' => $user['nome'],
            'update_type' => 'created',
            'message' => 'Chamado criado',
            'is_internal' => 0,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        // Log de auditoria
        logAudit($user['id'], 'create_ticket', "Chamado #{$ticketNumber} criado");
        
        // Buscar ticket criado
        $ticket = $db->fetch("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
        
        jsonSuccess($ticket, 'Chamado criado com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao criar chamado: ' . $e->getMessage());
    }
}

/**
 * Função para listar chamados
 */
function handleListTickets() {
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
        
        $page = (int)($_GET['page'] ?? 1);
        $limit = (int)($_GET['limit'] ?? 20);
        $offset = ($page - 1) * $limit;
        
        // Filtros
        $status = $_GET['status'] ?? '';
        $priority = $_GET['priority'] ?? '';
        $area = $_GET['area'] ?? '';
        $search = $_GET['search'] ?? '';
        $requester = $_GET['requester'] ?? '';
        $assignee = $_GET['assignee'] ?? '';
        
        $where = [];
        $params = [];
        
        // Se não for admin, mostrar apenas chamados do usuário
        if (!hasPermission($payload['role'], 'ticket:read')) {
            $where[] = "requester_id = ?";
            $params[] = $payload['user_id'];
        }
        
        if ($status) {
            $where[] = "status = ?";
            $params[] = $status;
        }
        
        if ($priority) {
            $where[] = "priority = ?";
            $params[] = $priority;
        }
        
        if ($area) {
            $where[] = "area = ?";
            $params[] = $area;
        }
        
        if ($search) {
            $where[] = "(title LIKE ? OR description LIKE ? OR ticket_number LIKE ?)";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
            $params[] = "%{$search}%";
        }
        
        if ($requester) {
            $where[] = "requester_email LIKE ?";
            $params[] = "%{$requester}%";
        }
        
        if ($assignee) {
            $where[] = "assignee_email LIKE ?";
            $params[] = "%{$assignee}%";
        }
        
        $whereClause = !empty($where) ? 'WHERE ' . implode(' AND ', $where) : '';
        
        // Contar total
        $countSql = "SELECT COUNT(*) as total FROM tickets {$whereClause}";
        $total = $db->fetch($countSql, $params)['total'];
        
        // Buscar tickets
        $sql = "SELECT * FROM tickets {$whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;
        
        $tickets = $db->fetchAll($sql, $params);
        
        // Adicionar informações extras
        foreach ($tickets as &$ticket) {
            $ticket['formatted_created_at'] = formatDate($ticket['created_at']);
            $ticket['formatted_updated_at'] = formatDate($ticket['updated_at']);
            
            if ($ticket['closed_at']) {
                $ticket['formatted_closed_at'] = formatDate($ticket['closed_at']);
            }
        }
        
        jsonSuccess([
            'tickets' => $tickets,
            'pagination' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'pages' => ceil($total / $limit)
            ]
        ]);
        
    } catch (Exception $e) {
        jsonError('Erro ao listar chamados: ' . $e->getMessage());
    }
}

/**
 * Função para obter chamado específico
 */
function handleGetTicket($ticketId) {
    if (!$ticketId) {
        jsonError('ID do chamado não fornecido');
    }
    
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
        
        // Buscar ticket
        $ticket = $db->fetch("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
        
        if (!$ticket) {
            jsonError('Chamado não encontrado');
        }
        
        // Verificar permissão (usuário só pode ver seus próprios chamados, admin pode ver todos)
        if (!hasPermission($payload['role'], 'ticket:read') && $ticket['requester_id'] != $payload['user_id']) {
            jsonError('Acesso negado');
        }
        
        // Buscar atualizações
        $updates = $db->fetchAll("SELECT * FROM ticket_updates WHERE ticket_id = ? ORDER BY created_at ASC", [$ticketId]);
        
        // Formatar datas
        $ticket['formatted_created_at'] = formatDate($ticket['created_at']);
        $ticket['formatted_updated_at'] = formatDate($ticket['updated_at']);
        
        if ($ticket['closed_at']) {
            $ticket['formatted_closed_at'] = formatDate($ticket['closed_at']);
        }
        
        foreach ($updates as &$update) {
            $update['formatted_created_at'] = formatDate($update['created_at']);
        }
        
        $ticket['updates'] = $updates;
        
        jsonSuccess($ticket);
        
    } catch (Exception $e) {
        jsonError('Erro ao obter chamado: ' . $e->getMessage());
    }
}

/**
 * Função para assumir chamado
 */
function handleAssignTicket($ticketId) {
    if (!$ticketId) {
        jsonError('ID do chamado não fornecido');
    }
    
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
    if (!hasPermission($payload['role'], 'ticket:assign')) {
        jsonError('Acesso negado. Apenas administradores podem assumir chamados.');
    }
    
    try {
        $db = getDB();
        
        // Buscar ticket
        $ticket = $db->fetch("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
        
        if (!$ticket) {
            jsonError('Chamado não encontrado');
        }
        
        if ($ticket['status'] !== 'Aberto') {
            jsonError('Apenas chamados abertos podem ser assumidos');
        }
        
        // Obter dados do usuário
        $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$payload['user_id']]);
        
        // Atualizar ticket
        $db->update('tickets', [
            'status' => 'Em Andamento',
            'assignee_id' => $user['id'],
            'assignee_name' => $user['nome'],
            'assignee_email' => $user['email'],
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$ticketId]);
        
        // Adicionar atualização
        $db->insert('ticket_updates', [
            'ticket_id' => $ticketId,
            'user_id' => $user['id'],
            'user_name' => $user['nome'],
            'update_type' => 'assigned',
            'message' => "Chamado assumido por {$user['nome']}",
            'is_internal' => 0,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        // Log de auditoria
        logAudit($user['id'], 'assign_ticket', "Chamado #{$ticket['ticket_number']} assumido");
        
        jsonSuccess(null, 'Chamado assumido com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao assumir chamado: ' . $e->getMessage());
    }
}

/**
 * Função para fechar chamado
 */
function handleCloseTicket($ticketId) {
    if (!$ticketId) {
        jsonError('ID do chamado não fornecido');
    }
    
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
    if (!hasPermission($payload['role'], 'ticket:close')) {
        jsonError('Acesso negado. Apenas administradores podem fechar chamados.');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || empty($input['resolution_notes'])) {
        jsonError('Notas de resolução são obrigatórias');
    }
    
    try {
        $db = getDB();
        
        // Buscar ticket
        $ticket = $db->fetch("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
        
        if (!$ticket) {
            jsonError('Chamado não encontrado');
        }
        
        if ($ticket['status'] === 'Fechado') {
            jsonError('Chamado já está fechado');
        }
        
        // Obter dados do usuário
        $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$payload['user_id']]);
        
        // Atualizar ticket
        $db->update('tickets', [
            'status' => 'Fechado',
            'resolution_notes' => sanitizeInput($input['resolution_notes']),
            'closed_at' => date('Y-m-d H:i:s'),
            'closed_by' => $user['id'],
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$ticketId]);
        
        // Adicionar atualização
        $db->insert('ticket_updates', [
            'ticket_id' => $ticketId,
            'user_id' => $user['id'],
            'user_name' => $user['nome'],
            'update_type' => 'closed',
            'message' => "Chamado fechado por {$user['nome']}. Resolução: " . $input['resolution_notes'],
            'is_internal' => 0,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        // Log de auditoria
        logAudit($user['id'], 'close_ticket', "Chamado #{$ticket['ticket_number']} fechado");
        
        jsonSuccess(null, 'Chamado fechado com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao fechar chamado: ' . $e->getMessage());
    }
}

/**
 * Função para adicionar atualização ao chamado
 */
function handleAddUpdate($ticketId) {
    if (!$ticketId) {
        jsonError('ID do chamado não fornecido');
    }
    
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
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input || empty($input['message'])) {
        jsonError('Mensagem é obrigatória');
    }
    
    try {
        $db = getDB();
        
        // Buscar ticket
        $ticket = $db->fetch("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
        
        if (!$ticket) {
            jsonError('Chamado não encontrado');
        }
        
        // Verificar permissão (usuário só pode atualizar seus próprios chamados, admin pode atualizar todos)
        if (!hasPermission($payload['role'], 'ticket:update') && $ticket['requester_id'] != $payload['user_id']) {
            jsonError('Acesso negado');
        }
        
        // Obter dados do usuário
        $user = $db->fetch("SELECT * FROM users WHERE id = ?", [$payload['user_id']]);
        
        // Adicionar atualização
        $db->insert('ticket_updates', [
            'ticket_id' => $ticketId,
            'user_id' => $user['id'],
            'user_name' => $user['nome'],
            'update_type' => 'comment',
            'message' => sanitizeInput($input['message']),
            'is_internal' => $input['is_internal'] ?? 0,
            'created_at' => date('Y-m-d H:i:s')
        ]);
        
        // Atualizar data de modificação do ticket
        $db->update('tickets', [
            'updated_at' => date('Y-m-d H:i:s')
        ], 'id = ?', [$ticketId]);
        
        // Log de auditoria
        logAudit($user['id'], 'add_update', "Atualização adicionada ao chamado #{$ticket['ticket_number']}");
        
        jsonSuccess(null, 'Atualização adicionada com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao adicionar atualização: ' . $e->getMessage());
    }
}

/**
 * Função para obter estatísticas
 */
function handleGetStats() {
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
        
        $userId = $payload['user_id'];
        $userRole = $payload['role'];
        
        $stats = [];
        
        // Total de chamados
        if (hasPermission($userRole, 'ticket:read')) {
            $stats['total'] = $db->fetch("SELECT COUNT(*) as count FROM tickets")['count'];
            $stats['open'] = $db->fetch("SELECT COUNT(*) as count FROM tickets WHERE status = 'Aberto'")['count'];
            $stats['in_progress'] = $db->fetch("SELECT COUNT(*) as count FROM tickets WHERE status = 'Em Andamento'")['count'];
            $stats['closed'] = $db->fetch("SELECT COUNT(*) as count FROM tickets WHERE status = 'Fechado'")['count'];
        } else {
            // Usuário normal vê apenas seus chamados
            $stats['total'] = $db->fetch("SELECT COUNT(*) as count FROM tickets WHERE requester_id = ?", [$userId])['count'];
            $stats['open'] = $db->fetch("SELECT COUNT(*) as count FROM tickets WHERE requester_id = ? AND status = 'Aberto'", [$userId])['count'];
            $stats['in_progress'] = $db->fetch("SELECT COUNT(*) as count FROM tickets WHERE requester_id = ? AND status = 'Em Andamento'", [$userId])['count'];
            $stats['closed'] = $db->fetch("SELECT COUNT(*) as count FROM tickets WHERE requester_id = ? AND status = 'Fechado'", [$userId])['count'];
        }
        
        // Chamados por prioridade
        $priorityStats = $db->fetchAll("SELECT priority, COUNT(*) as count FROM tickets GROUP BY priority");
        $stats['by_priority'] = $priorityStats;
        
        // Chamados por área
        $areaStats = $db->fetchAll("SELECT area, COUNT(*) as count FROM tickets GROUP BY area");
        $stats['by_area'] = $areaStats;
        
        // Chamados por mês (últimos 6 meses)
        $monthlyStats = $db->fetchAll("
            SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as count 
            FROM tickets 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(created_at, '%Y-%m')
            ORDER BY month DESC
        ");
        $stats['by_month'] = $monthlyStats;
        
        jsonSuccess($stats);
        
    } catch (Exception $e) {
        jsonError('Erro ao obter estatísticas: ' . $e->getMessage());
    }
}

/**
 * Função para atualizar chamado
 */
function handleUpdateTicket($ticketId) {
    if (!$ticketId) {
        jsonError('ID do chamado não fornecido');
    }
    
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
    if (!hasPermission($payload['role'], 'ticket:update')) {
        jsonError('Acesso negado');
    }
    
    $input = json_decode(file_get_contents('php://input'), true);
    
    if (!$input) {
        jsonError('Dados inválidos');
    }
    
    try {
        $db = getDB();
        
        // Buscar ticket
        $ticket = $db->fetch("SELECT * FROM tickets WHERE id = ?", [$ticketId]);
        
        if (!$ticket) {
            jsonError('Chamado não encontrado');
        }
        
        $updateData = [];
        
        if (isset($input['title'])) {
            $updateData['title'] = sanitizeInput($input['title']);
        }
        
        if (isset($input['description'])) {
            $updateData['description'] = sanitizeInput($input['description']);
        }
        
        if (isset($input['priority'])) {
            $updateData['priority'] = sanitizeInput($input['priority']);
        }
        
        if (isset($input['area'])) {
            $updateData['area'] = sanitizeInput($input['area']);
        }
        
        if (empty($updateData)) {
            jsonError('Nenhum dado para atualizar');
        }
        
        $updateData['updated_at'] = date('Y-m-d H:i:s');
        
        $db->update('tickets', $updateData, 'id = ?', [$ticketId]);
        
        // Log de auditoria
        logAudit($payload['user_id'], 'update_ticket', "Chamado #{$ticket['ticket_number']} atualizado");
        
        jsonSuccess(null, 'Chamado atualizado com sucesso');
        
    } catch (Exception $e) {
        jsonError('Erro ao atualizar chamado: ' . $e->getMessage());
    }
}
?>
