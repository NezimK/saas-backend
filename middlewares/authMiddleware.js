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
 * Middleware optionnel d'authentification
 * Ne bloque pas si pas de token, mais attache l'utilisateur si présent
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = authService.verifyAccessToken(token);
    req.user = {
      userId: decoded.userId,
      tenantId: decoded.tenantId,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name
    };
  } catch (error) {
    // Token invalide, on continue sans utilisateur
  }

  next();
};

/**
 * Vérifie que l'utilisateur a accès à un tenant spécifique
 */
const verifyTenantAccess = (req, res, next) => {
  const requestedTenantId = req.params.tenantId || req.body.tenantId || req.body.tenant_id;

  if (!requestedTenantId) {
    return next();
  }

  if (req.user.tenantId !== requestedTenantId) {
    return res.status(403).json({
      error: 'Accès non autorisé à ce tenant',
      code: 'TENANT_FORBIDDEN'
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  requireRole,
  optionalAuth,
  verifyTenantAccess
};
