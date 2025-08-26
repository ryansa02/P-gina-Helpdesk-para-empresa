import express from 'express';

export const notificationRouter = express.Router();

// Get user notifications
notificationRouter.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, is_read } = req.query;
    const offset = (page - 1) * limit;
    
    let whereClause = 'user_id = ?';
    let params = [req.session.user.id];
    
    if (is_read !== undefined) {
      whereClause += ' AND is_read = ?';
      params.push(is_read === 'true');
    }

    // Get total count
    const [countResult] = await req.db.execute(
      `SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get notifications
    const [notifications] = await req.db.execute(`
      SELECT * FROM notifications
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      notifications,
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

// Mark notification as read
notificationRouter.put('/:id/read', async (req, res, next) => {
  try {
    const notificationId = parseInt(req.params.id);
    
    await req.db.execute(`
      UPDATE notifications SET
        is_read = 1, read_at = NOW()
      WHERE id = ? AND user_id = ?
    `, [notificationId, req.session.user.id]);

    res.json({ message: 'Notificação marcada como lida' });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
notificationRouter.put('/read-all', async (req, res, next) => {
  try {
    await req.db.execute(`
      UPDATE notifications SET
        is_read = 1, read_at = NOW()
      WHERE user_id = ? AND is_read = 0
    `, [req.session.user.id]);

    res.json({ message: 'Todas as notificações marcadas como lidas' });
  } catch (err) {
    next(err);
  }
});

// Get unread count
notificationRouter.get('/unread-count', async (req, res, next) => {
  try {
    const [result] = await req.db.execute(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = ? AND is_read = 0
    `, [req.session.user.id]);

    res.json({ count: result[0].count });
  } catch (err) {
    next(err);
  }
});

export { notificationRouter };
