# CSC Geórgia Contábil - Centro de Serviços Compartilhados

Sistema profissional de gestão de chamados para a Geórgia Contábil, desenvolvido com foco em usabilidade e segurança empresarial.

## 🚀 Características

- **Design Profissional**: Interface moderna e responsiva inspirada em sistemas empresariais
- **Autenticação por Domínio**: Acesso restrito a domínios corporativos (@georgiacontabil.com.br, @nine9.com.br)
- **Controle de Acesso**: Sistema de roles com permissões específicas
- **Gestão de Chamados**: Criação, acompanhamento e fechamento de tickets
- **Banco de Dados MySQL**: Persistência completa de dados
- **API REST PHP**: Backend robusto e seguro
- **Relatórios**: Estatísticas e relatórios em tempo real
- **Notificações**: Sistema de notificações em tempo real
- **Responsivo**: Funciona em desktop, tablet e mobile

## 👥 Usuários e Permissões

### Super Administrador
- **Email**: ryan31624@gmail.com
- **Permissões**: Acesso total ao sistema
- **Funcionalidades**: 
  - Assumir e fechamento de chamados
  - Gestão de usuários
  - Configurações do sistema
  - Relatórios avançados

### Usuários Corporativos
- **Domínios**: @georgiacontabil.com.br, @nine9.com.br
- **Permissões**: Criação e visualização de chamados
- **Funcionalidades**:
  - Abrir novos chamados
  - Acompanhar status dos chamados
  - Visualizar histórico

## 🛠️ Instalação e Configuração

### Pré-requisitos

- **PHP 7.4+** com as seguintes extensões:
  - PDO
  - PDO_MySQL
  - JSON
  - MBString
- **MySQL 5.7+** ou **MariaDB 10.2+**
- **Servidor Web** (Apache, Nginx, ou servidor embutido do PHP)
- **Navegador web moderno** (Chrome, Firefox, Safari, Edge)

### Instalação Local

1. **Clone ou baixe o projeto**
   ```bash
   git clone [url-do-repositorio]
   cd paginatest.js
   ```

2. **Configure o banco de dados**
   - Crie um banco MySQL chamado `csc_georgia`
   - Configure as credenciais em `config/database.php`:
   ```php
   define('DB_HOST', 'localhost');
   define('DB_NAME', 'csc_georgia');
   define('DB_USER', 'seu_usuario');
   define('DB_PASS', 'sua_senha');
   ```

3. **Execute o setup**
   - Acesse: `http://localhost/paginatest.js/setup.php`
   - Siga as instruções para verificar requisitos e criar tabelas

4. **Inicie o servidor PHP**
   ```bash
   # Usando servidor embutido do PHP
   php -S localhost:8000
   
   # Ou configure Apache/Nginx para apontar para o diretório
   ```

5. **Acesse o sistema**
   - Abra o navegador
   - Acesse: `http://localhost:8000` ou `http://localhost/paginatest.js`
   - Faça login com um email corporativo autorizado

### Configuração para Produção

Para usar em produção:

1. **Servidor Web**
   - Apache com mod_rewrite habilitado
   - Nginx com configuração adequada
   - Configure HTTPS para segurança

2. **Banco de Dados**
   - Use um servidor MySQL dedicado
   - Configure backups automáticos
   - Ajuste as configurações de performance

3. **Segurança**
   - Altere as chaves secretas em `config/database.php`
   - Configure firewall adequado
   - Use HTTPS obrigatório
   - Configure rate limiting

## 📋 Funcionalidades

### Dashboard
- Visão geral dos chamados
- Estatísticas em tempo real
- Chamados recentes
- Informações do usuário

### Gestão de Chamados
- **Criar chamado**: Formulário completo com campos obrigatórios
- **Visualizar chamados**: Lista com filtros por status, prioridade e departamento
- **Assumir chamado**: Apenas administradores podem assumir chamados
- **Fechar chamado**: Com notas de resolução obrigatórias
- **Histórico**: Acompanhamento completo de todas as atualizações

### Administração
- **Gestão de usuários**: Visualizar todos os usuários do sistema
- **Estatísticas**: Relatórios de uso e atividade
- **Configurações**: Ajustes do sistema (apenas super admin)

## 🔐 Segurança

- **Autenticação por domínio**: Apenas emails corporativos autorizados
- **Controle de acesso**: Sistema de roles e permissões
- **Validação de dados**: Todos os campos obrigatórios são validados
- **Auditoria**: Log de todas as ações importantes
- **JWT Tokens**: Autenticação segura com tokens
- **Sanitização**: Proteção contra XSS e injeção SQL

## 📱 Responsividade

O sistema é totalmente responsivo e funciona em:
- **Desktop**: Interface completa com todas as funcionalidades
- **Tablet**: Layout adaptado para telas médias
- **Mobile**: Interface otimizada para smartphones

## 🎨 Design System

### Cores
- **Primária**: Azul corporativo (#3b82f6)
- **Sucesso**: Verde (#22c55e)
- **Aviso**: Amarelo (#f59e0b)
- **Erro**: Vermelho (#ef4444)
- **Info**: Azul claro (#3b82f6)

### Tipografia
- **Fonte**: Inter (Google Fonts)
- **Hierarquia**: Títulos, subtítulos, corpo e legendas bem definidos

### Componentes
- **Cards**: Para agrupamento de informações
- **Botões**: Com estados hover e focus
- **Formulários**: Validação visual e feedback
- **Modais**: Para detalhes e confirmações
- **Toast**: Notificações temporárias

## 🔧 Personalização

### Cores
Edite as variáveis CSS em `style.css`:
```css
:root {
  --primary-500: #3b82f6; /* Cor primária */
  --bg-primary: #0f172a; /* Fundo principal */
  /* ... outras cores */
}
```

### Configurações
- **Domínios autorizados**: Edite `ALLOWED_DOMAINS` em `config/database.php`
- **Emails especiais**: Edite `ALLOWED_EMAILS` em `config/database.php`
- **Departamentos**: Modifique as opções nos formulários

## 📊 Estrutura de Dados

### Tabelas Principais

#### users
```sql
- id (INT, AUTO_INCREMENT, PRIMARY KEY)
- nome (VARCHAR(255))
- email (VARCHAR(255), UNIQUE)
- area (VARCHAR(100))
- quadro (VARCHAR(100))
- role (ENUM: SUPER_ADMIN, ADMIN, USER)
- is_active (BOOLEAN)
- last_login (DATETIME)
- created_at (DATETIME)
- updated_at (DATETIME)
```

#### tickets
```sql
- id (INT, AUTO_INCREMENT, PRIMARY KEY)
- ticket_number (VARCHAR(20), UNIQUE)
- title (VARCHAR(255))
- description (TEXT)
- area (VARCHAR(100))
- priority (ENUM: Baixa, Média, Alta, Crítica)
- status (ENUM: Aberto, Em Andamento, Fechado)
- requester_id (INT, FOREIGN KEY)
- assignee_id (INT, FOREIGN KEY, NULL)
- resolution_notes (TEXT, NULL)
- created_at (DATETIME)
- updated_at (DATETIME)
- closed_at (DATETIME, NULL)
```

#### ticket_updates
```sql
- id (INT, AUTO_INCREMENT, PRIMARY KEY)
- ticket_id (INT, FOREIGN KEY)
- user_id (INT, FOREIGN KEY)
- update_type (ENUM: created, assigned, closed, comment)
- message (TEXT)
- is_internal (BOOLEAN)
- created_at (DATETIME)
```

## 🚀 Próximas Funcionalidades

- [ ] Integração com Microsoft Entra ID (Azure AD)
- [ ] Notificações por email
- [ ] Relatórios em PDF/Excel
- [ ] Upload de arquivos
- [ ] Chat interno
- [ ] Dashboard avançado com gráficos
- [ ] API REST completa com documentação
- [ ] Sistema de backup automático

## 🔧 Troubleshooting

### Problemas Comuns

1. **Erro de conexão com banco**
   - Verifique as credenciais em `config/database.php`
   - Certifique-se de que o MySQL está rodando
   - Verifique se o banco `csc_georgia` existe

2. **Erro 500 no PHP**
   - Verifique os logs de erro do PHP
   - Certifique-se de que todas as extensões estão instaladas
   - Verifique as permissões dos diretórios

3. **Página em branco**
   - Ative a exibição de erros no PHP
   - Verifique se o arquivo `config/database.php` existe
   - Teste a conexão com o banco

4. **Problemas de CORS**
   - Configure o servidor web adequadamente
   - Verifique se as APIs estão acessíveis

### Logs e Debug

- **Logs do PHP**: Verifique os logs de erro do servidor web
- **Logs do MySQL**: Verifique os logs do banco de dados
- **Console do navegador**: Verifique erros JavaScript
- **Network tab**: Verifique requisições HTTP

## 🤝 Suporte

Para suporte técnico ou dúvidas:
- **Email**: ryan31624@gmail.com
- **Desenvolvedor**: Ryan Sá

## 📄 Licença

Este projeto é de uso interno da Geórgia Contábil.

---

**Desenvolvido com ❤️ para a Geórgia Contábil**
