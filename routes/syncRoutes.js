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
      details: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/sync/apimo/:tenantId
 * Déclenche une synchronisation manuelle des biens Apimo pour un tenant
 */
router.post('/apimo/:tenantId', authMiddleware, async (req, res) => {
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
    logger.info('sync', `Sync Apimo demandee pour tenant: ${tenantId}`);

    // Appel du webhook n8n
    const response = await fetch(`${N8N_WEBHOOK_URL}/webhook/sync-apimo-single`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tenant_id: tenantId })
    });

    const result = await response.json();

    if (!response.ok) {
      logger.error('sync', 'Erreur sync Apimo', result);
      return res.status(response.status).json({
        success: false,
        error: result.error || 'Erreur lors de la synchronisation',
        details: result
      });
    }

    logger.info('sync', 'Sync Apimo terminee', result);

    return res.json({
      success: true,
      message: result.message || 'Synchronisation terminée',
      count: result.count || 0,
      tenant_id: tenantId
    });

  } catch (error) {
    logger.error('sync', 'Erreur sync Apimo', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la synchronisation',
      details: 'Erreur serveur'
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
      .select('api_last_sync, api_status, company_name, logiciel')
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
      logiciel: data.logiciel || null,
      biens_count: count || 0
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/sync/apimo/contact/:tenantId
 * Crée un contact dans Apimo à partir d'un lead qualifié
 * Body: { firstname, lastname, email, phone, comment }
 */
router.post('/apimo/contact/:tenantId', authMiddleware, async (req, res) => {
  const { tenantId } = req.params;

  if (req.user.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Accès non autorisé à ce tenant' });
  }

  const { firstname, lastname, email, phone, comment } = req.body;

  if (!lastname && !email) {
    return res.status(400).json({ success: false, error: 'lastname ou email requis' });
  }

  try {
    // Récupérer les credentials Apimo du tenant
    const { data: tenant, error: tenantError } = await supabaseService.supabase
      .from('tenants')
      .select('logiciel, api_key')
      .eq('tenant_id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    if (tenant.logiciel !== 'apimo') {
      return res.status(400).json({ success: false, error: 'Ce tenant n\'utilise pas Apimo' });
    }

    let credentials;
    try {
      credentials = JSON.parse(tenant.api_key);
    } catch (e) {
      return res.status(500).json({ success: false, error: 'Credentials Apimo invalides' });
    }

    const { provider_id, token, agency_id } = credentials;
    const authString = Buffer.from(`${provider_id}:${token}`).toString('base64');

    logger.info('sync', `Création contact Apimo pour tenant ${tenantId}: ${firstname} ${lastname}`);

    // Appel API Apimo POST /agencies/{agency_id}/contacts
    const apimoResponse = await fetch(`https://api.apimo.pro/agencies/${agency_id}/contacts`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        firstname: firstname || '',
        lastname: lastname || '',
        email: email || '',
        phone: phone || '',
        comment: comment || ''
      })
    });

    const result = await apimoResponse.json();

    if (!apimoResponse.ok) {
      logger.error('sync', 'Erreur création contact Apimo', result);
      return res.status(apimoResponse.status).json({
        success: false,
        error: 'Erreur lors de la création du contact dans Apimo',
        details: result
      });
    }

    logger.info('sync', `Contact Apimo créé: ${result.id}`);

    return res.json({
      success: true,
      message: 'Contact créé dans Apimo',
      apimo_contact_id: result.id
    });

  } catch (error) {
    logger.error('sync', 'Erreur création contact Apimo', error.message);
    return res.status(500).json({
      success: false,
      error: 'Erreur serveur',
      details: 'Erreur serveur'
    });
  }
});

module.exports = router;
