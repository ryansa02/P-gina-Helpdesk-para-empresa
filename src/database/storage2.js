import mysql from 'mysql2/promise';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export async function createDatabasePool() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const database = process.env.MYSQL_DATABASE || 'csc_georgia';

  // Ensure database exists first
  try {
    const bootstrap = await mysql.createConnection({ 
      host, 
      port, 
      user, 
      password, 
      multipleStatements: true 
    });
    
    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await bootstrap.end();
    
    logger.info('Database created successfully');
  } catch (error) {
    logger.error('Error creating database:', error);
    throw error;
  }

  const pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true
  });

  return pool;
}

export async function ensureSchema(pool) {
  try {
    // Users table with enhanced fields
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        role ENUM('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER', 'VIEWER') NOT NULL DEFAULT 'USER',
        permissions JSON,
        department VARCHAR(100),
        position VARCHAR(100),
        phone VARCHAR(20),
        avatar_url VARCHAR(500),
        two_factor_secret VARCHAR(32),
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        last_login TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role),
        INDEX idx_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Tickets table with comprehensive fields
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_number VARCHAR(20) UNIQUE NOT NULL,
        requester_id VARCHAR(36) NOT NULL,
        requester_email VARCHAR(255) NOT NULL,
        requester_name VARCHAR(255) NOT NULL,
        assignee_id VARCHAR(36) NULL,
        assignee_email VARCHAR(255) NULL,
        assignee_name VARCHAR(255) NULL,
        area VARCHAR(100) NOT NULL,
        board VARCHAR(100) NOT NULL,
        priority ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
        status ENUM('ABERTO', 'EM_ANALISE', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO', 'CANCELADO') DEFAULT 'ABERTO',
        category VARCHAR(100),
        subcategory VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        description_open TEXT NOT NULL,
        description_close TEXT NULL,
        resolution_notes TEXT NULL,
        estimated_hours DECIMAL(5,2) NULL,
        actual_hours DECIMAL(5,2) NULL,
        due_date TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL,
        closed_by VARCHAR(36) NULL,
        tags JSON,
        attachments JSON,
        FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (closed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_ticket_number (ticket_number),
        INDEX idx_status (status),
        INDEX idx_priority (priority),
        INDEX idx_area (area),
        INDEX idx_requester (requester_email),
        INDEX idx_assignee (assignee_email),
        INDEX idx_created_at (created_at),
        INDEX idx_due_date (due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Ticket updates/history table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS ticket_updates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ticket_id INT NOT NULL,
        updater_id VARCHAR(36) NOT NULL,
        updater_email VARCHAR(255) NOT NULL,
        updater_name VARCHAR(255) NOT NULL,
        update_type ENUM('COMMENT', 'STATUS_CHANGE', 'ASSIGNMENT', 'PRIORITY_CHANGE', 'DUE_DATE_CHANGE', 'RESOLUTION') NOT NULL,
        update_text TEXT NOT NULL,
        old_value JSON NULL,
        new_value JSON NULL,
        is_internal BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
        FOREIGN KEY (updater_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_ticket_id (ticket_id),
        INDEX idx_updater (updater_email),
        INDEX idx_update_type (update_type),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Audit logs table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NULL,
        user_email VARCHAR(255) NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(50) NULL,
        resource_id VARCHAR(50) NULL,
        details JSON,
        ip_address VARCHAR(45),
        user_agent TEXT,
        country VARCHAR(2),
        city VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_resource (resource_type, resource_id),
        INDEX idx_created_at (created_at),
        INDEX idx_ip_address (ip_address)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Notifications table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        type ENUM('TICKET_ASSIGNED', 'TICKET_UPDATED', 'TICKET_CLOSED', 'SYSTEM_ALERT', 'REPORT_READY') NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        data JSON,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_type (type),
        INDEX idx_is_read (is_read),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Reports table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type ENUM('TICKET_SUMMARY', 'USER_ACTIVITY', 'PERFORMANCE', 'CUSTOM') NOT NULL,
        parameters JSON,
        created_by VARCHAR(36) NOT NULL,
        is_public BOOLEAN DEFAULT FALSE,
        schedule_cron VARCHAR(100) NULL,
        last_generated TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_type (type),
        INDEX idx_created_by (created_by),
        INDEX idx_is_public (is_public)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Settings table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        setting_type ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
        description TEXT,
        is_public BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Departments table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        manager_id VARCHAR(36) NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_name (name),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Categories table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        area VARCHAR(100) NOT NULL,
        sla_hours INT DEFAULT 24,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_area_name (area, name),
        INDEX idx_area (area),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Insert default settings
    await pool.execute(`
      INSERT IGNORE INTO settings (setting_key, setting_value, setting_type, description, is_public) VALUES
      ('system_name', 'CSC Geórgia Contábil', 'STRING', 'Nome do sistema', TRUE),
      ('system_version', '1.0.0', 'STRING', 'Versão do sistema', TRUE),
      ('default_sla_hours', '24', 'NUMBER', 'SLA padrão em horas', FALSE),
      ('max_attachments_per_ticket', '10', 'NUMBER', 'Máximo de anexos por chamado', FALSE),
      ('max_attachment_size_mb', '10', 'NUMBER', 'Tamanho máximo de anexo em MB', FALSE),
      ('enable_notifications', 'true', 'BOOLEAN', 'Habilitar notificações', TRUE),
      ('enable_2fa', 'false', 'BOOLEAN', 'Habilitar autenticação de dois fatores', FALSE),
      ('session_timeout_minutes', '1440', 'NUMBER', 'Timeout da sessão em minutos', FALSE),
      ('allowed_file_types', '["jpg","jpeg","png","gif","pdf","doc","docx","xls","xlsx","txt","zip","rar"]', 'JSON', 'Tipos de arquivo permitidos', FALSE)
    `);

    // Insert default categories
    await pool.execute(`
      INSERT IGNORE INTO categories (name, description, area, sla_hours) VALUES
      ('Problema de Login', 'Problemas relacionados ao acesso ao sistema', 'TI', 2),
      ('Problema de Hardware', 'Problemas com computadores, impressoras, etc.', 'TI', 4),
      ('Problema de Software', 'Problemas com aplicativos e programas', 'TI', 8),
      ('Solicitação de Acesso', 'Solicitações de novos acessos ou permissões', 'TI', 24),
      ('Folha de Pagamento', 'Problemas relacionados à folha de pagamento', 'RH', 4),
      ('Benefícios', 'Questões relacionadas a benefícios', 'RH', 8),
      ('Contratos', 'Problemas com contratos de trabalho', 'RH', 24),
      ('Pagamentos', 'Problemas com pagamentos e transferências', 'Financeiro', 4),
      ('Relatórios', 'Solicitações de relatórios financeiros', 'Financeiro', 8),
      ('Vendas', 'Questões relacionadas a vendas', 'Comercial', 4),
      ('Clientes', 'Problemas com clientes', 'Comercial', 8)
    `);

    logger.info('Database schema created successfully');
  } catch (error) {
    logger.error('Error creating schema:', error);
    throw error;
  }
}

// Function to generate ticket number
export async function generateTicketNumber(pool) {
  const [result] = await pool.execute(`
    SELECT COUNT(*) as count FROM tickets 
    WHERE DATE(created_at) = CURDATE()
  `);
  
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = (result[0].count + 1).toString().padStart(4, '0');
  
  return `CSC${today}${sequence}`;
}

// Function to get user permissions
export async function getUserPermissions(pool, userId) {
  const [rows] = await pool.execute(
    'SELECT permissions FROM users WHERE id = ?',
    [userId]
  );
  
  if (rows.length === 0) return [];
  
  try {
    return JSON.parse(rows[0].permissions || '[]');
  } catch {
    return [];
  }
}

// Function to log audit event
export async function logAuditEvent(pool, userId, action, resourceType = null, resourceId = null, details = null, req = null) {
  try {
    await pool.execute(`
      INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, details, ip_address, user_agent) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      req?.session?.user?.email || null,
      action,
      resourceType,
      resourceId,
      details ? JSON.stringify(details) : null,
      req?.ip || null,
      req?.get('User-Agent') || null
    ]);
  } catch (error) {
    logger.error('Error logging audit event:', error);
  }
}
