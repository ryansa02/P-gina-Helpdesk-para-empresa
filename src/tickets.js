import express from 'express';

export const apiRouter = express.Router();

apiRouter.get('/me', (req, res) => {
  res.json({ user: req.session.user });
});

apiRouter.get('/tickets', async (req, res, next) => {
  try {
    const [rows] = await req.db.execute(
      'SELECT * FROM tickets WHERE requester_email = ? ORDER BY created_at DESC',
      [req.session.user.email]
    );
    res.json({ tickets: rows });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/tickets', async (req, res, next) => {
  try {
    const { area, board, description } = req.body;
    if (!description || String(description).trim().length < 5) {
      return res.status(400).json({ error: 'Descrição de abertura é obrigatória (mín. 5 caracteres).' });
    }
    if (!area || !board) {
      return res.status(400).json({ error: 'Área e quadro são obrigatórios.' });
    }
    const [result] = await req.db.execute(
      'INSERT INTO tickets (requester_email, requester_name, area, board, description_open) VALUES (?, ?, ?, ?, ?)',
      [req.session.user.email, req.session.user.name, area, board, description]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
});

apiRouter.post('/tickets/:id/close', async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const { description } = req.body;
    if (!description || String(description).trim().length < 5) {
      return res.status(400).json({ error: 'Descrição de fechamento é obrigatória (mín. 5 caracteres).' });
    }
    const [rows] = await req.db.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
    if (!rows[0]) return res.status(404).json({ error: 'Chamado não encontrado.' });

    await req.db.execute(
      "UPDATE tickets SET status = 'FECHADO', description_close = ?, closed_at = NOW() WHERE id = ?",
      [description, ticketId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});


