const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const gmailService = require('../services/gmailService');

// Récupérer les emails pour un tenant
router.get('/fetch-emails/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const sources = req.query.sources ? req.query.sources.split(',') : ['canva'];

    console.log(`📧 Récupération des emails pour tenant: ${tenantId}`);

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
        error: 'Gmail non connecté pour ce tenant',
        hint: `Connectez Gmail: http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`
      });
    }

    // 2. Récupérer les emails des sources spécifiées
    const emails = await gmailService.getEmailsFromSources(tenant.email_oauth_tokens, sources);

    console.log(`✅ ${emails.length} email(s) récupéré(s)`);

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
    console.error('❌ Erreur:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
