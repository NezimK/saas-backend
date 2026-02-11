/**
 * Middleware d'authentification JWT
 * Vérifie les tokens et contrôle l'accès par rôle
 */

const authService = require('../services/authService');

/**
 * Middleware principal d'authentification
 * Vérifie le JWT dans le header Authorization
 */
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Token manquant',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = authService.verifyAccessToken(token);
    // Attacher les infos utilisateur à la requête
    req.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expiré',
        code: 'TOKEN_EXPIRED'
      });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Token invalide',
        code: 'INVALID_TOKEN'
      });
    }
    return res.status(401).json({
      error: 'Erreur d\'authentification',
      code: 'AUTH_ERROR'
    });
  }
};

/**
 * Middleware de contrôle d'accès par rôle
 * @param {...string} roles - Rôles autorisés
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Non authentifié',
        code: 'NOT_AUTHENTICATED'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accès non autorisé pour ce rôle',
        code: 'FORBIDDEN'
      });
    }

    next();
  };
};

/**
 * Middleware de vérification du token d'onboarding
 * Vérifie un JWT signé contenant purpose='onboarding' et tenantId
 * Protège les endpoints post-paiement Stripe
 */
const verifyOnboardingToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token d\'onboarding manquant', code: 'NO_ONBOARDING_TOKEN' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = authService.verifyAccessToken(token);

    // Accepter soit un token d'onboarding, soit un token d'auth normal (dashboard)
    if (decoded.purpose === 'onboarding') {
      req.onboardingTenantId = decoded.tenantId;
    } else if (decoded.userId && decoded.tenantId) {
      // Token d'auth dashboard — l'utilisateur est connecté
      req.onboardingTenantId = decoded.tenantId;
      req.user = {
        userId: decoded.userId,
        tenantId: decoded.tenantId,
        email: decoded.email,
        role: decoded.role
      };
    } else {
      return res.status(403).json({ error: 'Token non valide pour l\'onboarding', code: 'INVALID_TOKEN_PURPOSE' });
    }

    const requestedTenantId = req.params.tenantId || req.body.tenantId || req.body.tenant_id;
    if (requestedTenantId && requestedTenantId !== (decoded.tenantId)) {
      return res.status(403).json({ error: 'Accès non autorisé à ce tenant', code: 'TENANT_MISMATCH' });
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Token invalide', code: 'INVALID_TOKEN' });
  }
};

/**
 * Middleware de vérification d'API key interne (n8n → backend)
 * Comparaison timing-safe pour éviter les attaques par timing
 */
const verifyInternalApiKey = (req, res, next) => {
  const apiKey = req.headers['x-internal-api-key'];
  const crypto = require('crypto');

  if (!process.env.INTERNAL_API_KEY) {
    return res.status(500).json({ error: 'Configuration serveur manquante' });
  }

  if (!apiKey) {
    return res.status(401).json({ error: 'API key interne manquante', code: 'NO_INTERNAL_API_KEY' });
  }

  const expected = Buffer.from(process.env.INTERNAL_API_KEY, 'utf8');
  const received = Buffer.from(String(apiKey), 'utf8');

  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return res.status(401).json({ error: 'API key interne invalide', code: 'INVALID_INTERNAL_API_KEY' });
  }

  next();
};

module.exports = {
  authMiddleware,
  requireRole,
  verifyOnboardingToken,
  verifyInternalApiKey
};
