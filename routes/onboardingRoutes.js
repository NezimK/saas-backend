const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const authService = require('../services/authService');
const whatsappPoolService = require('../services/whatsappPoolService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const { verifyOnboardingToken, authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const { DEFAULT_EMAIL_FILTERS } = require('../config/constants');
const logger = require('../services/logger');

/**
 * POST /api/onboarding/get-or-create-tenant
 * Vérifie si un tenant existe avec cet email, sinon le crée
 */
router.post('/get-or-create-tenant', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email requis' });
    }

    logger.info('onboarding', `Recherche tenant pour: ${email}`);

    // Vérifier si un tenant existe avec cet email
    const { data: existingTenant, error: searchError } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('email', email)
      .single();

    if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows found
      logger.error('onboarding', 'Erreur recherche tenant', searchError.message);
      return res.status(500).json({ error: 'Erreur lors de la recherche du tenant' });
    }

    // Si le tenant existe, le retourner
    if (existingTenant) {
      logger.info('onboarding', `Tenant existant trouve: ${existingTenant.tenant_id}`);
      return res.json({
        success: true,
        tenantId: existingTenant.tenant_id,
        companyName: existingTenant.company_name,
        accountType: existingTenant.account_type,
        emailFilters: existingTenant.email_filters || [],
        isExisting: true,
        message: 'Tenant existant chargé'
      });
    }

    // Sinon, créer un nouveau tenant
    const tenantId = uuidv4();
    logger.info('onboarding', `Creation d'un nouveau tenant: ${tenantId}`);

    const { error: insertError } = await supabaseService.supabase
      .from('tenants')
      .insert([{
        tenant_id: tenantId,
        email,
        company_name: `Client ${tenantId.substring(0, 8)}`,
        email_filters: DEFAULT_EMAIL_FILTERS
      }]);

    if (insertError) {
      logger.error('onboarding', 'Erreur creation tenant', insertError.message);
      return res.status(500).json({ error: 'Erreur lors de la création du tenant' });
    }

    logger.info('onboarding', `Nouveau tenant cree: ${tenantId}`);

    // Créer automatiquement un compte utilisateur manager pour le dashboard
    const temporaryPassword = authService.generateTemporaryPassword();
    try {
      await authService.createUser(tenantId, {
        email: email,
        password: temporaryPassword,
        firstName: 'Manager',
        lastName: '',
        role: 'manager'
      });
      logger.info('onboarding', `Compte manager cree pour ${email}`);
    } catch (userError) {
      logger.error('onboarding', 'Erreur creation compte manager', userError.message);
      // On continue même si la création du user échoue (le tenant est créé)
    }

    res.json({
      success: true,
      tenantId,
      emailFilters: DEFAULT_EMAIL_FILTERS,
      isExisting: false,
      message: 'Tenant et compte manager créés avec succès. Un email de configuration sera envoyé après le paiement.'
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur get-or-create-tenant', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/update-account-info
 * Met à jour le type de compte et le nom de l'entreprise
 */
router.post('/update-account-info', verifyOnboardingToken, async (req, res) => {
  try {
    const { tenantId, accountType, companyName } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requis' });
    }

    if (!accountType || !['agence', 'independant'].includes(accountType)) {
      return res.status(400).json({ error: 'accountType doit être "agence" ou "independant"' });
    }

    if (!companyName || companyName.trim() === '') {
      return res.status(400).json({ error: 'companyName requis' });
    }

    logger.info('onboarding', `Mise à jour des infos pour ${tenantId} : ${accountType} - ${companyName}`);

    const { error } = await supabaseService.supabase
      .from('tenants')
      .update({
        account_type: accountType,
        company_name: companyName.trim()
      })
      .eq('tenant_id', tenantId);

    if (error) {
      logger.error('onboarding', 'Erreur mise à jour tenant', error.message);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du tenant' });
    }

    logger.info('onboarding', `Infos mises a jour pour ${tenantId}`);

    res.json({
      success: true,
      message: 'Informations mises à jour avec succès'
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur update-account-info', error.message);
    res.status(500).json({ error: error.message });
  }
});


/**
 * POST /api/onboarding/update-filters
 * Met à jour les filtres email du tenant
 */
router.post('/update-filters', verifyOnboardingToken, async (req, res) => {
  try {
    const { tenantId, emailFilters } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requis' });
    }

    if (!emailFilters || !Array.isArray(emailFilters) || emailFilters.length === 0) {
      return res.status(400).json({ error: 'emailFilters doit être un tableau non vide' });
    }

    // Vérifier si le tenant existe
    const { data: existingTenant } = await supabaseService.supabase
      .from('tenants')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .single();

    if (!existingTenant) {
      // Créer le tenant s'il n'existe pas
      const { error: insertError } = await supabaseService.supabase
        .from('tenants')
        .insert([{
          tenant_id: tenantId,
          company_name: `Company ${tenantId}`,
          email_filters: emailFilters
        }]);

      if (insertError) {
        logger.error('onboarding', 'Erreur creation tenant', insertError.message);
        return res.status(500).json({ error: 'Erreur lors de la création du tenant' });
      }
    } else {
      // Mettre à jour les filtres
      const { error: updateError } = await supabaseService.supabase
        .from('tenants')
        .update({ email_filters: emailFilters })
        .eq('tenant_id', tenantId);

      if (updateError) {
        logger.error('onboarding', 'Erreur mise à jour filtres', updateError.message);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour des filtres' });
      }
    }

    logger.info('onboarding', `Filtres email mis a jour pour ${tenantId}`, emailFilters);

    res.json({
      success: true,
      message: 'Filtres enregistrés avec succès',
      emailFilters
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur update-filters', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/tenant/:tenantId
 * Recupere les informations completes d'un tenant pour l'onboarding
 */
router.get('/tenant/:tenantId', verifyOnboardingToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId requis'
      });
    }

    logger.info('onboarding', `Chargement tenant pour onboarding: ${tenantId}`);

    const { data: tenant, error } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !tenant) {
      logger.error('onboarding', `Tenant non trouvé : ${tenantId}`, error?.message);
      return res.status(404).json({
        success: false,
        error: 'Tenant non trouvé. Veuillez utiliser le lien reçu par email.'
      });
    }

    logger.info('onboarding', `Tenant charge: ${tenant.company_name}`);

    res.json({
      success: true,
      tenant: {
        tenant_id: tenant.tenant_id,
        email: tenant.email,
        company_name: tenant.company_name,
        account_type: tenant.account_type,
        plan: tenant.plan,
        status: tenant.status,
        email_filters: tenant.email_filters || [],
        api_key: tenant.api_key ? '***configured***' : null,
        api_status: tenant.api_status,
        whatsapp_number: tenant.whatsapp_number || null
      }
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur get tenant', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/onboarding/filters/:tenantId
 * Récupère les filtres email d'un tenant
 */
router.get('/filters/:tenantId', verifyOnboardingToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const { data: tenant, error } = await supabaseService.supabase
      .from('tenants')
      .select('email_filters')
      .eq('tenant_id', tenantId)
      .single();

    if (error || !tenant) {
      return res.status(404).json({ error: 'Tenant non trouvé' });
    }

    res.json({
      success: true,
      emailFilters: tenant.email_filters || []
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur get-filters', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/complete
 * Marque l'onboarding comme termine et retourne l'URL du dashboard
 * Assigne automatiquement un numéro WhatsApp du pool
 */
router.post('/complete', verifyOnboardingToken, async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requis' });
    }

    logger.info('onboarding', `Finalisation onboarding pour tenant: ${tenantId}`);

    // Marquer le tenant comme actif
    const { error } = await supabaseService.supabase
      .from('tenants')
      .update({
        status: 'active',
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    if (error) {
      logger.error('onboarding', 'Erreur finalisation onboarding', error.message);
      return res.status(500).json({ error: 'Erreur lors de la finalisation' });
    }

    // Assigner automatiquement un numéro WhatsApp du pool
    const whatsappResult = await whatsappPoolService.assignNumberToTenant(tenantId);

    if (!whatsappResult.success) {
      logger.warn('onboarding', `Pas de numero WhatsApp disponible pour ${tenantId}: ${whatsappResult.error}`);
    } else {
      logger.info('onboarding', `WhatsApp assigne: ${whatsappResult.phoneNumber} (deja assigne: ${whatsappResult.alreadyAssigned})`);
    }

    logger.info('onboarding', `Onboarding termine pour tenant: ${tenantId}`);

    res.json({
      success: true,
      dashboardUrl: process.env.DASHBOARD_URL || 'http://localhost:5173',
      whatsappNumber: whatsappResult.success ? whatsappResult.phoneNumber : null,
      whatsappWarning: whatsappResult.success ? null : whatsappResult.error
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur complete', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/validate-netty-api
 * Valide la clé API Netty et la sauvegarde
 */
/**
 * POST /api/onboarding/whatsapp-number
 * Configure le numéro WhatsApp unique de l'agence
 */
router.post('/whatsapp-number', verifyOnboardingToken, async (req, res) => {
  try {
    const { tenantId, whatsappNumber } = req.body;

    if (!tenantId || !whatsappNumber) {
      return res.status(400).json({ error: 'tenantId et whatsappNumber requis' });
    }

    // Normaliser le numéro au format E.164
    let normalizedNumber = whatsappNumber.trim().replace(/\s+/g, '');

    // Si le numéro ne commence pas par +, ajouter +33 pour la France
    if (!normalizedNumber.startsWith('+')) {
      if (normalizedNumber.startsWith('0')) {
        normalizedNumber = '+33' + normalizedNumber.substring(1);
      } else {
        normalizedNumber = '+' + normalizedNumber;
      }
    }

    // Valider le format E.164
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(normalizedNumber)) {
      return res.status(400).json({
        error: 'Format de numéro invalide. Utilisez le format international (ex: +33612345678)'
      });
    }

    logger.info('onboarding', `Configuration WhatsApp pour ${tenantId}: ${normalizedNumber}`);

    // Vérifier que le numéro n'est pas déjà utilisé par un autre tenant
    const { data: existing, error: checkError } = await supabaseService.supabase
      .from('tenants')
      .select('tenant_id, company_name')
      .eq('whatsapp_number', normalizedNumber)
      .neq('tenant_id', tenantId)
      .maybeSingle();

    if (checkError) {
      logger.error('onboarding', 'Erreur verification unicite', checkError.message);
      return res.status(500).json({ error: 'Erreur lors de la vérification du numéro' });
    }

    if (existing) {
      return res.status(409).json({
        error: `Ce numéro est déjà utilisé par une autre agence (${existing.company_name || 'Inconnue'})`
      });
    }

    // Mettre à jour le tenant avec le numéro WhatsApp
    const { error: updateError } = await supabaseService.supabase
      .from('tenants')
      .update({ whatsapp_number: normalizedNumber })
      .eq('tenant_id', tenantId);

    if (updateError) {
      logger.error('onboarding', 'Erreur mise à jour WhatsApp', updateError.message);
      return res.status(500).json({ error: 'Erreur lors de la sauvegarde du numéro' });
    }

    logger.info('onboarding', `Numero WhatsApp configure pour ${tenantId}: ${normalizedNumber}`);

    res.json({
      success: true,
      whatsappNumber: normalizedNumber,
      message: 'Numéro WhatsApp configuré avec succès'
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur whatsapp-number', error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post('/validate-netty-api', verifyOnboardingToken, async (req, res) => {
  try {
    const { tenantId, apiKey } = req.body;

    if (!tenantId || !apiKey) {
      return res.status(400).json({ error: 'tenantId et apiKey requis' });
    }

    logger.info('onboarding', `Validation clé API Netty pour tenant : ${tenantId}`);

    // Tester la clé API en appelant l'API Netty
    try {
      const testResponse = await axios.get('https://webapi.netty.fr/apiv1/products', {
        headers: {
          'x-netty-api-key': apiKey
        },
        params: {
          limit: 1 // Tester avec 1 seul produit
        },
        timeout: 10000
      });

      if (testResponse.status === 200) {
        logger.info('onboarding', 'Clé API Netty valide');

        // Sauvegarder la clé API dans Supabase
        const { error: updateError } = await supabaseService.supabase
          .from('tenants')
          .update({
            logiciel: 'netty',
            api_key: apiKey,
            api_status: 'active',
            api_last_sync: null
          })
          .eq('tenant_id', tenantId);

        if (updateError) {
          logger.error('onboarding', 'Erreur sauvegarde clé API', updateError.message);
          return res.status(500).json({ error: 'Erreur lors de la sauvegarde de la clé API' });
        }

        logger.info('onboarding', `Clé API Netty sauvegardée pour ${tenantId}`);

        // Déclencher la synchronisation Netty via n8n
        try {
          logger.info('onboarding', `Déclenchement sync Netty pour ${tenantId}...`);
          await axios.post('https://n8n.emkai.fr/webhook/sync-netty-single', {
            tenant_id: tenantId
          }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000 // Timeout court pour ne pas bloquer la réponse
          });
          logger.info('onboarding', `Sync Netty declenche pour ${tenantId}`);
        } catch (syncError) {
          // Log l'erreur mais ne bloque pas la réponse
          logger.error('onboarding', 'Erreur déclenchement sync Netty', syncError.message);
        }

        return res.json({
          success: true,
          message: 'Clé API Netty validée et sauvegardée',
          productsCount: testResponse.data?.length || 0
        });
      }

    } catch (apiError) {
      logger.error('onboarding', `Erreur validation API Netty: ${apiError.response?.status}`, apiError.response?.data);

      if (apiError.response?.status === 401 || apiError.response?.status === 403) {
        return res.status(401).json({
          error: 'Clé API invalide. Veuillez vérifier votre clé API Netty.'
        });
      }

      if (apiError.code === 'ECONNABORTED' || apiError.code === 'ETIMEDOUT') {
        return res.status(408).json({
          error: 'Timeout : impossible de contacter l\'API Netty. Vérifiez que votre IP est autorisée.'
        });
      }

      return res.status(500).json({
        error: 'Erreur lors de la validation de la clé API : ' + (apiError.message || 'Erreur inconnue')
      });
    }

  } catch (error) {
    logger.error('onboarding', 'Erreur validate-netty-api', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/save-notification-settings
 * Sauvegarde les préférences de notifications d'un utilisateur
 */
router.post('/save-notification-settings', verifyOnboardingToken, async (req, res) => {
  try {
    const { userId, notificationSettings } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId requis' });
    }

    if (!notificationSettings || typeof notificationSettings !== 'object') {
      return res.status(400).json({ error: 'notificationSettings requis' });
    }

    logger.info('onboarding', `Sauvegarde preferences notifications pour user ${userId}`, notificationSettings);

    const { error } = await supabaseService.supabase
      .from('users')
      .update({
        notification_settings: notificationSettings
      })
      .eq('id', userId);

    if (error) {
      logger.error('onboarding', 'Erreur sauvegarde notification settings', error.message);
      return res.status(500).json({ error: 'Erreur lors de la sauvegarde des préférences' });
    }

    logger.info('onboarding', `Préférences notifications sauvegardées pour user ${userId}`);

    res.json({
      success: true,
      message: 'Préférences de notifications enregistrées'
    });

  } catch (error) {
    logger.error('onboarding', 'Erreur save-notification-settings', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/whatsapp-pool
 * Récupère le statut du pool de numéros WhatsApp (admin)
 */
router.get('/whatsapp-pool', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const status = await whatsappPoolService.getPoolStatus();

    if (!status.success) {
      return res.status(500).json({ error: status.error });
    }

    res.json(status);
  } catch (error) {
    logger.error('onboarding', 'Erreur whatsapp-pool', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/whatsapp-pool/add
 * Ajouter un numéro au pool (admin)
 */
router.post('/whatsapp-pool/add', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'phoneNumber requis' });
    }

    const result = await whatsappPoolService.addNumberToPool(phoneNumber);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    logger.error('onboarding', 'Erreur whatsapp-pool/add', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/whatsapp-pool/release
 * Libérer le numéro d'un tenant (admin)
 */
router.post('/whatsapp-pool/release', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({ error: 'tenantId requis' });
    }

    const result = await whatsappPoolService.releaseNumber(tenantId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    logger.error('onboarding', 'Erreur whatsapp-pool/release', error.message);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
