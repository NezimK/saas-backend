const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

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

    console.log(`🔍 Recherche tenant pour: ${email}`);

    // Vérifier si un tenant existe avec cet email
    const { data: existingTenant, error: searchError } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('email', email)
      .single();

    if (searchError && searchError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Erreur recherche tenant:', searchError);
      return res.status(500).json({ error: 'Erreur lors de la recherche du tenant' });
    }

    // Si le tenant existe, le retourner
    if (existingTenant) {
      console.log(`✅ Tenant existant trouvé: ${existingTenant.tenant_id}`);
      return res.json({
        success: true,
        tenantId: existingTenant.tenant_id,
        emailFilters: existingTenant.email_filters || [],
        isExisting: true,
        message: 'Tenant existant chargé'
      });
    }

    // Sinon, créer un nouveau tenant
    const tenantId = uuidv4();
    console.log(`🆕 Création d'un nouveau tenant: ${tenantId}`);

    const { error: insertError } = await supabaseService.supabase
      .from('tenants')
      .insert([{
        tenant_id: tenantId,
        email,
        company_name: `Client ${tenantId.substring(0, 8)}`,
        email_filters: ['leboncoin.fr', 'seloger.com', 'pap.fr', 'logic-immo.com', 'bienici.com']
      }]);

    if (insertError) {
      console.error('Erreur création tenant:', insertError);
      return res.status(500).json({ error: 'Erreur lors de la création du tenant' });
    }

    console.log(`✅ Nouveau tenant créé: ${tenantId}`);

    res.json({
      success: true,
      tenantId,
      emailFilters: ['leboncoin.fr', 'seloger.com', 'pap.fr', 'logic-immo.com', 'bienici.com'],
      isExisting: false,
      message: 'Tenant créé avec succès'
    });

  } catch (error) {
    console.error('Erreur get-or-create-tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/create-tenant
 * Crée un nouveau tenant avec un ID unique
 * @deprecated Utiliser get-or-create-tenant à la place
 */
router.post('/create-tenant', async (req, res) => {
  try {
    const { companyName, email } = req.body;

    // Générer un tenantId unique
    const tenantId = uuidv4();

    console.log(`🆕 Création d'un nouveau tenant: ${tenantId}`);

    // Créer le tenant dans Supabase
    const { error } = await supabaseService.supabase
      .from('tenants')
      .insert([{
        tenant_id: tenantId,
        email,
        company_name: companyName || `Client ${tenantId.substring(0, 8)}`,
        email_filters: ['leboncoin.fr', 'seloger.com', 'pap.fr', 'logic-immo.com', 'bienici.com'] // Valeurs par défaut
      }]);

    if (error) {
      console.error('Erreur création tenant:', error);
      return res.status(500).json({ error: 'Erreur lors de la création du tenant' });
    }

    console.log(`✅ Tenant créé: ${tenantId}`);

    res.json({
      success: true,
      tenantId,
      message: 'Tenant créé avec succès'
    });

  } catch (error) {
    console.error('Erreur create-tenant:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/update-filters
 * Met à jour les filtres email du tenant
 */
router.post('/update-filters', async (req, res) => {
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
        console.error('Erreur création tenant:', insertError);
        return res.status(500).json({ error: 'Erreur lors de la création du tenant' });
      }
    } else {
      // Mettre à jour les filtres
      const { error: updateError } = await supabaseService.supabase
        .from('tenants')
        .update({ email_filters: emailFilters })
        .eq('tenant_id', tenantId);

      if (updateError) {
        console.error('Erreur mise à jour filtres:', updateError);
        return res.status(500).json({ error: 'Erreur lors de la mise à jour des filtres' });
      }
    }

    console.log(`✅ Filtres email mis à jour pour ${tenantId}:`, emailFilters);

    res.json({
      success: true,
      message: 'Filtres enregistrés avec succès',
      emailFilters
    });

  } catch (error) {
    console.error('Erreur update-filters:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/onboarding/filters/:tenantId
 * Récupère les filtres email d'un tenant
 */
router.get('/filters/:tenantId', async (req, res) => {
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
    console.error('Erreur get-filters:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/onboarding/validate-netty-api
 * Valide la clé API Netty et la sauvegarde
 */
router.post('/validate-netty-api', async (req, res) => {
  try {
    const { tenantId, apiKey } = req.body;

    if (!tenantId || !apiKey) {
      return res.status(400).json({ error: 'tenantId et apiKey requis' });
    }

    console.log(`🔑 Validation clé API Netty pour tenant: ${tenantId}`);

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
        console.log('✅ Clé API Netty valide');

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
          console.error('Erreur sauvegarde clé API:', updateError);
          return res.status(500).json({ error: 'Erreur lors de la sauvegarde de la clé API' });
        }

        console.log(`✅ Clé API Netty sauvegardée pour ${tenantId}`);

        return res.json({
          success: true,
          message: 'Clé API Netty validée et sauvegardée',
          productsCount: testResponse.data?.length || 0
        });
      }

    } catch (apiError) {
      console.error('❌ Erreur validation API Netty:', apiError.response?.status, apiError.response?.data);

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
    console.error('Erreur validate-netty-api:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
