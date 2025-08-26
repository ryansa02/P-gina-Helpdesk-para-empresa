import cron from 'node-cron';
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

export function setupCronJobs(dbPool, logger) {
  // Clean up old audit logs (keep last 90 days)
  cron.schedule('0 2 * * 0', async () => {
    try {
      const [result] = await dbPool.execute(`
        DELETE FROM audit_logs 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
      `);
      
      logger.info(`Cleaned up ${result.affectedRows} old audit log entries`);
    } catch (error) {
      logger.error('Error cleaning up audit logs:', error);
    }
  });

  // Clean up old notifications (keep last 30 days)
  cron.schedule('0 3 * * 0', async () => {
    try {
      const [result] = await dbPool.execute(`
        DELETE FROM notifications 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY) AND is_read = 1
      `);
      
      logger.info(`Cleaned up ${result.affectedRows} old notifications`);
    } catch (error) {
      logger.error('Error cleaning up notifications:', error);
    }
  });

  // Check for overdue tickets and send notifications
  cron.schedule('0 9 * * *', async () => {
    try {
      const [overdueTickets] = await dbPool.execute(`
        SELECT 
          t.id, t.ticket_number, t.title, t.due_date, t.assignee_email,
          t.requester_email, t.requester_name
        FROM tickets t
        WHERE t.status IN ('ABERTO', 'EM_ANALISE') 
          AND t.due_date IS NOT NULL 
          AND t.due_date < NOW()
      `);

      for (const ticket of overdueTickets) {
        // Create notification for assignee
        if (ticket.assignee_email) {
          await dbPool.execute(`
            INSERT INTO notifications (user_id, type, title, message, data)
            SELECT id, 'TICKET_UPDATED', 'Chamado Vencido', ?, ?
            FROM users WHERE email = ?
          `, [
            `O chamado ${ticket.ticket_number} está vencido`,
            JSON.stringify({ ticketId: ticket.id, ticketNumber: ticket.ticket_number }),
            ticket.assignee_email
          ]);
        }

        // Create notification for requester
        await dbPool.execute(`
          INSERT INTO notifications (user_id, type, title, message, data)
          SELECT id, 'TICKET_UPDATED', 'Chamado Vencido', ?, ?
          FROM users WHERE email = ?
        `, [
          `Seu chamado ${ticket.ticket_number} está vencido`,
          JSON.stringify({ ticketId: ticket.id, ticketNumber: ticket.ticket_number }),
          ticket.requester_email
        ]);
      }

      if (overdueTickets.length > 0) {
        logger.info(`Sent notifications for ${overdueTickets.length} overdue tickets`);
      }
    } catch (error) {
      logger.error('Error checking overdue tickets:', error);
    }
  });

  // Daily system health check
  cron.schedule('0 6 * * *', async () => {
    try {
      // Check database connection
      await dbPool.execute('SELECT 1');
      
      // Get system stats
      const [stats] = await dbPool.execute(`
        SELECT 
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN status = 'ABERTO' THEN 1 END) as open_tickets,
          COUNT(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as tickets_today
        FROM tickets
      `);

      logger.info('System health check completed', {
        totalTickets: stats[0].total_tickets,
        openTickets: stats[0].open_tickets,
        ticketsToday: stats[0].tickets_today
      });
    } catch (error) {
      logger.error('System health check failed:', error);
    }
  });

  logger.info('Cron jobs scheduled successfully');
}
