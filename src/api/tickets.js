import express from 'express';
import { body, validationResult } from 'express-validator';
import { generateTicketNumber, logAuditEvent } from '../database/storage.js';
import { hasPermission, PERMISSIONS } from '../auth/sso.js';

export const apiRouter = express.Router();

// Validation middleware
const validateTicket = [
  body('title').trim().isLength({ min: 5, max: 255 }).withMessage('Título deve ter entre 5 e 255 caracteres'),
  body('description').trim().isLength({ min: 10 }).withMessage('Descrição deve ter pelo menos 10 caracteres'),
  body('area').isIn(['TI', 'RH', 'Financeiro', 'Comercial']).withMessage('Área inválida'),
  body('board').isIn(['Incidentes', 'Solicitações']).withMessage('Quadro inválido'),
  body('priority').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).withMessage('Prioridade inválida'),
  body('category').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Categoria inválida'),
  body('due_date').optional().isISO8601().withMessage('Data de vencimento inválida')
];

const validateUpdate = [
  body('update_text').trim().isLength({ min: 5 }).withMessage('Comentário deve ter pelo menos 5 caracteres'),
  body('is_internal').optional().isBoolean().withMessage('Campo interno deve ser booleano')
];

// Get current user info with permissions
apiRouter.get('/me', (req, res) => {
  const user = req.session.user;
  const isAdmin = hasPermission(user.role, PERMISSIONS.TICKET_ASSIGN);
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  
  res.json({ 
    user: { 
      ...user, 
      canAssign: isAdmin,
      canManageUsers: isSuperAdmin,
      canViewReports: hasPermission(user.role, PERMISSIONS.REPORTS_VIEW)
    } 
  });
});

// Get tickets with filtering and pagination
apiRouter.get('/tickets', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      priority,
      area,
      assignee,
      requester,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const isAdmin = hasPermission(req.session.user.role, PERMISSIONS.TICKET_ASSIGN);
    
    let whereClause = isAdmin ? '1=1' : 'requester_email = ?';
    let params = isAdmin ? [] : [req.session.user.email];
    
    // Add filters
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    if (priority) {
      whereClause += ' AND priority = ?';
      params.push(priority);
    }
    if (area) {
      whereClause += ' AND area = ?';
      params.push(area);
    }
    if (assignee) {
      whereClause += ' AND assignee_email = ?';
      params.push(assignee);
    }
    if (requester) {
      whereClause += ' AND requester_email = ?';
      params.push(requester);
    }
    if (search) {
      whereClause += ' AND (title LIKE ? OR description_open LIKE ? OR ticket_number LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // Get total count
    const [countResult] = await req.db.execute(
      `SELECT COUNT(*) as total FROM tickets WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get tickets
    const [tickets] = await req.db.execute(`
      SELECT 
        t.*,
        u1.name as requester_full_name,
        u2.name as assignee_full_name,
        u3.name as closed_by_name,
        COUNT(tu.id) as update_count
      FROM tickets t
      LEFT JOIN users u1 ON t.requester_id = u1.id
      LEFT JOIN users u2 ON t.assignee_id = u2.id
      LEFT JOIN users u3 ON t.closed_by = u3.id
      LEFT JOIN ticket_updates tu ON t.id = tu.ticket_id
      WHERE ${whereClause}
      GROUP BY t.id
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      tickets,
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

// Get single ticket with updates
apiRouter.get('/tickets/:id', async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.id);
    const isAdmin = hasPermission(req.session.user.role, PERMISSIONS.TICKET_ASSIGN);
    
    const [tickets] = await req.db.execute(`
      SELECT 
        t.*,
        u1.name as requester_full_name,
        u2.name as assignee_full_name,
        u3.name as closed_by_name
      FROM tickets t
      LEFT JOIN users u1 ON t.requester_id = u1.id
      LEFT JOIN users u2 ON t.assignee_id = u2.id
      LEFT JOIN users u3 ON t.closed_by = u3.id
      WHERE t.id = ? ${!isAdmin ? 'AND t.requester_email = ?' : ''}
    `, isAdmin ? [ticketId] : [ticketId, req.session.user.email]);

    if (!tickets[0]) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    // Get ticket updates
    const [updates] = await req.db.execute(`
      SELECT tu.*, u.name as updater_full_name
      FROM ticket_updates tu
      LEFT JOIN users u ON tu.updater_id = u.id
      WHERE tu.ticket_id = ?
      ORDER BY tu.created_at ASC
    `, [ticketId]);

    res.json({
      ticket: tickets[0],
      updates
    });
  } catch (err) {
    next(err);
  }
});

// Create new ticket
apiRouter.post('/tickets', validateTicket, async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      area,
      board,
      priority = 'MEDIUM',
      category,
      subcategory,
      due_date,
      tags
    } = req.body;

    // Generate ticket number
    const ticketNumber = await generateTicketNumber(req.db);

    const [result] = await req.db.execute(`
      INSERT INTO tickets (
        ticket_number, requester_id, requester_email, requester_name,
        area, board, priority, category, subcategory, title,
        description_open, due_date, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      ticketNumber,
      req.session.user.id,
      req.session.user.email,
      req.session.user.name,
      area,
      board,
      priority,
      category,
      subcategory,
      title,
      description,
      due_date || null,
      tags ? JSON.stringify(tags) : null
    ]);

    const ticketId = result.insertId;

    // Add initial update
    await req.db.execute(`
      INSERT INTO ticket_updates (
        ticket_id, updater_id, updater_email, updater_name,
        update_type, update_text
      ) VALUES (?, ?, ?, ?, 'COMMENT', ?)
    `, [
      ticketId,
      req.session.user.id,
      req.session.user.email,
      req.session.user.name,
      `Chamado aberto: ${description}`
    ]);

    // Log audit event
    await logAuditEvent(
      req.db,
      req.session.user.id,
      'TICKET_CREATED',
      'ticket',
      ticketId,
      { ticketNumber, title, area, priority },
      req
    );

    res.status(201).json({ 
      id: ticketId,
      ticketNumber,
      message: 'Chamado criado com sucesso'
    });
  } catch (err) {
    next(err);
  }
});

// Update ticket
apiRouter.put('/tickets/:id', validateTicket, async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.id);
    const isAdmin = hasPermission(req.session.user.role, PERMISSIONS.TICKET_UPDATE);
    
    // Check if user can update this ticket
    const [tickets] = await req.db.execute(
      'SELECT * FROM tickets WHERE id = ? AND (requester_email = ? OR ?)',
      [ticketId, req.session.user.email, isAdmin]
    );

    if (!tickets[0]) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    const {
      title,
      description,
      area,
      board,
      priority,
      category,
      subcategory,
      due_date,
      tags
    } = req.body;

    await req.db.execute(`
      UPDATE tickets SET
        title = ?, description_open = ?, area = ?, board = ?,
        priority = ?, category = ?, subcategory = ?, due_date = ?, tags = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [
      title, description, area, board, priority, category, subcategory,
      due_date || null, tags ? JSON.stringify(tags) : null, ticketId
    ]);

    // Log audit event
    await logAuditEvent(
      req.db,
      req.session.user.id,
      'TICKET_UPDATED',
      'ticket',
      ticketId,
      { title, area, priority },
      req
    );

    res.json({ message: 'Chamado atualizado com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Assign ticket
apiRouter.post('/tickets/:id/assign', async (req, res, next) => {
  try {
    if (!hasPermission(req.session.user.role, PERMISSIONS.TICKET_ASSIGN)) {
      return res.status(403).json({ error: 'Sem permissão para assumir chamados' });
    }

    const ticketId = parseInt(req.params.id);
    const { assignee_email } = req.body;

    // Verify ticket exists
    const [tickets] = await req.db.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!tickets[0]) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    // Get assignee info
    const [users] = await req.db.execute('SELECT id, name FROM users WHERE email = ?', [assignee_email]);
    if (!users[0]) {
      return res.status(400).json({ error: 'Usuário não encontrado' });
    }

    await req.db.execute(`
      UPDATE tickets SET
        assignee_id = ?, assignee_email = ?, assignee_name = ?,
        status = 'EM_ANALISE', updated_at = NOW()
      WHERE id = ?
    `, [users[0].id, assignee_email, users[0].name, ticketId]);

    // Add update record
    await req.db.execute(`
      INSERT INTO ticket_updates (
        ticket_id, updater_id, updater_email, updater_name,
        update_type, update_text, old_value, new_value
      ) VALUES (?, ?, ?, ?, 'ASSIGNMENT', ?, ?, ?)
    `, [
      ticketId,
      req.session.user.id,
      req.session.user.email,
      req.session.user.name,
      `Chamado assumido por ${req.session.user.name}`,
      JSON.stringify({ assignee_email: tickets[0].assignee_email }),
      JSON.stringify({ assignee_email })
    ]);

    // Log audit event
    await logAuditEvent(
      req.db,
      req.session.user.id,
      'TICKET_ASSIGNED',
      'ticket',
      ticketId,
      { assignee_email, previousAssignee: tickets[0].assignee_email },
      req
    );

    res.json({ message: 'Chamado assumido com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Add update/comment to ticket
apiRouter.post('/tickets/:id/updates', validateUpdate, async (req, res, next) => {
  try {
    const ticketId = parseInt(req.params.id);
    const { update_text, is_internal = false } = req.body;
    const isAdmin = hasPermission(req.session.user.role, PERMISSIONS.TICKET_UPDATE);
    
    // Check if user can update this ticket
    const [tickets] = await req.db.execute(
      'SELECT * FROM tickets WHERE id = ? AND (requester_email = ? OR ?)',
      [ticketId, req.session.user.email, isAdmin]
    );

    if (!tickets[0]) {
      return res.status(404).json({ error: 'Chamado não encontrado ou sem permissão' });
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    await req.db.execute(`
      INSERT INTO ticket_updates (
        ticket_id, updater_id, updater_email, updater_name,
        update_type, update_text, is_internal
      ) VALUES (?, ?, ?, ?, 'COMMENT', ?, ?)
    `, [
      ticketId,
      req.session.user.id,
      req.session.user.email,
      req.session.user.name,
      update_text,
      is_internal
    ]);

    res.status(201).json({ message: 'Comentário adicionado com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Close ticket
apiRouter.post('/tickets/:id/close', [
  body('description').trim().isLength({ min: 10 }).withMessage('Descrição de fechamento deve ter pelo menos 10 caracteres'),
  body('resolution_notes').optional().trim().isLength({ min: 5 }).withMessage('Notas de resolução devem ter pelo menos 5 caracteres'),
  body('actual_hours').optional().isFloat({ min: 0 }).withMessage('Horas reais devem ser um número positivo')
], async (req, res, next) => {
  try {
    if (!hasPermission(req.session.user.role, PERMISSIONS.TICKET_CLOSE)) {
      return res.status(403).json({ error: 'Sem permissão para fechar chamados' });
    }

    const ticketId = parseInt(req.params.id);
    const { description, resolution_notes, actual_hours } = req.body;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        error: 'Dados inválidos',
        details: errors.array()
      });
    }

    // Verify ticket exists and is not already closed
    const [tickets] = await req.db.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!tickets[0]) {
      return res.status(404).json({ error: 'Chamado não encontrado' });
    }

    if (tickets[0].status === 'FECHADO') {
      return res.status(400).json({ error: 'Chamado já está fechado' });
    }

    await req.db.execute(`
      UPDATE tickets SET
        status = 'FECHADO',
        description_close = ?,
        resolution_notes = ?,
        actual_hours = ?,
        closed_at = NOW(),
        closed_by = ?,
        updated_at = NOW()
      WHERE id = ?
    `, [description, resolution_notes, actual_hours, req.session.user.id, ticketId]);

    // Add closing update
    await req.db.execute(`
      INSERT INTO ticket_updates (
        ticket_id, updater_id, updater_email, updater_name,
        update_type, update_text
      ) VALUES (?, ?, ?, ?, 'RESOLUTION', ?)
    `, [
      ticketId,
      req.session.user.id,
      req.session.user.email,
      req.session.user.name,
      `Chamado fechado: ${description}`
    ]);

    // Log audit event
    await logAuditEvent(
      req.db,
      req.session.user.id,
      'TICKET_CLOSED',
      'ticket',
      ticketId,
      { description, resolution_notes, actual_hours },
      req
    );

    res.json({ message: 'Chamado fechado com sucesso' });
  } catch (err) {
    next(err);
  }
});

// Get ticket statistics
apiRouter.get('/tickets/stats', async (req, res, next) => {
  try {
    const isAdmin = hasPermission(req.session.user.role, PERMISSIONS.TICKET_READ);
    const whereClause = isAdmin ? '1=1' : 'requester_email = ?';
    const params = isAdmin ? [] : [req.session.user.email];

    // Status distribution
    const [statusStats] = await req.db.execute(`
      SELECT status, COUNT(*) as count
      FROM tickets
      WHERE ${whereClause}
      GROUP BY status
    `, params);

    // Priority distribution
    const [priorityStats] = await req.db.execute(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE ${whereClause}
      GROUP BY priority
    `, params);

    // Area distribution
    const [areaStats] = await req.db.execute(`
      SELECT area, COUNT(*) as count
      FROM tickets
      WHERE ${whereClause}
      GROUP BY area
    `, params);

    // Recent activity
    const [recentActivity] = await req.db.execute(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE ${whereClause} AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `, params);

    res.json({
      statusDistribution: statusStats,
      priorityDistribution: priorityStats,
      areaDistribution: areaStats,
      recentActivity: recentActivity[0].count
    });
  } catch (err) {
    next(err);
  }
});

export { apiRouter };
