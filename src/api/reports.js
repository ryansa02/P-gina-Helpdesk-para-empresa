import express from 'express';
import ExcelJS from 'exceljs';
import { createObjectCsvWriter } from 'csv-writer';

export const reportRouter = express.Router();

// Get ticket summary report
reportRouter.get('/tickets/summary', async (req, res, next) => {
  try {
    const { start_date, end_date, area, status } = req.query;
    
    let whereClause = '1=1';
    let params = [];
    
    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date);
    }
    if (area) {
      whereClause += ' AND area = ?';
      params.push(area);
    }
    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    // Summary statistics
    const [summary] = await req.db.execute(`
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'ABERTO' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'EM_ANALISE' THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN status = 'FECHADO' THEN 1 END) as closed_tickets,
        AVG(CASE WHEN actual_hours IS NOT NULL THEN actual_hours END) as avg_resolution_time,
        AVG(CASE WHEN status = 'FECHADO' THEN TIMESTAMPDIFF(HOUR, created_at, closed_at) END) as avg_time_to_close
      FROM tickets
      WHERE ${whereClause}
    `, params);

    // Area distribution
    const [areaDistribution] = await req.db.execute(`
      SELECT area, COUNT(*) as count
      FROM tickets
      WHERE ${whereClause}
      GROUP BY area
      ORDER BY count DESC
    `, params);

    // Status distribution
    const [statusDistribution] = await req.db.execute(`
      SELECT status, COUNT(*) as count
      FROM tickets
      WHERE ${whereClause}
      GROUP BY status
      ORDER BY count DESC
    `, params);

    // Priority distribution
    const [priorityDistribution] = await req.db.execute(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE ${whereClause}
      GROUP BY priority
      ORDER BY count DESC
    `, params);

    res.json({
      summary: summary[0],
      areaDistribution,
      statusDistribution,
      priorityDistribution
    });
  } catch (err) {
    next(err);
  }
});

// Export tickets to Excel
reportRouter.get('/tickets/export/excel', async (req, res, next) => {
  try {
    const { start_date, end_date, area, status } = req.query;
    
    let whereClause = '1=1';
    let params = [];
    
    if (start_date) {
      whereClause += ' AND t.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND t.created_at <= ?';
      params.push(end_date);
    }
    if (area) {
      whereClause += ' AND t.area = ?';
      params.push(area);
    }
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    // Get tickets data
    const [tickets] = await req.db.execute(`
      SELECT 
        t.ticket_number,
        t.title,
        t.area,
        t.board,
        t.priority,
        t.status,
        t.requester_name,
        t.requester_email,
        t.assignee_name,
        t.assignee_email,
        t.created_at,
        t.closed_at,
        t.actual_hours,
        TIMESTAMPDIFF(HOUR, t.created_at, COALESCE(t.closed_at, NOW())) as hours_open
      FROM tickets t
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
    `, params);

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Tickets Report');

    // Add headers
    worksheet.columns = [
      { header: 'Número', key: 'ticket_number', width: 15 },
      { header: 'Título', key: 'title', width: 40 },
      { header: 'Área', key: 'area', width: 15 },
      { header: 'Quadro', key: 'board', width: 15 },
      { header: 'Prioridade', key: 'priority', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Solicitante', key: 'requester_name', width: 25 },
      { header: 'Email Solicitante', key: 'requester_email', width: 30 },
      { header: 'Responsável', key: 'assignee_name', width: 25 },
      { header: 'Email Responsável', key: 'assignee_email', width: 30 },
      { header: 'Data Criação', key: 'created_at', width: 20 },
      { header: 'Data Fechamento', key: 'closed_at', width: 20 },
      { header: 'Horas Reais', key: 'actual_hours', width: 12 },
      { header: 'Horas Abertas', key: 'hours_open', width: 12 }
    ];

    // Add data
    tickets.forEach(ticket => {
      worksheet.addRow(ticket);
    });

    // Style headers
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Set response headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets-report.xlsx');

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// Export tickets to CSV
reportRouter.get('/tickets/export/csv', async (req, res, next) => {
  try {
    const { start_date, end_date, area, status } = req.query;
    
    let whereClause = '1=1';
    let params = [];
    
    if (start_date) {
      whereClause += ' AND t.created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND t.created_at <= ?';
      params.push(end_date);
    }
    if (area) {
      whereClause += ' AND t.area = ?';
      params.push(area);
    }
    if (status) {
      whereClause += ' AND t.status = ?';
      params.push(status);
    }

    // Get tickets data
    const [tickets] = await req.db.execute(`
      SELECT 
        t.ticket_number,
        t.title,
        t.area,
        t.board,
        t.priority,
        t.status,
        t.requester_name,
        t.requester_email,
        t.assignee_name,
        t.assignee_email,
        t.created_at,
        t.closed_at,
        t.actual_hours
      FROM tickets t
      WHERE ${whereClause}
      ORDER BY t.created_at DESC
    `, params);

    // Set response headers
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tickets-report.csv');

    // Create CSV writer
    const csvWriter = createObjectCsvWriter({
      path: 'temp-tickets-report.csv',
      header: [
        { id: 'ticket_number', title: 'Número' },
        { id: 'title', title: 'Título' },
        { id: 'area', title: 'Área' },
        { id: 'board', title: 'Quadro' },
        { id: 'priority', title: 'Prioridade' },
        { id: 'status', title: 'Status' },
        { id: 'requester_name', title: 'Solicitante' },
        { id: 'requester_email', title: 'Email Solicitante' },
        { id: 'assignee_name', title: 'Responsável' },
        { id: 'assignee_email', title: 'Email Responsável' },
        { id: 'created_at', title: 'Data Criação' },
        { id: 'closed_at', title: 'Data Fechamento' },
        { id: 'actual_hours', title: 'Horas Reais' }
      ]
    });

    // Write data
    await csvWriter.writeRecords(tickets);

    // Send file
    res.download('temp-tickets-report.csv', 'tickets-report.csv', (err) => {
      // Clean up temp file
      require('fs').unlinkSync('temp-tickets-report.csv');
    });
  } catch (err) {
    next(err);
  }
});

// Get user activity report
reportRouter.get('/users/activity', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    
    let whereClause = '1=1';
    let params = [];
    
    if (start_date) {
      whereClause += ' AND created_at >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND created_at <= ?';
      params.push(end_date);
    }

    // User activity statistics
    const [userActivity] = await req.db.execute(`
      SELECT 
        u.name,
        u.email,
        u.role,
        u.department,
        COUNT(t.id) as tickets_created,
        COUNT(CASE WHEN t.status = 'FECHADO' THEN 1 END) as tickets_closed,
        AVG(CASE WHEN t.actual_hours IS NOT NULL THEN t.actual_hours END) as avg_resolution_time,
        MAX(t.created_at) as last_activity
      FROM users u
      LEFT JOIN tickets t ON u.id = t.requester_id
      WHERE ${whereClause}
      GROUP BY u.id, u.name, u.email, u.role, u.department
      ORDER BY tickets_created DESC
    `, params);

    res.json({ userActivity });
  } catch (err) {
    next(err);
  }
});

export { reportRouter };
