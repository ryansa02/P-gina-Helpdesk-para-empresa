import express from 'express';
import { body, validationResult } from 'express-validator';
import { logAuditEvent } from '../database/storage.js';
import { hasPermission, PERMISSIONS, ROLES } from '../auth/sso.js';

export const adminRouter = express.Router();

// Get all users with pagination and filtering
adminRouter.get('/users', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      role,
      department,
      search,
      isActive
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    let params = [];

    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    if (department) {
      whereClause += ' AND department = ?';
      params.push(department);
    }
    if (search) {
      whereClause += ' AND (name LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive === 'true');
    }

    // Get total count
    const [countResult] = await req.db.execute(
      `SELECT COUNT(*) as total FROM users WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get users
    const [users] = await req.db.execute(`
      SELECT 
        id, email, name, role, department, position, phone,
        avatar_url, two_factor_enabled, is_active, last_login,
        created_at, updated_at
      FROM users 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Update user role and permissions
adminRouter.put('/users/:id', [
  body('role').isIn(Object.values(ROLES)).withMessage('Role inválida'),
  body('department').optional().trim().isLength({ min: 1, max: 100 }),
  body('position').optional().trim().isLength({ min: 1, max: 100 }),
  body('is_active').optional().isBoolean()
], async (req, res, next) => {
  try {
    const userId = req.params.id;
    const { role, department, position, is_active } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    // Get user permissions for the new role
    const rolePermissions = {
      [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
      [ROLES.ADMIN]: [
        PERMISSIONS.TICKET_CREATE,
        PERMISSIONS.TICKET_READ,
        PERMISSIONS.TICKET_UPDATE,
        PERMISSIONS.TICKET_ASSIGN,
        PERMISSIONS.TICKET_CLOSE,
        PERMISSIONS.USER_MANAGE,
        PERMISSIONS.REPORTS_VIEW,
        PERMISSIONS.REPORTS_EXPORT
      ],
      [ROLES.MANAGER]: [
        PERMISSIONS.TICKET_CREATE,
        PERMISSIONS.TICKET_READ,
        PERMISSIONS.TICKET_UPDATE,
        PERMISSIONS.TICKET_ASSIGN,
        PERMISSIONS.REPORTS_VIEW
      ],
      [ROLES.USER]: [
        PERMISSIONS.TICKET_CREATE,
        PERMISSIONS.TICKET_READ
      ],
      [ROLES.VIEWER]: [
        PERMISSIONS.TICKET_READ
      ]
    };

    const permissions = rolePermissions[role] || [];

    await req.db.execute(`
      UPDATE users SET
        role = ?, permissions = ?, department = ?, position = ?, is_active = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [role, JSON.stringify(permissions), department, position, is_active, userId]);

    // Log audit event
    await logAuditEvent(
      req.db,
      req.session.user.id,
      'USER_UPDATED',
      'user',
      userId,
      { role, department, position, is_active },
      req
    );

    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Get system statistics
adminRouter.get('/stats', async (req, res, next) => {
  try {
    // User statistics
    const [userStats] = await req.db.execute(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_users,
        COUNT(CASE WHEN role = 'ADMIN' THEN 1 END) as admin_users,
        COUNT(CASE WHEN two_factor_enabled = 1 THEN 1 END) as users_with_2fa
      FROM users
    `);

    // Ticket statistics
    const [ticketStats] = await req.db.execute(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'ABERTO' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'EM_ANALISE' THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN status = 'FECHADO' THEN 1 END) as closed_tickets,
        AVG(CASE WHEN actual_hours IS NOT NULL THEN actual_hours END) as avg_resolution_time
      FROM tickets
    `);

    // Recent activity
    const [recentActivity] = await req.db.execute(`
      SELECT 
        COUNT(*) as tickets_last_7_days,
        COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as tickets_last_24_hours
      FROM tickets
    `);

    // Department distribution
    const [departmentStats] = await req.db.execute(`
      SELECT department, COUNT(*) as count
      FROM users
      WHERE department IS NOT NULL
      GROUP BY department
    `);

    res.json({
      users: userStats[0],
      tickets: ticketStats[0],
      activity: recentActivity[0],
      departments: departmentStats
    });
  } catch (err) {
    next(err);
  }
});

// Get audit logs
adminRouter.get('/audit-logs', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      action,
      user_id,
      start_date,
      end_date
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = '1=1';
    let params = [];

    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }
    if (user_id) {
      whereClause += ' AND user_id = ?';
      params.push(user_id);
    }
    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date);
    }

    // Get total count
    const [countResult] = await req.db.execute(
      `SELECT COUNT(*) as total FROM audit_logs WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get audit logs
    const [logs] = await req.db.execute(`
      SELECT 
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    next(err);
  }
});

// Get system settings
adminRouter.get('/settings', async (req, res, next) => {
  try {
    const [settings] = await req.db.execute(`
      SELECT setting_key, setting_value, setting_type, description, is_public
      FROM settings
      ORDER BY setting_key
    `);

    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Update system settings
adminRouter.put('/settings/:key', [
  body('value').notEmpty().withMessage('Valor é obrigatório')
], async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    await req.db.execute(`
      UPDATE settings SET
        setting_value = ?, updated_at = NOW()
      WHERE setting_key = ?
    `, [value, key]);

    // Log audit event
    await logAuditEvent(
      req.db,
      req.session.user.id,
      'SETTING_UPDATED',
      'setting',
      key,
      { oldValue: req.body.oldValue, newValue: value },
      req
    );

    res.json({ message: 'Configuração atualizada com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Get categories
adminRouter.get('/categories', async (req, res, next) => {
  try {
    const [categories] = await req.db.execute(`
      SELECT * FROM categories
      WHERE is_active = 1
      ORDER BY area, name
    `);

    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

// Create category
adminRouter.post('/categories', [
  body('name').trim().isLength({ min: 1, max: 100 }).withMessage('Nome deve ter entre 1 e 100 caracteres'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('area').isIn(['TI', 'RH', 'Financeiro', 'Comercial']).withMessage('Área inválida'),
  body('sla_hours').isInt({ min: 1, max: 720 }).withMessage('SLA deve ser entre 1 e 720 horas')
], async (req, res, next) => {
  try {
    const { name, description, area, sla_hours } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    await req.db.execute(`
      INSERT INTO categories (name, description, area, sla_hours)
      VALUES (?, ?, ?, ?)
    `, [name, description, area, sla_hours]);

    res.status(201).json({ message: 'Categoria criada com sucesso' });
  } catch (err) {
    next(err);
  }
});

export { adminRouter };
