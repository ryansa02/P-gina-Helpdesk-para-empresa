function getUsuarioNomeByEmail(email){
    const usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    const u = usuarios.find(x => x.email === email);
    return u ? u.nome : null;
}
// Acesso do painel de atendente restrito ao proprietário
const OWNER_EMAIL = 'ryan31624@gmail.com';
const OWNER_NAME = 'Ryan Sá';
// login e cadastro

function toggleForms() {
    const login = document.getElementById('login-form');
    const cadastro = document.getElementById('cadastro-form');
    if (!login || !cadastro) return;
    const loginVisible = getComputedStyle(login).display !== 'none';
    login.style.display = loginVisible ? 'none' : 'block';
    cadastro.style.display = loginVisible ? 'block' : 'none';
}

function cadastrar() {
    const nome = document.getElementById('cadastro-nome').value.trim();
    const email = document.getElementById('cadastro-email').value.trim();
    const senha = document.getElementById('cadastro-senha').value;
    const area = document.getElementById('cadastro-area') ? document.getElementById('cadastro-area').value : 'TI';

    if (!nome || !email || !senha) {
        document.getElementById('cadastro-message').innerText = 'Preencha todos os campos.';
        return;
    }

    let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    if (usuarios.some(u => u.email === email)) {
        document.getElementById('cadastro-message').innerText = 'Email já cadastrado!';
        return;
}

    usuarios.push({ nome, email, senha, area });
localStorage.setItem('usuarios', JSON.stringify(usuarios));
    document.getElementById('cadastro-message').innerText = 'Login validado com sucesso!';
document.getElementById('cadastro-nome').value = '';
document.getElementById('cadastro-email').value = '';
document.getElementById('cadastro-senha').value = '';
    toggleForms();
}

function login () {
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const areaSelecionada = document.getElementById('login-area') ? document.getElementById('login-area').value : '';
    const quadroSelecionado = document.getElementById('login-quadro') ? document.getElementById('login-quadro').value : '';

    let usuarios = JSON.parse(localStorage.getItem('usuarios')) || [];
    const usuario = usuarios.find(u => u.email === email && u.senha === senha);

    if (usuario) {
        if (!quadroSelecionado) {
            document.getElementById('login-message').innerText = 'Seu usuário não está autorizado a abrir chamados para este departamento, acione o setor responsável.';
            return;
        }
        localStorage.setItem('usuarioLogado', JSON.stringify({ ...usuario, areaSelecionada, quadroSelecionado }));
        window.location.href = 'dashboard.html';
    }
    else {
        document.getElementById('login-message').innerText = 'Algo deu errado! O Login ou senha está incorreto.';
    }
}

// dashboard bootstrap
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
        if (!usuario) window.location.href = 'index.html';
        const nameEl = document.getElementById('user-name');
        if (nameEl && usuario) nameEl.innerText = usuario.nome;
        const areaAtual = document.getElementById('area-atual');
        if (areaAtual) areaAtual.textContent = usuario.areaSelecionada || '';
        const areaInput = document.getElementById('chamado-area');
        if (areaInput) areaInput.value = usuario.areaSelecionada || '';
        const attCard = document.getElementById('att-card');
        if (attCard) attCard.style.display = 'block';
        listarChamados();
    }
    if (window.location.pathname.includes('atendente.html')) {
        const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
        if (!usuario) window.location.href = 'index.html';
        listarChamadosAtendente();
    }
});
function isOwner(){
    const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
    return !!(usuario && usuario.email === OWNER_EMAIL);
}

function logout() {
    localStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}

// chamados
function toggleNewChamado() {
    const form = document.getElementById('new-chamado-form');
    if (form) {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }
}

function criarChamado() {
    const titulo = document.getElementById('chamado-titulo').value.trim();
    const descricao = document.getElementById('chamado-descricao').value.trim();
    const area = document.getElementById('chamado-area').value;
    const prioridade = document.getElementById('chamado-prioridade') ? document.getElementById('chamado-prioridade').value : 'Normal';
    if(!titulo || !descricao) return alert('Todos os campos precisam estar preenchidos');

    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));

    const seqKey = 'chamadoSeq';
    let seq = Number(localStorage.getItem(seqKey) || '0') + 1;
    localStorage.setItem(seqKey, String(seq));
    const anoPrefixo = '2025';
    const idNum = Number(`${anoPrefixo}${String(seq).padStart(3,'0')}`);

const novoChamado = {
        id: idNum,
        usuarioEmail: usuario.email,
        usuarioNome: usuario.nome,
        titulo,
        descricao,
        area,
        prioridade,
        status: 'Aberto',
        criado_em: new Date().toLocaleString()
    };

    chamados.push(novoChamado);
    localStorage.setItem('chamados', JSON.stringify(chamados));
    document.getElementById('chamado-titulo').value = '';
    document.getElementById('chamado-descricao').value = '';
    toggleNewChamado();
    listarChamados();
}

function listarChamados() {
    const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const filtro = document.getElementById('filtro-status') ? document.getElementById('filtro-status').value : '';
    const termo = (document.getElementById('busca-id') ? document.getElementById('busca-id').value.trim() : '');
    chamados = chamados
        .filter(c => c.usuarioEmail === usuario.email)
        .filter(c => c.area === (usuario.areaSelecionada || c.area))
        .filter(c => (filtro ? c.status === filtro : true))
        .filter(c => (termo ? String(c.id).includes(termo) : true));

    const tbody = document.querySelector('#chamados-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    chamados.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.titulo}</td>
            <td>${c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—'}</td>
            <td>${renderPrioridade(c.prioridade)}</td>
            <td>${c.area || '-'}</td>
            <td>
                <select onchange="alterarStatus(${c.id}, this.value)">
                    <option ${c.status==='Aberto'?'selected':''}>Aberto</option>
                    <option ${c.status==='Em andamento'?'selected':''}>Em andamento</option>
                    <option ${c.status==='Fechado'?'selected':''}>Fechado</option>
                </select>
            </td>
            <td>${c.criado_em}</td>
            <td><button onclick="verChamado(${c.id})">Ver</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function alterarStatus(id, status) {
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const index = chamados.findIndex(c => c.id === id);
    if(index >= 0){
        chamados[index].status = status;
        localStorage.setItem('chamados', JSON.stringify(chamados));
    }
}

function verChamado(id) {
    const modal = document.getElementById('modal-ver');
    const body = document.getElementById('modal-ver-body');
    if (!modal || !body) { alert('Detalhes indisponíveis nesta página.'); return; }
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const c = chamados.find(x => x.id === id);
    if(!c) return;
    const responsavelNome = (c.responsavel && c.responsavel === OWNER_EMAIL) ? 'Ryan Sá' : (c.responsavel || '—');
    const historico = c.andamento && Array.isArray(c.andamento) ? c.andamento : [];
    const historicoHtml = historico.map((h, index) => `
        <div class="timeline-item" style="--item-index: ${index}">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-date">${h.data}</span>
                </div>
                <div class="timeline-body">${h.texto}</div>
            </div>
        </div>
    `).join('') || '<div class="empty-state">Nenhum andamento registrado</div>';
    const solicitanteNome = c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—';
    
    body.innerHTML = `
        <div class="chamado-header holographic">
            <div class="chamado-id">#${c.id}</div>
            <div class="chamado-title">${c.titulo}</div>
            <div class="chamado-meta">
                ${renderPrioridade(c.prioridade)}
                <span class="status-badge status-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span>
            </div>
        </div>
        
        <div class="chamado-grid">
            <div class="info-card">
                <div class="card-header">
                    <i class="icon-user"></i>
                    <h4>Informações do Chamado</h4>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <label>Solicitante:</label>
                        <span>${solicitanteNome}</span>
                    </div>
                    <div class="info-row">
                        <label>Área:</label>
                        <span>${c.area}</span>
                    </div>
                    <div class="info-row">
                        <label>Responsável:</label>
                        <span>${responsavelNome}</span>
                    </div>
                    <div class="info-row">
                        <label>Aberto em:</label>
                        <span>${c.criado_em}</span>
                    </div>
                </div>
            </div>
            
            <div class="info-card full-width">
                <div class="card-header">
                    <i class="icon-description"></i>
                    <h4>Descrição</h4>
                </div>
                <div class="card-body">
                    <div class="description-text">${c.descricao}</div>
                </div>
            </div>
            
            <div class="info-card full-width">
                <div class="card-header">
                    <i class="icon-history"></i>
                    <h4>Histórico de Andamentos</h4>
                </div>
                <div class="card-body">
                    <div class="timeline">
                        ${historicoHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    modal.style.display = 'flex';
}

// Painel do atendente
function listarChamadosAtendente() {
    const tbody = document.querySelector('#chamados-atend tbody');
    const meusTbody = document.querySelector('#chamados-meus tbody');
    const outrosTbody = document.querySelector('#chamados-outros tbody');
    const finTbody = document.querySelector('#chamados-finalizados tbody');
    if (!tbody || !meusTbody || !finTbody) return;
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const filtroStatus = document.getElementById('filtro-status-att') ? document.getElementById('filtro-status-att').value : '';
    const filtroArea = localStorage.getItem('areaAtendenteSelecionada') || '';
    const termo = (document.getElementById('busca-id-att') ? document.getElementById('busca-id-att').value.trim() : '');
    const areaLabel = document.getElementById('area-atual-label');
    if (areaLabel) areaLabel.textContent = filtroArea || 'Todas';
    if (filtroStatus) chamados = chamados.filter(c => c.status === filtroStatus);
    if (filtroArea) chamados = chamados.filter(c => c.area === filtroArea);
    if (termo) chamados = chamados.filter(c => String(c.id).includes(termo));
    const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));

    // Disponíveis (sem responsável)
    tbody.innerHTML = '';
    chamados.filter(c => !c.responsavel).forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'row-clickable';
        tr.onclick = () => { abrirDetalhe(c.id); abrirMiniPainel(c.id); };
        const assumeBtn = isOwner() ? `<button class="primary" onclick="assumirChamadoFromList(${c.id});event.stopPropagation();">Assumir</button>` : '';
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.titulo}</td>
            <td>${renderPrioridade(c.prioridade)}</td>
            <td>${c.area || '-'}</td>
            <td>${c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—'}</td>
            <td>${renderStatusControl(c)}</td>
            <td>${c.criado_em}</td>
            <td>
                <button onclick="abrirDetalhe(${c.id}); abrirMiniPainel(${c.id}); event.stopPropagation();">Detalhes</button>
                ${assumeBtn}
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Meus em atendimento
    meusTbody.innerHTML = '';
    chamados.filter(c => c.responsavel === (usuario ? usuario.email : '') && c.status !== 'Fechado').forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'row-clickable';
        tr.onclick = () => { abrirDetalhe(c.id); abrirMiniPainel(c.id); };
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.titulo}</td>
            <td>${renderPrioridade(c.prioridade)}</td>
            <td>${c.area || '-'}</td>
            <td>${c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—'}</td>
            <td>${renderStatusControl(c)}</td>
            <td>${c.criado_em}</td>
            <td><button onclick="abrirDetalhe(${c.id}); abrirMiniPainel(${c.id}); event.stopPropagation();">Detalhes</button></td>
        `;
        meusTbody.appendChild(tr);
    });

    // Em atendimento (outros)
    if (outrosTbody) {
        outrosTbody.innerHTML = '';
        chamados.filter(c => c.responsavel && c.responsavel !== (usuario ? usuario.email : '') && c.status !== 'Fechado').forEach(c => {
            const tr = document.createElement('tr');
            tr.className = 'row-clickable';
            tr.onclick = () => { abrirDetalhe(c.id); abrirMiniPainel(c.id); };
            const respNome = c.responsavel === OWNER_EMAIL ? 'Ryan Sá' : (getUsuarioNomeByEmail(c.responsavel) || c.responsavel);
            tr.innerHTML = `
                <td>${c.id}</td>
                <td>${c.titulo}</td>
                <td>${renderPrioridade(c.prioridade)}</td>
                <td>${c.area || '-'}</td>
                <td>${c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—'}</td>
                <td>${respNome}</td>
                <td>${c.status}</td>
                <td>${c.criado_em}</td>
            `;
            outrosTbody.appendChild(tr);
        });
    }

    // Finalizados (todos da área)
    finTbody.innerHTML = '';
    chamados.filter(c => c.status === 'Fechado').forEach(c => {
        const tr = document.createElement('tr');
        tr.className = 'row-clickable';
        tr.onclick = () => { abrirDetalhe(c.id); abrirMiniPainel(c.id); };
        tr.innerHTML = `
            <td>${c.id}</td>
            <td>${c.titulo}</td>
            <td>${renderPrioridade(c.prioridade)}</td>
            <td>${c.area || '-'}</td>
            <td>${c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—'}</td>
            <td>${c.criado_em}</td>
        `;
        finTbody.appendChild(tr);
    });
}

function selecionarAreaAtendente(area){
    localStorage.setItem('areaAtendenteSelecionada', area);
    listarChamadosAtendente();
}

function abrirDetalhe(id){
    const painel = document.getElementById('detalhe-chamado');
    const conteudo = document.getElementById('detalhe-conteudo');
    if (!painel || !conteudo) return;
    const chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const c = chamados.find(x => x.id === id);
    if (!c) return;
    localStorage.setItem('chamadoEmAtendimento', String(id));
    const historico = c.andamento && Array.isArray(c.andamento) ? c.andamento : [];
    const historicoHtml = historico.map((h, index) => `
        <div class="timeline-item" style="--item-index: ${index}">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-date">${h.data}</span>
                </div>
                <div class="timeline-body">${h.texto}</div>
            </div>
        </div>
    `).join('') || '<div class="empty-state">Nenhum andamento registrado</div>';
    const responsavelNome = (c.responsavel && c.responsavel === OWNER_EMAIL) ? 'Ryan Sá' : (c.responsavel || '—');
    const solicitanteNome = c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—';
    
    conteudo.innerHTML = `
        <div class="chamado-header holographic">
            <div class="chamado-id">#${c.id}</div>
            <div class="chamado-title">${c.titulo}</div>
            <div class="chamado-meta">
                ${renderPrioridade(c.prioridade)}
                <span class="status-badge status-${c.status.toLowerCase().replace(' ', '-')}">${c.status}</span>
            </div>
        </div>
        
        <div class="chamado-grid">
            <div class="info-card">
                <div class="card-header">
                    <i class="icon-user"></i>
                    <h4>Informações do Chamado</h4>
                </div>
                <div class="card-body">
                    <div class="info-row">
                        <label>Solicitante:</label>
                        <span>${solicitanteNome}</span>
                    </div>
                    <div class="info-row">
                        <label>Área:</label>
                        <span>${c.area}</span>
                    </div>
                    <div class="info-row">
                        <label>Responsável:</label>
                        <span>${responsavelNome}</span>
                    </div>
                    <div class="info-row">
                        <label>Aberto em:</label>
                        <span>${c.criado_em}</span>
                    </div>
                </div>
            </div>
            
            <div class="info-card full-width">
                <div class="card-header">
                    <i class="icon-description"></i>
                    <h4>Descrição</h4>
                </div>
                <div class="card-body">
                    <div class="description-text">${c.descricao}</div>
                </div>
            </div>
            
            <div class="info-card full-width">
                <div class="card-header">
                    <i class="icon-history"></i>
                    <h4>Histórico de Andamentos</h4>
                </div>
                <div class="card-body">
                    <div class="timeline">
                        ${historicoHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
    const txt = document.getElementById('andamento-texto');
    if (txt) txt.value = '';
    const btnAssumir = document.getElementById('btn-assumir');
    if (btnAssumir) btnAssumir.style.display = (isOwner() && !c.responsavel) ? 'inline-block' : 'none';
    painel.style.display = 'block';
}

function abrirMiniPainel(id){
    const box = document.getElementById('mini-panel');
    const body = document.getElementById('mini-body');
    const idEl = document.getElementById('mini-id');
    if (!box || !body || !idEl) return;
    const chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const c = chamados.find(x => x.id === id);
    if (!c) return;
    idEl.textContent = String(c.id);
    const responsavelNome = (c.responsavel && c.responsavel === OWNER_EMAIL) ? 'Ryan Sá' : (c.responsavel || '—');
    const solicitanteNome = c.usuarioNome || getUsuarioNomeByEmail(c.usuarioEmail) || '—';
    body.innerHTML = `
        <p><strong>Aberto por:</strong> ${c.usuarioEmail}</p>
        <p><strong>Aberto em:</strong> ${c.criado_em}</p>
        <p><strong>Área:</strong> ${c.area} — <strong>Prioridade:</strong> ${renderPrioridade(c.prioridade)}</p>
        <p><strong>Título:</strong> ${c.titulo}</p>
        <p><strong>Descrição:</strong><br>${c.descricao}</p>
        <p><strong>Status:</strong> ${c.status}</p>
        <p><strong>Responsável:</strong> ${responsavelNome}</p>
    `;
    const btnAssumir = document.getElementById('mini-assumir');
    if (btnAssumir) btnAssumir.style.display = (isOwner() && !c.responsavel) ? 'inline-block' : 'none';
    box.style.display = 'block';
}

function renderPrioridade(p) {
    const map = { Normal: 'verde', Importante: 'amarelo', Urgente: 'vermelho' };
    const color = map[p] || 'verde';
    const label = p || 'Normal';
    return `<span class="badge badge-${color}">${label}</span>`;
}

function fecharDetalhe(){
    const painel = document.getElementById('detalhe-chamado');
    if (painel) painel.style.display = 'none';
}

function adicionarAndamento(){
    const id = Number(localStorage.getItem('chamadoEmAtendimento'));
    const texto = document.getElementById('andamento-texto') ? document.getElementById('andamento-texto').value.trim() : '';
    if (!id || !texto) return;
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const idx = chamados.findIndex(c => c.id === id);
    if (idx < 0) return;
    const registro = { data: new Date().toLocaleString(), texto };
    chamados[idx].andamento = chamados[idx].andamento && Array.isArray(chamados[idx].andamento) ? chamados[idx].andamento : [];
    chamados[idx].andamento.push(registro);
    localStorage.setItem('chamados', JSON.stringify(chamados));
    abrirDetalhe(id);
}

function finalizarChamado(){
    const id = Number(localStorage.getItem('chamadoEmAtendimento'));
    if (!id) return;
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const idx = chamados.findIndex(c => c.id === id);
    if (idx < 0) return;
    chamados[idx].status = 'Fechado';
    localStorage.setItem('chamados', JSON.stringify(chamados));
    const filtro = document.getElementById('filtro-status-att');
    if (filtro) filtro.value = 'Aberto';
    fecharDetalhe();
    listarChamadosAtendente();
}

function assumirChamado(){
    const id = Number(localStorage.getItem('chamadoEmAtendimento'));
    if (!id) return;
    const usuario = JSON.parse(localStorage.getItem('usuarioLogado'));
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const idx = chamados.findIndex(c => c.id === id);
    if (idx < 0) return;
    chamados[idx].responsavel = usuario.email;
    localStorage.setItem('chamados', JSON.stringify(chamados));
    // Após assumir, sair da lista de disponíveis e entrar em "Meus"
    listarChamadosAtendente();
    abrirDetalhe(id);
}

function assumirChamadoFromList(id){
    localStorage.setItem('chamadoEmAtendimento', String(id));
    assumirChamado();
}

function renderStatusControl(c) {
    if (isOwner()) {
        return `
            <select onchange="alterarStatus(${c.id}, this.value)">
                <option ${c.status==='Aberto'?'selected':''}>Aberto</option>
                <option ${c.status==='Em andamento'?'selected':''}>Em andamento</option>
                <option ${c.status==='Fechado'?'selected':''}>Fechado</option>
            </select>
        `;
    } else {
        return c.status;
    }
}

function alterarStatus(id, novoStatus) {
    if (!isOwner()) return;
    let chamados = JSON.parse(localStorage.getItem('chamados')) || [];
    const idx = chamados.findIndex(c => c.id === id);
    if (idx >= 0) {
        chamados[idx].status = novoStatus;
        localStorage.setItem('chamados', JSON.stringify(chamados));
        listarChamadosAtendente();
    }
}