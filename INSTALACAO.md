# 🚀 Guia Rápido de Instalação - CSC Geórgia Contábil

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- ✅ **PHP 7.4+** com extensões: PDO, PDO_MySQL, JSON, MBString
- ✅ **MySQL 5.7+** ou **MariaDB 10.2+**
- ✅ **Servidor Web** (Apache, Nginx, ou servidor embutido do PHP)

## ⚡ Instalação em 5 Passos

### 1. **Configurar o Banco de Dados**

```sql
-- Conecte ao MySQL e execute:
CREATE DATABASE csc_georgia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. **Configurar as Credenciais**

```bash
# Copie o arquivo de exemplo
cp config/database.example.php config/database.php

# Edite o arquivo config/database.php com suas credenciais:
```

```php
define('DB_HOST', 'localhost');           // Seu host MySQL
define('DB_NAME', 'csc_georgia');         // Nome do banco criado
define('DB_USER', 'seu_usuario');         // Seu usuário MySQL
define('DB_PASS', 'sua_senha');           // Sua senha MySQL
```

### 3. **Executar o Setup**

Acesse no navegador:
```
http://localhost/paginatest.js/setup.php
```

Siga as instruções para:
- ✅ Verificar requisitos do sistema
- ✅ Testar conexão com banco
- ✅ Criar tabelas automaticamente

### 4. **Iniciar o Servidor**

```bash
# Opção 1: Servidor embutido do PHP
php -S localhost:8000

# Opção 2: Apache/Nginx
# Configure seu servidor web para apontar para o diretório
```

### 5. **Acessar o Sistema**

```
http://localhost:8000
```

## 🔐 Primeiro Login

Use um destes emails para fazer login:

- **Super Admin**: `ryan31624@gmail.com`
- **Usuário Teste**: `teste@georgiacontabil.com.br`
- **Usuário Teste**: `teste@nine9.com.br`

## 🛠️ Configurações Adicionais

### Personalizar Domínios Autorizados

Edite `config/database.php`:

```php
define('ALLOWED_DOMAINS', ['georgiacontabil.com.br', 'nine9.com.br']);
define('ALLOWED_EMAILS', ['ryan31624@gmail.com']);
```

### Configurar Email (Opcional)

```php
define('SMTP_HOST', 'smtp.office365.com');
define('SMTP_PORT', 587);
define('SMTP_USER', 'noreply@georgiacontabil.com.br');
define('SMTP_PASS', 'sua_senha_email');
```

### Configurar HTTPS (Produção)

Descomente no `.htaccess`:

```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

## 🔧 Troubleshooting

### Erro de Conexão com Banco

```bash
# Verifique se o MySQL está rodando
sudo systemctl status mysql

# Teste a conexão
mysql -u seu_usuario -p csc_georgia
```

### Erro 500 no PHP

```bash
# Verifique os logs
tail -f logs/php_errors.log

# Ative exibição de erros temporariamente
php_flag display_errors On
```

### Página em Branco

```bash
# Verifique permissões
chmod 755 config/
chmod 644 config/database.php

# Verifique se o arquivo existe
ls -la config/database.php
```

## 📁 Estrutura de Arquivos

```
paginatest.js/
├── index.html              # Interface principal
├── script.js               # JavaScript do frontend
├── style.css               # Estilos CSS
├── setup.php               # Setup automático
├── .htaccess               # Configurações Apache
├── config/
│   ├── database.php        # Configurações do banco
│   └── database.example.php # Exemplo de configuração
├── api/
│   ├── auth.php            # API de autenticação
│   └── tickets.php         # API de chamados
├── db/
│   └── schema.sql          # Schema do banco
├── uploads/                # Arquivos enviados
├── logs/                   # Logs do sistema
└── README.md               # Documentação completa
```

## 🚀 Deploy em Produção

### 1. **Configurar Servidor**

```bash
# Instalar dependências
sudo apt update
sudo apt install apache2 mysql-server php php-mysql php-pdo

# Habilitar módulos Apache
sudo a2enmod rewrite
sudo a2enmod headers
sudo systemctl restart apache2
```

### 2. **Configurar Banco**

```sql
CREATE DATABASE csc_georgia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'csc_user'@'localhost' IDENTIFIED BY 'senha_forte';
GRANT ALL PRIVILEGES ON csc_georgia.* TO 'csc_user'@'localhost';
FLUSH PRIVILEGES;
```

### 3. **Configurar Apache**

```apache
<VirtualHost *:80>
    ServerName seu-dominio.com
    DocumentRoot /var/www/paginatest.js
    
    <Directory /var/www/paginatest.js>
        AllowOverride All
        Require all granted
    </Directory>
    
    ErrorLog ${APACHE_LOG_DIR}/csc_error.log
    CustomLog ${APACHE_LOG_DIR}/csc_access.log combined
</VirtualHost>
```

### 4. **Configurar SSL**

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-apache

# Gerar certificado
sudo certbot --apache -d seu-dominio.com
```

## 📞 Suporte

Se encontrar problemas:

1. **Verifique os logs**: `logs/php_errors.log`
2. **Teste o setup**: `http://seu-dominio.com/setup.php`
3. **Contate o suporte**: ryan31624@gmail.com

## ✅ Checklist de Instalação

- [ ] PHP 7.4+ instalado com extensões
- [ ] MySQL configurado e rodando
- [ ] Banco `csc_georgia` criado
- [ ] Arquivo `config/database.php` configurado
- [ ] Setup executado com sucesso
- [ ] Servidor web configurado
- [ ] Sistema acessível via navegador
- [ ] Login funcionando
- [ ] Criação de chamados funcionando

---

**🎉 Parabéns! Seu sistema CSC está funcionando!**
