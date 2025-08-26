import express from 'express';
import { Issuer, generators } from 'openid-client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import winston from 'winston';

const authenticateRouter = express.Router();

// Configure allowed domains and emails
const allowedDomains = (process.env.ALLOWED_DOMAINS || 'georgiacontabil.com.br,nine9.com.br')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const allowedEmails = (process.env.ALLOWED_EMAILS || 'ryan31624@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// Role definitions
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
  VIEWER: 'VIEWER'
};

// Permission definitions
const PERMISSIONS = {
  TICKET_CREATE: 'ticket:create',
  TICKET_READ: 'ticket:read',
  TICKET_UPDATE: 'ticket:update',
  TICKET_DELETE: 'ticket:delete',
  TICKET_ASSIGN: 'ticket:assign',
  TICKET_CLOSE: 'ticket:close',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  SYSTEM_ADMIN: 'system:admin',
  REPORTS_VIEW: 'reports:view',
  REPORTS_EXPORT: 'reports:export'
};

// Role permissions mapping
const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.ADMIN]: [
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ,
    PERMISSIONS.TICKET_UPDATE,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.TICKET_CLOSE,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.REPORTS_VIEW,
    PERMISSIONS.REPORTS_EXPORT
  ],
  [ROLES.MANAGER]: [
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ,
    PERMISSIONS.TICKET_UPDATE,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.REPORTS_VIEW
  ],
  [ROLES.USER]: [
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ
  ],
  [ROLES.VIEWER]: [
    PERMISSIONS.TICKET_READ
  ]
};

let clientPromise;
async function getClient() {
  if (!clientPromise) {
    const tenantId = process.env.AZURE_TENANT_ID;
    const azureIssuer = await Issuer.discover(`https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`);
    clientPromise = new azureIssuer.Client({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      redirect_uris: [process.env.AZURE_REDIRECT_URI],
      response_types: ['code']
    });
  }
  return clientPromise;
}

function getUserEmailFromTokens(tokenSet) {
  const id = tokenSet.claims();
  return (id.preferred_username || id.email || id.upn || '').toLowerCase();
}

function isDomainAllowed(email) {
  const domain = email.split('@')[1];
  if (allowedEmails.includes(email)) return true;
  return allowedDomains.includes(domain);
}

function determineUserRole(email) {
  if (email === 'ryan31624@gmail.com') return ROLES.SUPER_ADMIN;
  if (email.endsWith('@georgiacontabil.com.br')) return ROLES.ADMIN;
  if (email.endsWith('@nine9.com.br')) return ROLES.MANAGER;
  return ROLES.USER;
}

function hasPermission(userRole, permission) {
  const userPermissions = ROLE_PERMISSIONS[userRole] || [];
  return userPermissions.includes(permission);
}

const codeVerifierMap = new Map();

// Login endpoint
authenticateRouter.get('/login', async (req, res, next) => {
  try {
    const client = await getClient();
    const codeVerifier = generators.codeVerifier();
    const codeChallenge = generators.codeChallenge(codeVerifier);
    const state = generators.state();

    codeVerifierMap.set(state, codeVerifier);
    setTimeout(() => codeVerifierMap.delete(state), 5 * 60 * 1000);

    const authUrl = client.authorizationUrl({
      scope: 'openid profile email',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      state
    });
    res.redirect(authUrl);
  } catch (err) {
    next(err);
  }
});

// Callback endpoint
authenticateRouter.get('/callback', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const codeVerifier = codeVerifierMap.get(params.state);
    const tokenSet = await client.callback(process.env.AZURE_REDIRECT_URI, params, { code_verifier: codeVerifier });
    const email = getUserEmailFromTokens(tokenSet);
    
    if (!email || !isDomainAllowed(email)) {
      return res.status(403).send(`
        <html>
          <head><title>Acesso Negado</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h1>🚫 Acesso Negado</h1>
            <p>O domínio do seu email não está autorizado a acessar este sistema.</p>
            <p>Domínios permitidos: ${allowedDomains.join(', ')}</p>
            <p>Emails permitidos: ${allowedEmails.join(', ')}</p>
            <a href="/" style="color: #007bff;">Voltar ao início</a>
          </body>
        </html>
      `);
    }

    const role = determineUserRole(email);
    const permissions = ROLE_PERMISSIONS[role] || [];

    req.session.user = {
      id: uuidv4(),
      email,
      name: tokenSet.claims().name || email,
      role,
      permissions,
      lastLogin: new Date().toISOString(),
      isActive: true
    };

    // Persist/Update user in database
    try {
      await req.db.execute(`
        INSERT INTO users (id, email, name, role, permissions, last_login, is_active, created_at) 
        VALUES (?, ?, ?, ?, ?, NOW(), 1, NOW()) 
        ON DUPLICATE KEY UPDATE 
          name = VALUES(name), 
          role = VALUES(role), 
          permissions = VALUES(permissions), 
          last_login = NOW(), 
          is_active = 1
      `, [
        req.session.user.id,
        req.session.user.email,
        req.session.user.name,
        req.session.user.role,
        JSON.stringify(req.session.user.permissions)
      ]);

      // Log successful login
      await req.db.execute(`
        INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?)
      `, [
        req.session.user.id,
        'LOGIN',
        JSON.stringify({ email, role, permissions }),
        req.ip,
        req.get('User-Agent')
      ]);

    } catch (error) {
      req.logger.error('Error persisting user:', error);
    }

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

// Logout endpoint
authenticateRouter.post('/logout', async (req, res) => {
  try {
    if (req.session.user) {
      // Log logout
      await req.db.execute(`
        INSERT INTO audit_logs (user_id, action, details, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?)
      `, [
        req.session.user.id,
        'LOGOUT',
        JSON.stringify({ email: req.session.user.email }),
        req.ip,
        req.get('User-Agent')
      ]);
    }

    req.session.destroy(() => {
      res.status(200).json({ ok: true });
    });
  } catch (error) {
    req.logger.error('Error during logout:', error);
    req.session.destroy(() => {
      res.status(200).json({ ok: true });
    });
  }
});

// 2FA setup endpoint
authenticateRouter.post('/2fa/setup', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const secret = speakeasy.generateSecret({
      name: `CSC Geórgia (${req.session.user.email})`
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    // Store secret temporarily
    req.session.temp2FASecret = secret.base32;

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl
    });
  } catch (error) {
    req.logger.error('Error setting up 2FA:', error);
    res.status(500).json({ error: 'Erro ao configurar 2FA' });
  }
});

// 2FA verify endpoint
authenticateRouter.post('/2fa/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!req.session.temp2FASecret) {
      return res.status(400).json({ error: '2FA não configurado' });
    }

    const verified = speakeasy.totp.verify({
      secret: req.session.temp2FASecret,
      encoding: 'base32',
      token: token
    });

    if (verified) {
      // Enable 2FA for user
      await req.db.execute(`
        UPDATE users SET 
          two_factor_secret = ?, 
          two_factor_enabled = 1 
        WHERE email = ?
      `, [req.session.temp2FASecret, req.session.user.email]);

      delete req.session.temp2FASecret;
      res.json({ ok: true });
    } else {
      res.status(400).json({ error: 'Token inválido' });
    }
  } catch (error) {
    req.logger.error('Error verifying 2FA:', error);
    res.status(500).json({ error: 'Erro ao verificar 2FA' });
  }
});

// Middleware to require authentication
export function requireAuthMiddleware(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Não autenticado' });
  }
  next();
}

// Middleware to require specific roles
export function requireRoleMiddleware(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!allowedRoles.includes(req.session.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    next();
  };
}

// Middleware to require specific permissions
export function requirePermissionMiddleware(permission) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    if (!hasPermission(req.session.user.role, permission)) {
      return res.status(403).json({ error: 'Permissão insuficiente' });
    }

    next();
  };
}

// Get current user info
authenticateRouter.get('/me', requireAuthMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.session.user.id,
      email: req.session.user.email,
      name: req.session.user.name,
      role: req.session.user.role,
      permissions: req.session.user.permissions,
      lastLogin: req.session.user.lastLogin
    }
  });
});

export { authenticateRouter, ROLES, PERMISSIONS, hasPermission };
