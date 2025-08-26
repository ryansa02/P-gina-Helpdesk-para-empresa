import { logAuditEvent } from '../database/storage.js';

export function setupWebSocket(io, dbPool) {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Join user to their personal room
    socket.on('join', (userId) => {
      socket.join(`user_${userId}`);
      console.log(`User ${userId} joined their room`);
    });

    // Handle ticket updates
    socket.on('ticket_update', async (data) => {
      try {
        const { ticketId, userId, action, details } = data;
        
        // Broadcast to all connected clients
        io.emit('ticket_updated', {
          ticketId,
          action,
          details,
          timestamp: new Date().toISOString()
        });

        // Log the event
        await logAuditEvent(dbPool, userId, action, 'ticket', ticketId, details);
      } catch (error) {
        console.error('Error handling ticket update:', error);
      }
    });

    // Handle notifications
    socket.on('notification_sent', async (data) => {
      try {
        const { userId, notification } = data;
        
        // Send to specific user
        io.to(`user_${userId}`).emit('new_notification', notification);
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
}
