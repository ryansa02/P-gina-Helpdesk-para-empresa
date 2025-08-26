import express from 'express';
import { Issuer, generators } from 'openid-client';

const authenticateRouter = express.Router();

const allowedDomains = (process.env.ALLOWED_DOMAINS || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const allowedEmails = (process.env.ALLOWED_EMAILS || 'ryan31624@gmail.com')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

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

const codeVerifierMap = new Map();

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

authenticateRouter.get('/callback', async (req, res, next) => {
  try {
    const client = await getClient();
    const params = client.callbackParams(req);
    const codeVerifier = codeVerifierMap.get(params.state);
    const tokenSet = await client.callback(process.env.AZURE_REDIRECT_URI, params, { code_verifier: codeVerifier });
    const email = getUserEmailFromTokens(tokenSet);
    if (!email || !isDomainAllowed(email)) {
      return res.status(403).send('Domínio não autorizado.');
    }

    req.session.user = {
      email,
      name: tokenSet.claims().name || email
    };
    // Persist/Atualiza o usuário
    try {
      await req.db.execute(
        'INSERT INTO users (email, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)',
        [req.session.user.email, req.session.user.name]
      );
    } catch (_) { /* ignore persistence errors but keep session */ }
    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

authenticateRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.status(200).json({ ok: true });
  });
});

export function requireAuthMiddleware(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Não autenticado' });
  next();
}

export { authenticateRouter };

