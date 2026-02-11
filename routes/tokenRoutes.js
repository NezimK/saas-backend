const express = require('express');
const router = express.Router();
const gmailTokenService = require('../services/gmailTokenService');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logger = require('../services/logger');

/**
 * GET /api/token/gmail/:tenantId
 * Récupère un access token Gmail valide pour un tenant
 * Refresh automatiquement si expiré
 */
router.get('/gmail/:tenantId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (req.user.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé à ce tenant' });
    }

    const tokenData = await gmailTokenService.getTokenForWorkflow(tenantId);

    res.json({
      success: true,
      ...tokenData
    });

  } catch (error) {
    logger.error('token', 'Erreur recuperation token', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/token/gmail/:tenantId/refresh
 * Force le refresh du token
 */
router.post('/gmail/:tenantId/refresh', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (req.user.tenantId !== tenantId) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé à ce tenant' });
    }

    const newAccessToken = await gmailTokenService.refreshAccessToken(tenantId);

    res.json({
      success: true,
      access_token: newAccessToken,
      tenant_id: tenantId,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    logger.error('token', 'Erreur refresh token', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
