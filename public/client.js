// API Client for CSC Geórgia Contábil
class CSCClient {
  constructor() {
    this.baseURL = '';
    this.socket = null;
    this.user = null;
  }

  // Initialize WebSocket connection
  initSocket(userId) {
    if (typeof io !== 'undefined') {
      this.socket = io();
      this.socket.emit('join', userId);
      
      this.socket.on('ticket_updated', (data) => {
        this.handleTicketUpdate(data);
      });
      
      this.socket.on('new_notification', (notification) => {
        this.handleNotification(notification);
      });
    }
  }

  // Handle ticket updates
  handleTicketUpdate(data) {
    // Refresh ticket list if on tickets page
    if (window.currentView === 'tickets') {
      this.refreshTickets();
    }
    
    // Show notification
    this.showToast(`Chamado ${data.ticketId} foi atualizado`, 'info');
  }

  // Handle new notifications
  handleNotification(notification) {
    this.showToast(notification.title, 'info');
    this.updateNotificationBadge();
  }

  // Show toast notification
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }

  // Update notification badge
  updateNotificationBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
      this.getUnreadNotificationCount().then(count => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
      });
    }
  }

  // Generic API request
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }
      
      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // Authentication
  async fetchMe() {
    const res = await fetch('/api/tickets/me');
    if (!res.ok) return null;
    const data = await res.json();
    this.user = data.user;
    return data.user;
  }

  // Tickets API
  async fetchTickets(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const data = await this.request(`/api/tickets/tickets?${queryString}`);
    return data.tickets || [];
  }

  async fetchTicket(id) {
    const data = await this.request(`/api/tickets/tickets/${id}`);
    return data;
  }

  async createTicket(payload) {
    const data = await this.request('/api/tickets/tickets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return data;
  }

  async updateTicket(id, payload) {
    const data = await this.request(`/api/tickets/tickets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return data;
  }

  async assignTicket(id, assigneeEmail) {
    const data = await this.request(`/api/tickets/tickets/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ assignee_email: assigneeEmail })
    });
    return data;
  }

  async addTicketUpdate(id, updateText, isInternal = false) {
    const data = await this.request(`/api/tickets/tickets/${id}/updates`, {
      method: 'POST',
      body: JSON.stringify({ update_text: updateText, is_internal: isInternal })
    });
    return data;
  }

  async closeTicket(id, description, resolutionNotes, actualHours) {
    const data = await this.request(`/api/tickets/tickets/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ 
        description, 
        resolution_notes: resolutionNotes, 
        actual_hours: actualHours 
      })
    });
    return data;
  }

  async getTicketStats() {
    const data = await this.request('/api/tickets/tickets/stats');
    return data;
  }

  // Admin API
  async fetchUsers(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const data = await this.request(`/api/admin/users?${queryString}`);
    return data;
  }

  async updateUser(id, payload) {
    const data = await this.request(`/api/admin/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    return data;
  }

  async getAdminStats() {
    const data = await this.request('/api/admin/stats');
    return data;
  }

  async getAuditLogs(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const data = await this.request(`/api/admin/audit-logs?${queryString}`);
    return data;
  }

  async getSettings() {
    const data = await this.request('/api/admin/settings');
    return data;
  }

  async updateSetting(key, value) {
    const data = await this.request(`/api/admin/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value })
    });
    return data;
  }

  async getCategories() {
    const data = await this.request('/api/admin/categories');
    return data;
  }

  async createCategory(payload) {
    const data = await this.request('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return data;
  }

  // Reports API
  async getTicketSummary(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const data = await this.request(`/api/reports/tickets/summary?${queryString}`);
    return data;
  }

  async exportTicketsExcel(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    window.open(`/api/reports/tickets/export/excel?${queryString}`, '_blank');
  }

  async exportTicketsCSV(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    window.open(`/api/reports/tickets/export/csv?${queryString}`, '_blank');
  }

  async getUserActivity(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const data = await this.request(`/api/reports/users/activity?${queryString}`);
    return data;
  }

  // Notifications API
  async fetchNotifications(params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const data = await this.request(`/api/notifications?${queryString}`);
    return data;
  }

  async markNotificationAsRead(id) {
    const data = await this.request(`/api/notifications/${id}/read`, {
      method: 'PUT'
    });
    return data;
  }

  async markAllNotificationsAsRead() {
    const data = await this.request('/api/notifications/read-all', {
      method: 'PUT'
    });
    return data;
  }

  async getUnreadNotificationCount() {
    const data = await this.request('/api/notifications/unread-count');
    return data.count;
  }

  // 2FA API
  async setup2FA() {
    const data = await this.request('/auth/2fa/setup', {
      method: 'POST'
    });
    return data;
  }

  async verify2FA(token) {
    const data = await this.request('/auth/2fa/verify', {
      method: 'POST',
      body: JSON.stringify({ token })
    });
    return data;
  }

  // Logout
  async logout() {
    const data = await this.request('/auth/logout', {
      method: 'POST'
    });
    window.location.href = '/';
    return data;
  }

  // Utility methods
  refreshTickets() {
    if (window.currentView === 'tickets' && window.refreshTicketList) {
      window.refreshTicketList();
    }
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleString('pt-BR');
  }

  formatDuration(hours) {
    if (!hours) return '-';
    return `${hours}h`;
  }

  getStatusColor(status) {
    const colors = {
      'ABERTO': '#fbbf24',
      'EM_ANALISE': '#3b82f6',
      'AGUARDANDO': '#8b5cf6',
      'RESOLVIDO': '#10b981',
      'FECHADO': '#059669',
      'CANCELADO': '#ef4444'
    };
    return colors[status] || '#6b7280';
  }

  getPriorityColor(priority) {
    const colors = {
      'LOW': '#10b981',
      'MEDIUM': '#f59e0b',
      'HIGH': '#ef4444',
      'CRITICAL': '#dc2626'
    };
    return colors[priority] || '#6b7280';
  }
}

// Initialize global client
window.CSC = new CSCClient();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CSCClient;
}

