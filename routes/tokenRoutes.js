const express = require('express');
const router = express.Router();
const gmailTokenService = require('../services/gmailTokenService');

/**
 * GET /api/token/gmail/:tenantId
 * Récupère un access token Gmail valide pour un tenant
 * Refresh automatiquement si expiré
 */
router.get('/gmail/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tokenData = await gmailTokenService.getTokenForWorkflow(tenantId);

    res.json({
      success: true,
      ...tokenData
    });

  } catch (error) {
    console.error('Erreur récupération token:', error);
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
router.post('/gmail/:tenantId/refresh', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const newAccessToken = await gmailTokenService.refreshAccessToken(tenantId);

    res.json({
      success: true,
      access_token: newAccessToken,
      tenant_id: tenantId,
      message: 'Token refreshed successfully'
    });

  } catch (error) {
    console.error('Erreur refresh token:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
