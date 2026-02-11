const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logger = require('../services/logger');

// URL du webhook n8n (configurable via env)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://n8n.emkai.fr';

/**
 * POST /api/sync/netty/:tenantId
 * Déclenche une synchronisation manuelle des biens Netty pour un tenant
 */
router.post('/netty/:tenantId', authMiddleware, async (req, res) => {
  const { tenantId } = req.params;

  // Vérifier que le tenant correspond au JWT
  if (req.user.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Accès non autorisé à ce tenant' });
  }

  if (!tenantId) {
    return res.status(400).json({
      success: false,
      error: 'tenant_id requis'
    });
  }

  try {
    logger.info('sync', `Sync Netty demandee pour tenant: ${tenantId}`);

    // Appel du webhook n8n
    const response = await fetch(`${N8N_WEBHOOK_URL}/webhook/sync-netty-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tenant_id: tenantId })
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error('sync', 'Erreur sync Netty', result);
      return res.status(response.status).json({
        success: false,
        error: result.error || 'Erreur lors de la synchronisation',
        details: result
      });
    }

    logger.info('sync', 'Sync Netty terminee', result);

    return res.json({
      success: true,
      message: result.message || 'Synchronisation terminée',
      count: result.count || 0,
      tenant_id: tenantId
    });

  } catch (error) {
    logger.error('sync', 'Erreur sync Netty', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la synchronisation',
      details: error.message
    });
  }
});

/**
 * GET /api/sync/status/:tenantId
 * Récupère le statut de la dernière synchronisation
 */
router.get('/status/:tenantId', authMiddleware, async (req, res) => {
  const { tenantId } = req.params;

  // Vérifier que le tenant correspond au JWT
  if (req.user.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Accès non autorisé à ce tenant' });
  }

  try {
    const { data, error } = await supabaseService.supabase
      .from('tenants')
      .select('api_last_sync, api_status, company_name')
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        error: 'Tenant non trouvé'
      });
    }

    // Compter les biens du tenant
    const { count } = await supabaseService.supabase
      .from('biens')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', tenantId);

    return res.json({
      success: true,
      tenant_id: tenantId,
      company_name: data.company_name,
      api_status: data.api_status,
      last_sync: data.api_last_sync,
      biens_count: count || 0
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
