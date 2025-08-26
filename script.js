// CSC Geórgia Contábil - Sistema de Gestão de Chamados
// Configurações do sistema
const SYSTEM_CONFIG = {
    OWNER_EMAIL: 'ryan31624@gmail.com',
    ALLOWED_DOMAINS: ['georgiacontabil.com.br', 'nine9.com.br'],
    ALLOWED_EMAILS: ['ryan31624@gmail.com'],
    API_BASE_URL: 'api', // URL base das APIs PHP
    STORAGE_KEYS: {
        CURRENT_USER: 'csc_current_user',
        TOKEN: 'csc_auth_token'
    }
};

// Classe principal da aplicação
class CSCApp {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
        this.currentView = 'dashboard';
        this.init();
    }

    init() {
        this.loadStoredAuth();
        this.checkAuth();
        this.setupEventListeners();
    }

    loadStoredAuth() {
        this.currentUser = JSON.parse(localStorage.getItem(SYSTEM_CONFIG.STORAGE_KEYS.CURRENT_USER)) || null;
        this.authToken = localStorage.getItem(SYSTEM_CONFIG.STORAGE_KEYS.TOKEN) || null;
    }

    saveAuth(user, token) {
        this.currentUser = user;
        this.authToken = token;
        localStorage.setItem(SYSTEM_CONFIG.STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
        localStorage.setItem(SYSTEM_CONFIG.STORAGE_KEYS.TOKEN, token);
    }

    clearAuth() {
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem(SYSTEM_CONFIG.STORAGE_KEYS.CURRENT_USER);
        localStorage.removeItem(SYSTEM_CONFIG.STORAGE_KEYS.TOKEN);
    }

    checkAuth() {
        if (this.currentUser && this.authToken) {
            this.showApp();
        } else {
            this.showAuth();
        }
    }

    showAuth() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
    }

    showApp() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        this.updateUserInfo();
        this.loadView('dashboard');
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.loadView(view);
            });
        });

        // New ticket form
        const newTicketForm = document.getElementById('new-ticket-form');
        if (newTicketForm) {
            newTicketForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.createTicket();
            });
        }

        // Login form
        const loginBtn = document.querySelector('button[onclick="login()"]');
        if (loginBtn) {
            loginBtn.onclick = () => this.login();
        }
    }

    async login() {
        const nome = document.getElementById('login-nome').value.trim();
        const email = document.getElementById('login-email').value.trim();
        const area = document.getElementById('login-area').value;
        const quadro = document.getElementById('login-quadro').value;

        if (!nome || !email || !area || !quadro) {
            this.showMessage('Preencha todos os campos obrigatórios.', 'error');
            return;
        }

        if (!this.isEmailAllowed(email)) {
            this.showMessage('Email não autorizado. Use um domínio corporativo ou entre em contato com o administrador.', 'error');
            return;
        }

        try {
            const response = await this.apiRequest('auth.php?action=login', {
                method: 'POST',
                body: JSON.stringify({
                    nome,
                    email,
                    area,
                    quadro
                })
            });

            if (response.success) {
                this.saveAuth(response.data.user, response.data.token);
                this.showApp();
                this.showMessage('Login realizado com sucesso!', 'success');
            } else {
                this.showMessage(response.error || 'Erro no login', 'error');
            }
        } catch (error) {
            console.error('Erro no login:', error);
            this.showMessage('Erro ao conectar com o servidor. Verifique se o PHP está rodando.', 'error');
        }
    }

    isEmailAllowed(email) {
        const domain = email.split('@')[1];
        return SYSTEM_CONFIG.ALLOWED_DOMAINS.includes(domain) || 
               SYSTEM_CONFIG.ALLOWED_EMAILS.includes(email.toLowerCase());
    }

    updateUserInfo() {
        if (!this.currentUser) return;

        document.getElementById('user-name').textContent = this.currentUser.nome;
        document.getElementById('user-role').textContent = this.getRoleDisplay(this.currentUser.role);
        
        document.getElementById('profile-name').textContent = this.currentUser.nome;
        document.getElementById('profile-email').textContent = this.currentUser.email;
        document.getElementById('profile-department').textContent = this.currentUser.area;
        document.getElementById('profile-board').textContent = this.currentUser.quadro;

        // Show/hide admin nav based on role
        const adminNav = document.getElementById('admin-nav');
        if (adminNav) {
            adminNav.style.display = this.hasPermission('ADMIN') ? 'flex' : 'none';
        }
    }

    getRoleDisplay(role) {
        const roles = {
            'SUPER_ADMIN': 'Super Administrador',
            'ADMIN': 'Administrador',
            'USER': 'Usuário'
        };
        return roles[role] || 'Usuário';
    }

    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        if (this.currentUser.role === 'SUPER_ADMIN') return true;
        if (this.currentUser.role === 'ADMIN' && permission === 'ADMIN') return true;
        
        return false;
    }

    loadView(view) {
        // Hide all views
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

        // Show selected view
        const viewElement = document.getElementById(`${view}-view`);
        if (viewElement) {
            viewElement.classList.add('active');
        }

        // Update navigation
        const navItem = document.querySelector(`[data-view="${view}"]`);
        if (navItem) {
            navItem.classList.add('active');
        }

        this.currentView = view;

        // Load view-specific content
        switch (view) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'tickets':
                this.loadTickets();
                break;
            case 'new-ticket':
                this.loadNewTicket();
                break;
            case 'admin':
                this.loadAdmin();
                break;
        }
    }

    async loadDashboard() {
        await this.updateStats();
        await this.loadRecentTickets();
    }

    async loadTickets() {
        await this.renderTickets();
    }

    loadNewTicket() {
        // Pre-fill form with user's default values
        if (this.currentUser) {
            document.getElementById('ticket-area').value = this.currentUser.area;
            document.getElementById('ticket-quadro').value = this.currentUser.quadro;
        }
    }

    async loadAdmin() {
        if (!this.hasPermission('ADMIN')) {
            this.showMessage('Acesso negado.', 'error');
            this.loadView('dashboard');
            return;
        }
        await this.loadUsersList();
        await this.updateAdminStats();
    }

    async updateStats() {
        try {
            const response = await this.apiRequest('tickets.php?action=stats');
            if (response.success) {
                const stats = response.data;
                document.getElementById('total-tickets').textContent = stats.total || 0;
                document.getElementById('open-tickets').textContent = stats.open || 0;
                document.getElementById('closed-tickets').textContent = stats.closed || 0;
                document.getElementById('my-tickets').textContent = stats.total || 0; // Para usuários normais, total = meus chamados
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas:', error);
        }
    }

    async loadRecentTickets() {
        try {
            const response = await this.apiRequest('tickets.php?action=list&limit=5');
            const container = document.getElementById('recent-tickets-list');
            if (!container) return;

            if (response.success && response.data.tickets.length > 0) {
                const tickets = response.data.tickets;
                container.innerHTML = tickets.map(ticket => `
                    <div class="ticket-item" onclick="app.viewTicket('${ticket.id}')">
                        <div class="ticket-header">
                            <span class="ticket-number">#${ticket.ticket_number}</span>
                            <span class="ticket-status ${ticket.status.toLowerCase().replace(' ', '-')}">${ticket.status}</span>
                        </div>
                        <div class="ticket-title">${ticket.title}</div>
                        <div class="ticket-meta">
                            <span class="ticket-requester">${ticket.requester_name}</span>
                            <span class="ticket-date">${ticket.formatted_created_at}</span>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-muted">Nenhum chamado encontrado.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar chamados recentes:', error);
            document.getElementById('recent-tickets-list').innerHTML = '<p class="text-muted">Erro ao carregar chamados.</p>';
        }
    }

    async renderTickets() {
        const container = document.getElementById('tickets-list');
        if (!container) return;

        const statusFilter = document.getElementById('status-filter')?.value;
        const priorityFilter = document.getElementById('priority-filter')?.value;
        const areaFilter = document.getElementById('area-filter')?.value;

        try {
            let url = 'tickets.php?action=list';
            const params = new URLSearchParams();
            
            if (statusFilter) params.append('status', statusFilter);
            if (priorityFilter) params.append('priority', priorityFilter);
            if (areaFilter) params.append('area', areaFilter);
            
            if (params.toString()) {
                url += '&' + params.toString();
            }

            const response = await this.apiRequest(url);
            
            if (response.success) {
                const tickets = response.data.tickets;
                
                if (tickets.length === 0) {
                    container.innerHTML = '<p class="text-muted">Nenhum chamado encontrado com os filtros aplicados.</p>';
                    return;
                }

                container.innerHTML = tickets.map(ticket => `
                    <div class="ticket-card" onclick="app.viewTicket('${ticket.id}')">
                        <div class="ticket-header">
                            <div class="ticket-info">
                                <span class="ticket-number">#${ticket.ticket_number}</span>
                                <span class="ticket-title">${ticket.title}</span>
                            </div>
                            <div class="ticket-badges">
                                <span class="badge badge-${this.getPriorityClass(ticket.priority)}">${ticket.priority}</span>
                                <span class="badge badge-${this.getStatusClass(ticket.status)}">${ticket.status}</span>
                            </div>
                        </div>
                        <div class="ticket-body">
                            <p class="ticket-description">${ticket.description.substring(0, 100)}${ticket.description.length > 100 ? '...' : ''}</p>
                        </div>
                        <div class="ticket-footer">
                            <div class="ticket-meta">
                                <span class="meta-item">
                                    <i class="fas fa-user"></i>
                                    ${ticket.requester_name}
                                </span>
                                <span class="meta-item">
                                    <i class="fas fa-building"></i>
                                    ${ticket.area}
                                </span>
                                <span class="meta-item">
                                    <i class="fas fa-calendar"></i>
                                    ${ticket.formatted_created_at}
                                </span>
                            </div>
                            ${this.canAssignTicket(ticket) ? `
                                <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); app.assignTicket('${ticket.id}')">
                                    <i class="fas fa-user-plus"></i>
                                    Assumir
                                </button>
                            ` : ''}
                            ${this.canCloseTicket(ticket) ? `
                                <button class="btn btn-success btn-sm" onclick="event.stopPropagation(); app.closeTicket('${ticket.id}')">
                                    <i class="fas fa-check"></i>
                                    Fechar
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-muted">Erro ao carregar chamados.</p>';
            }
        } catch (error) {
            console.error('Erro ao renderizar chamados:', error);
            container.innerHTML = '<p class="text-muted">Erro ao carregar chamados.</p>';
        }
    }

    canAssignTicket(ticket) {
        return this.hasPermission('ADMIN') && ticket.status === 'Aberto';
    }

    canCloseTicket(ticket) {
        return this.hasPermission('ADMIN') && ticket.status === 'Em Andamento';
    }

    getPriorityClass(priority) {
        const classes = {
            'Baixa': 'info',
            'Média': 'warning',
            'Alta': 'danger',
            'Crítica': 'critical'
        };
        return classes[priority] || 'info';
    }

    getStatusClass(status) {
        const classes = {
            'Aberto': 'info',
            'Em Andamento': 'warning',
            'Fechado': 'success'
        };
        return classes[status] || 'info';
    }

    async createTicket() {
        const title = document.getElementById('ticket-title').value.trim();
        const area = document.getElementById('ticket-area').value;
        const priority = document.getElementById('ticket-priority').value;
        const quadro = document.getElementById('ticket-quadro').value;
        const description = document.getElementById('ticket-description').value.trim();

        if (!title || !area || !priority || !quadro || !description) {
            this.showMessage('Preencha todos os campos obrigatórios.', 'error');
            return;
        }

        try {
            const response = await this.apiRequest('tickets.php?action=create', {
                method: 'POST',
                body: JSON.stringify({
                    title,
                    description,
                    area,
                    priority,
                    quadro
                })
            });

            if (response.success) {
                this.showMessage('Chamado criado com sucesso!', 'success');
                this.loadView('tickets');
            } else {
                this.showMessage(response.error || 'Erro ao criar chamado', 'error');
            }
        } catch (error) {
            console.error('Erro ao criar chamado:', error);
            this.showMessage('Erro ao criar chamado. Tente novamente.', 'error');
        }
    }

    async assignTicket(ticketId) {
        try {
            const response = await this.apiRequest(`tickets.php?action=assign&id=${ticketId}`, {
                method: 'POST'
            });

            if (response.success) {
                this.showMessage('Chamado assumido com sucesso!', 'success');
                this.renderTickets();
            } else {
                this.showMessage(response.error || 'Erro ao assumir chamado', 'error');
            }
        } catch (error) {
            console.error('Erro ao assumir chamado:', error);
            this.showMessage('Erro ao assumir chamado. Tente novamente.', 'error');
        }
    }

    async closeTicket(ticketId) {
        const resolutionNotes = prompt('Digite as notas de resolução (obrigatório):');
        if (!resolutionNotes || resolutionNotes.trim() === '') {
            this.showMessage('Notas de resolução são obrigatórias.', 'error');
            return;
        }

        try {
            const response = await this.apiRequest(`tickets.php?action=close&id=${ticketId}`, {
                method: 'POST',
                body: JSON.stringify({
                    resolution_notes: resolutionNotes.trim()
                })
            });

            if (response.success) {
                this.showMessage('Chamado fechado com sucesso!', 'success');
                this.renderTickets();
            } else {
                this.showMessage(response.error || 'Erro ao fechar chamado', 'error');
            }
        } catch (error) {
            console.error('Erro ao fechar chamado:', error);
            this.showMessage('Erro ao fechar chamado. Tente novamente.', 'error');
        }
    }

    async viewTicket(ticketId) {
        try {
            const response = await this.apiRequest(`tickets.php?action=get&id=${ticketId}`);
            
            if (response.success) {
                const ticket = response.data;
                const modal = document.getElementById('ticket-modal');
                const title = document.getElementById('modal-ticket-title');
                const content = document.getElementById('modal-ticket-content');

                title.textContent = `Chamado #${ticket.ticket_number} - ${ticket.title}`;

                content.innerHTML = `
                    <div class="ticket-detail">
                        <div class="ticket-info">
                            <div class="info-row">
                                <span class="label">Status:</span>
                                <span class="badge badge-${this.getStatusClass(ticket.status)}">${ticket.status}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Prioridade:</span>
                                <span class="badge badge-${this.getPriorityClass(ticket.priority)}">${ticket.priority}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Departamento:</span>
                                <span>${ticket.area}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Quadro:</span>
                                <span>${ticket.quadro}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">Solicitante:</span>
                                <span>${ticket.requester_name}</span>
                            </div>
                            ${ticket.assignee_name ? `
                                <div class="info-row">
                                    <span class="label">Responsável:</span>
                                    <span>${ticket.assignee_name}</span>
                                </div>
                            ` : ''}
                            <div class="info-row">
                                <span class="label">Criado em:</span>
                                <span>${ticket.formatted_created_at}</span>
                            </div>
                            ${ticket.closed_at ? `
                                <div class="info-row">
                                    <span class="label">Fechado em:</span>
                                    <span>${ticket.formatted_closed_at}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <div class="ticket-description">
                            <h4>Descrição</h4>
                            <p>${ticket.description}</p>
                        </div>
                        
                        ${ticket.resolution_notes ? `
                            <div class="ticket-resolution">
                                <h4>Notas de Resolução</h4>
                                <p>${ticket.resolution_notes}</p>
                            </div>
                        ` : ''}
                        
                        <div class="ticket-updates">
                            <h4>Atualizações</h4>
                            <div class="updates-list">
                                ${ticket.updates.map(update => `
                                    <div class="update-item">
                                        <div class="update-header">
                                            <span class="update-user">${update.user_name}</span>
                                            <span class="update-time">${update.formatted_created_at}</span>
                                        </div>
                                        <div class="update-message">${update.message}</div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;

                modal.style.display = 'block';
            } else {
                this.showMessage(response.error || 'Erro ao carregar chamado', 'error');
            }
        } catch (error) {
            console.error('Erro ao carregar chamado:', error);
            this.showMessage('Erro ao carregar detalhes do chamado.', 'error');
        }
    }

    closeTicketModal() {
        document.getElementById('ticket-modal').style.display = 'none';
    }

    async loadUsersList() {
        try {
            const response = await this.apiRequest('auth.php?action=users');
            const container = document.getElementById('users-list');
            if (!container) return;

            if (response.success && response.data.users.length > 0) {
                const users = response.data.users;
                container.innerHTML = users.map(user => `
                    <div class="user-item">
                        <div class="user-info">
                            <div class="user-name">${user.nome}</div>
                            <div class="user-email">${user.email}</div>
                            <div class="user-role">${this.getRoleDisplay(user.role)}</div>
                        </div>
                        <div class="user-status">
                            <span class="badge ${user.is_active ? 'badge-success' : 'badge-error'}">
                                ${user.is_active ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<p class="text-muted">Nenhum usuário encontrado.</p>';
            }
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            document.getElementById('users-list').innerHTML = '<p class="text-muted">Erro ao carregar usuários.</p>';
        }
    }

    async updateAdminStats() {
        try {
            const response = await this.apiRequest('tickets.php?action=stats');
            if (response.success) {
                const stats = response.data;
                document.getElementById('admin-total-users').textContent = 'N/A'; // Precisa de API separada
                document.getElementById('admin-today-tickets').textContent = stats.total || 0;
                document.getElementById('admin-pending-tickets').textContent = (stats.open || 0) + (stats.in_progress || 0);
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas admin:', error);
        }
    }

    showMessage(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        const container = document.getElementById('toast-container');
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                container.removeChild(toast);
            }, 300);
        }, 3000);
    }

    async logout() {
        try {
            await this.apiRequest('auth.php?action=logout', { method: 'POST' });
        } catch (error) {
            console.error('Erro no logout:', error);
        }
        
        this.clearAuth();
        this.showAuth();
        this.showMessage('Logout realizado com sucesso!', 'success');
    }

    // Método para fazer requisições à API
    async apiRequest(endpoint, options = {}) {
        const url = `${SYSTEM_CONFIG.API_BASE_URL}/${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Adicionar token de autenticação se disponível
        if (this.authToken) {
            config.headers['Authorization'] = `Bearer ${this.authToken}`;
        }

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
}

// Funções globais para compatibilidade
function login() {
    if (window.app) {
        window.app.login();
    }
}

function logout() {
    if (window.app) {
        window.app.logout();
    }
}

function filterTickets() {
    if (window.app) {
        window.app.renderTickets();
    }
}

function showNewTicketForm() {
    if (window.app) {
        window.app.loadView('new-ticket');
    }
}

function cancelNewTicket() {
    if (window.app) {
        window.app.loadView('tickets');
    }
}

function closeTicketModal() {
    if (window.app) {
        window.app.closeTicketModal();
    }
}

// Inicializar aplicação quando o DOM estiver carregado
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CSCApp();
});

// Fechar modal ao clicar fora
window.addEventListener('click', (event) => {
    const modal = document.getElementById('ticket-modal');
    if (event.target === modal) {
        closeTicketModal();
    }
});


