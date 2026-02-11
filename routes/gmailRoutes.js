const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const gmailService = require('../services/gmailService');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logger = require('../services/logger');

// Récupérer les emails pour un tenant
router.get('/fetch-emails/:tenantId', authMiddleware, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Vérifier que le tenant correspond au JWT
    if (req.user.tenantId !== tenantId) {
      return res.status(403).json({ error: 'Accès non autorisé à ce tenant' });
    }

    const sources = req.query.sources ? req.query.sources.split(',') : ['canva'];

    logger.info('gmail', `Recuperation des emails pour tenant: ${tenantId}`);

    // 1. Récupérer le tenant depuis Supabase
    const { data: tenant, error } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !tenant) {
      return res.status(404).json({ error: 'Tenant non trouvé' });
    }

    if (!tenant.email_oauth_tokens) {
      return res.status(400).json({
        error: 'Gmail non connecté pour ce tenant'
      });
    }

    // 2. Récupérer les emails des sources spécifiées
    const emails = await gmailService.getEmailsFromSources(tenant.email_oauth_tokens, sources);

    logger.info('gmail', `${emails.length} email(s) recupere(s)`);

    res.json({
      success: true,
      tenantId,
      emailCount: emails.length,
      emails: emails.map(e => ({
        id: e.id,
        from: e.from,
        subject: e.subject,
        date: e.date,
        preview: e.body.substring(0, 100) + '...'
      }))
    });

  } catch (error) {
    logger.error('gmail', 'Erreur', error.message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
