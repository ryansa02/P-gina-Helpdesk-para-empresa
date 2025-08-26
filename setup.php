<?php
/**
 * Setup do Sistema CSC
 * CSC Geórgia Contábil - Centro de Serviços Compartilhados
 */

// Verificar se o arquivo de configuração existe
if (!file_exists('config/database.php')) {
    die('Arquivo de configuração não encontrado. Certifique-se de que o arquivo config/database.php existe.');
}

require_once 'config/database.php';

// Função para verificar requisitos
function checkRequirements() {
    $requirements = [];
    
    // Verificar versão do PHP
    $requirements['php_version'] = [
        'name' => 'Versão do PHP',
        'required' => '7.4+',
        'current' => PHP_VERSION,
        'status' => version_compare(PHP_VERSION, '7.4.0', '>=')
    ];
    
    // Verificar extensões PHP
    $extensions = ['pdo', 'pdo_mysql', 'json', 'mbstring'];
    foreach ($extensions as $ext) {
        $requirements['ext_' . $ext] = [
            'name' => 'Extensão ' . strtoupper($ext),
            'required' => 'Instalada',
            'current' => extension_loaded($ext) ? 'Instalada' : 'Não instalada',
            'status' => extension_loaded($ext)
        ];
    }
    
    // Verificar permissões de diretório
    $directories = ['uploads', 'logs'];
    foreach ($directories as $dir) {
        if (!file_exists($dir)) {
            mkdir($dir, 0755, true);
        }
        $requirements['dir_' . $dir] = [
            'name' => 'Diretório ' . $dir,
            'required' => 'Gravável',
            'current' => is_writable($dir) ? 'Gravável' : 'Não gravável',
            'status' => is_writable($dir)
        ];
    }
    
    return $requirements;
}

// Função para testar conexão com banco
function testDatabaseConnection() {
    try {
        $db = getDB();
        $db->query("SELECT 1");
        return ['status' => true, 'message' => 'Conexão com banco de dados OK'];
    } catch (Exception $e) {
        return ['status' => false, 'message' => 'Erro na conexão: ' . $e->getMessage()];
    }
}

// Função para criar tabelas
function createTables() {
    try {
        $db = getDB();
        $schema = file_get_contents('db/schema.sql');
        
        // Executar comandos SQL
        $commands = explode(';', $schema);
        foreach ($commands as $command) {
            $command = trim($command);
            if (!empty($command)) {
                $db->query($command);
            }
        }
        
        return ['status' => true, 'message' => 'Tabelas criadas com sucesso'];
    } catch (Exception $e) {
        return ['status' => false, 'message' => 'Erro ao criar tabelas: ' . $e->getMessage()];
    }
}

// Função para verificar se as tabelas existem
function checkTables() {
    try {
        $db = getDB();
        $tables = ['users', 'tickets', 'ticket_updates', 'audit_logs', 'notifications', 'settings'];
        $existing = [];
        
        foreach ($tables as $table) {
            $result = $db->query("SHOW TABLES LIKE ?", [$table]);
            $existing[$table] = $result->rowCount() > 0;
        }
        
        return $existing;
    } catch (Exception $e) {
        return false;
    }
}

// Processar ações
$action = $_GET['action'] ?? '';
$message = '';
$messageType = '';

if ($action === 'create_tables') {
    $result = createTables();
    $message = $result['message'];
    $messageType = $result['status'] ? 'success' : 'error';
}

// Verificar requisitos
$requirements = checkRequirements();
$dbConnection = testDatabaseConnection();
$tables = checkTables();

$allRequirementsMet = true;
foreach ($requirements as $req) {
    if (!$req['status']) {
        $allRequirementsMet = false;
        break;
    }
}
?>

<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup - CSC Geórgia Contábil</title>
    <style>
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f172a;
            color: #f8fafc;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: #1e293b;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #3b82f6;
            margin: 0;
            font-size: 2.5rem;
            font-weight: 700;
        }
        .header p {
            color: #94a3b8;
            margin: 10px 0 0 0;
        }
        .section {
            margin-bottom: 30px;
            padding: 20px;
            background: #334155;
            border-radius: 8px;
        }
        .section h2 {
            color: #e2e8f0;
            margin: 0 0 20px 0;
            font-size: 1.5rem;
            font-weight: 600;
        }
        .requirement {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 0;
            border-bottom: 1px solid #475569;
        }
        .requirement:last-child {
            border-bottom: none;
        }
        .requirement-name {
            font-weight: 500;
        }
        .requirement-status {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .status-ok {
            color: #22c55e;
        }
        .status-error {
            color: #ef4444;
        }
        .status-warning {
            color: #f59e0b;
        }
        .btn {
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 500;
            text-decoration: none;
            display: inline-block;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background: #2563eb;
        }
        .btn:disabled {
            background: #64748b;
            cursor: not-allowed;
        }
        .btn-success {
            background: #22c55e;
        }
        .btn-success:hover {
            background: #16a34a;
        }
        .message {
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }
        .message.success {
            background: #dcfce7;
            color: #166534;
            border: 1px solid #22c55e;
        }
        .message.error {
            background: #fef2f2;
            color: #991b1b;
            border: 1px solid #ef4444;
        }
        .table-status {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
            align-items: center;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #475569;
            border-radius: 4px;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            background: #22c55e;
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Setup do Sistema</h1>
            <p>CSC Geórgia Contábil - Centro de Serviços Compartilhados</p>
        </div>

        <?php if ($message): ?>
            <div class="message <?= $messageType ?>">
                <?= htmlspecialchars($message) ?>
            </div>
        <?php endif; ?>

        <!-- Verificação de Requisitos -->
        <div class="section">
            <h2>📋 Verificação de Requisitos</h2>
            <?php foreach ($requirements as $req): ?>
                <div class="requirement">
                    <div class="requirement-name"><?= htmlspecialchars($req['name']) ?></div>
                    <div class="requirement-status">
                        <span><?= htmlspecialchars($req['current']) ?></span>
                        <span class="status-<?= $req['status'] ? 'ok' : 'error' ?>">
                            <?= $req['status'] ? '✅' : '❌' ?>
                        </span>
                    </div>
                </div>
            <?php endforeach; ?>
            
            <div style="margin-top: 20px;">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: <?= ($allRequirementsMet ? 100 : 50) ?>%"></div>
                </div>
                <p style="text-align: center; margin-top: 10px; color: #94a3b8;">
                    <?= $allRequirementsMet ? 'Todos os requisitos atendidos!' : 'Alguns requisitos não foram atendidos' ?>
                </p>
            </div>
        </div>

        <!-- Conexão com Banco de Dados -->
        <div class="section">
            <h2>🗄️ Conexão com Banco de Dados</h2>
            <div class="requirement">
                <div class="requirement-name">Status da Conexão</div>
                <div class="requirement-status">
                    <span><?= htmlspecialchars($dbConnection['message']) ?></span>
                    <span class="status-<?= $dbConnection['status'] ? 'ok' : 'error' ?>">
                        <?= $dbConnection['status'] ? '✅' : '❌' ?>
                    </span>
                </div>
            </div>
        </div>

        <!-- Tabelas do Banco -->
        <div class="section">
            <h2>📊 Tabelas do Banco de Dados</h2>
            <?php if ($tables): ?>
                <?php 
                $totalTables = count($tables);
                $existingTables = array_sum($tables);
                ?>
                <?php foreach ($tables as $table => $exists): ?>
                    <div class="requirement">
                        <div class="requirement-name">Tabela <?= htmlspecialchars($table) ?></div>
                        <div class="requirement-status">
                            <span><?= $exists ? 'Existe' : 'Não existe' ?></span>
                            <span class="status-<?= $exists ? 'ok' : 'error' ?>">
                                <?= $exists ? '✅' : '❌' ?>
                            </span>
                        </div>
                    </div>
                <?php endforeach; ?>
                
                <div style="margin-top: 20px;">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: <?= ($existingTables / $totalTables) * 100 ?>%"></div>
                    </div>
                    <p style="text-align: center; margin-top: 10px; color: #94a3b8;">
                        <?= $existingTables ?>/<?= $totalTables ?> tabelas existem
                    </p>
                </div>
                
                <?php if ($existingTables < $totalTables): ?>
                    <div style="margin-top: 20px; text-align: center;">
                        <a href="?action=create_tables" class="btn">Criar Tabelas</a>
                    </div>
                <?php endif; ?>
            <?php else: ?>
                <p style="color: #ef4444;">Erro ao verificar tabelas. Verifique a conexão com o banco.</p>
            <?php endif; ?>
        </div>

        <!-- Próximos Passos -->
        <div class="section">
            <h2>🚀 Próximos Passos</h2>
            <?php if ($allRequirementsMet && $dbConnection['status'] && $existingTables === $totalTables): ?>
                <div style="text-align: center;">
                    <p style="color: #22c55e; font-size: 1.2rem; margin-bottom: 20px;">
                        ✅ Sistema configurado com sucesso!
                    </p>
                    <a href="index.html" class="btn btn-success">Acessar o Sistema</a>
                </div>
            <?php else: ?>
                <div style="color: #f59e0b;">
                    <p><strong>Atenção:</strong> Alguns requisitos não foram atendidos. Verifique os itens acima antes de prosseguir.</p>
                    <ul style="margin-top: 10px;">
                        <li>Certifique-se de que o PHP 7.4+ está instalado</li>
                        <li>Verifique se as extensões PDO e PDO_MySQL estão habilitadas</li>
                        <li>Configure corretamente as credenciais do banco em config/database.php</li>
                        <li>Certifique-se de que o MySQL está rodando</li>
                    </ul>
                </div>
            <?php endif; ?>
        </div>

        <!-- Informações do Sistema -->
        <div class="section">
            <h2>ℹ️ Informações do Sistema</h2>
            <div class="requirement">
                <div class="requirement-name">Versão do Sistema</div>
                <div class="requirement-status">
                    <span><?= APP_VERSION ?></span>
                </div>
            </div>
            <div class="requirement">
                <div class="requirement-name">Nome do Sistema</div>
                <div class="requirement-status">
                    <span><?= APP_NAME ?></span>
                </div>
            </div>
            <div class="requirement">
                <div class="requirement-name">URL Base</div>
                <div class="requirement-status">
                    <span><?= APP_URL ?></span>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
