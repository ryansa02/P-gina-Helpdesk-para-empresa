-- Criação do banco e tabelas para o CSC
-- CSC Geórgia Contábil - Centro de Serviços Compartilhados

-- Criar banco de dados
-- CREATE DATABASE IF NOT EXISTS csc_georgia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE csc_georgia; -- deixe o DB selecionado na conexão

-- Tabela de usuários
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    area VARCHAR(100) NOT NULL,
    quadro VARCHAR(100) NOT NULL,
    role ENUM('SUPER_ADMIN', 'ADMIN', 'USER') DEFAULT 'USER',
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_active (is_active)
);

-- Tabela de chamados
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_number VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    area VARCHAR(100) NOT NULL,
    priority ENUM('Baixa', 'Média', 'Alta', 'Crítica') DEFAULT 'Média',
    quadro VARCHAR(100) NOT NULL,
    status ENUM('Aberto', 'Em Andamento', 'Fechado') DEFAULT 'Aberto',
    requester_id INT NOT NULL,
    requester_name VARCHAR(255) NOT NULL,
    requester_email VARCHAR(255) NOT NULL,
    assignee_id INT NULL,
    assignee_name VARCHAR(255) NULL,
    assignee_email VARCHAR(255) NULL,
    resolution_notes TEXT NULL,
    closed_at DATETIME NULL,
    closed_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_ticket_number (ticket_number),
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_area (area),
    INDEX idx_requester (requester_id),
    INDEX idx_assignee (assignee_id),
    INDEX idx_created_at (created_at)
);

-- Tabela de atualizações dos chamados
CREATE TABLE IF NOT EXISTS ticket_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    user_id INT NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    update_type ENUM('created', 'assigned', 'closed', 'comment', 'status_change') NOT NULL,
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_ticket_id (ticket_id),
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at)
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_action (action),
    INDEX idx_created_at (created_at)
);

-- Tabela de notificações
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at)
);

-- Tabela de configurações do sistema
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NOT NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_setting_key (setting_key)
);

-- Tabela de departamentos
CREATE TABLE IF NOT EXISTS departments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_active (is_active)
);

-- Tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    department_id INT NULL,
    description TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    INDEX idx_name (name),
    INDEX idx_department (department_id),
    INDEX idx_active (is_active)
);

-- Inserir dados iniciais

-- Configurações padrão
INSERT INTO settings (setting_key, setting_value, description) VALUES
('system_name', 'CSC Geórgia Contábil', 'Nome do sistema'),
('system_version', '1.0.0', 'Versão do sistema'),
('max_tickets_per_user', '50', 'Máximo de chamados por usuário'),
('ticket_auto_close_days', '30', 'Dias para fechamento automático de chamados'),
('notification_email', 'noreply@georgiacontabil.com.br', 'Email para notificações'),
('maintenance_mode', 'false', 'Modo de manutenção');

-- Departamentos padrão
INSERT INTO departments (name, description) VALUES
('TI', 'Tecnologia da Informação'),
('RH', 'Recursos Humanos'),
('Financeiro', 'Financeiro'),
('Contábil', 'Contábil'),
('Administrativo', 'Administrativo'),
('Comercial', 'Comercial'),
('Operacional', 'Operacional');

-- Categorias padrão
INSERT INTO categories (name, department_id, description) VALUES
('Suporte TI', 1, 'Suporte técnico de TI'),
('Solicitações RH', 2, 'Solicitações de recursos humanos'),
('Financeiro', 3, 'Assuntos financeiros'),
('Contábil', 4, 'Assuntos contábeis'),
('Administrativo', 5, 'Assuntos administrativos'),
('Comercial', 6, 'Assuntos comerciais'),
('Operacional', 7, 'Assuntos operacionais');

-- Inserir usuário super admin (ryan31624@gmail.com)
INSERT INTO users (nome, email, area, quadro, role, is_active) VALUES
('Ryan Sá', 'ryan31624@gmail.com', 'TI', 'Suporte TI', 'SUPER_ADMIN', TRUE);

-- Criar views úteis

-- View para estatísticas de chamados
CREATE OR REPLACE VIEW ticket_stats AS
SELECT 
    COUNT(*) as total_tickets,
    SUM(CASE WHEN status = 'Aberto' THEN 1 ELSE 0 END) as open_tickets,
    SUM(CASE WHEN status = 'Em Andamento' THEN 1 ELSE 0 END) as in_progress_tickets,
    SUM(CASE WHEN status = 'Fechado' THEN 1 ELSE 0 END) as closed_tickets,
    AVG(CASE WHEN status = 'Fechado' THEN TIMESTAMPDIFF(HOUR, created_at, closed_at) ELSE NULL END) as avg_resolution_hours
FROM tickets;

-- View para chamados com informações completas
CREATE OR REPLACE VIEW ticket_details AS
SELECT 
    t.*,
    u.nome as requester_full_name,
    u.email as requester_full_email,
    a.nome as assignee_full_name,
    a.email as assignee_full_email,
    c.nome as closed_by_name
FROM tickets t
LEFT JOIN users u ON t.requester_id = u.id
LEFT JOIN users a ON t.assignee_id = a.id
LEFT JOIN users c ON t.closed_by = c.id;

-- Triggers para auditoria automática

-- Trigger para log de criação de usuários
DELIMITER //
CREATE TRIGGER after_user_insert
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, action, details)
    VALUES (NEW.id, 'user_created', CONCAT('Usuário criado: ', NEW.nome, ' (', NEW.email, ')'));
END//

-- Trigger para log de criação de chamados
CREATE TRIGGER after_ticket_insert
AFTER INSERT ON tickets
FOR EACH ROW
BEGIN
    INSERT INTO audit_logs (user_id, action, details)
    VALUES (NEW.requester_id, 'ticket_created', CONCAT('Chamado criado: #', NEW.ticket_number, ' - ', NEW.title));
END//

-- Trigger para log de fechamento de chamados
CREATE TRIGGER after_ticket_close
AFTER UPDATE ON tickets
FOR EACH ROW
BEGIN
    IF NEW.status = 'Fechado' AND OLD.status != 'Fechado' THEN
        INSERT INTO audit_logs (user_id, action, details)
        VALUES (NEW.closed_by, 'ticket_closed', CONCAT('Chamado fechado: #', NEW.ticket_number, ' - ', NEW.title));
    END IF;
END//

DELIMITER ;

-- Índices adicionais para performance
CREATE INDEX idx_tickets_status_priority ON tickets(status, priority);
CREATE INDEX idx_tickets_requester_status ON tickets(requester_id, status);
CREATE INDEX idx_tickets_assignee_status ON tickets(assignee_id, status);
CREATE INDEX idx_tickets_created_status ON tickets(created_at, status);
CREATE INDEX idx_updates_ticket_type ON ticket_updates(ticket_id, update_type);
CREATE INDEX idx_audit_user_action ON audit_logs(user_id, action);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);

-- Comentários das tabelas
ALTER TABLE users COMMENT = 'Tabela de usuários do sistema CSC';
ALTER TABLE tickets COMMENT = 'Tabela de chamados/tickets do sistema';
ALTER TABLE ticket_updates COMMENT = 'Tabela de atualizações e comentários dos chamados';
ALTER TABLE audit_logs COMMENT = 'Tabela de logs de auditoria do sistema';
ALTER TABLE notifications COMMENT = 'Tabela de notificações dos usuários';
ALTER TABLE settings COMMENT = 'Tabela de configurações do sistema';
ALTER TABLE departments COMMENT = 'Tabela de departamentos';
ALTER TABLE categories COMMENT = 'Tabela de categorias de chamados';

-- Verificar se as tabelas foram criadas corretamente
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'csc_georgia'
ORDER BY TABLE_NAME;

