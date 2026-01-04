const { google } = require('googleapis');
const oauthConfig = require('../config/oauth');
const supabaseService = require('../services/supabaseService');
const workflowService = require('../services/workflowService');
const n8nService = require('../services/n8nService');

class OAuthController {
  // Générer l'URL de connexion Gmail
  getGmailAuthUrl(req, res) {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).send(`
        <h1>❌ Erreur</h1>
        <p>Le paramètre <code>tenantId</code> est requis.</p>
        <p>Exemple : <code>/auth/gmail/connect?tenantId=test-tenant-001</code></p>
      `);
    }

    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.google.clientId,
      oauthConfig.google.clientSecret,
      oauthConfig.google.redirectUri
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: oauthConfig.google.scopes,
      state: tenantId, // On passe le tenant_id dans state
      prompt: 'consent' // Force le refresh_token
    });

    // Redirige directement vers Google
    res.redirect(authUrl);
  }
  
  // Callback Gmail après autorisation
  async handleGmailCallback(req, res) {
    try {
      const { code, state: tenantId } = req.query;
      
      if (!code || !tenantId) {
        return res.status(400).json({ error: 'Code ou tenant_id manquant' });
      }
      
      // Échange le code contre les tokens
      const oauth2Client = new google.auth.OAuth2(
        oauthConfig.google.clientId,
        oauthConfig.google.clientSecret,
        oauthConfig.google.redirectUri
      );
      
      const { tokens } = await oauth2Client.getToken(code);

      console.log('📧 Tokens Gmail reçus pour tenant:', tenantId);

      // Vérifier si le tenant existe
      const { data: existingTenant } = await supabaseService.supabase
        .from('tenants')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (!existingTenant) {
        // Créer le tenant s'il n'existe pas (upsert)
        console.log('📝 Création du tenant...');
        const { error: insertError } = await supabaseService.supabase
          .from('tenants')
          .upsert([{
            tenant_id: tenantId,
            company_name: `Company ${tenantId}`,
            email_provider: 'gmail',
            email_oauth_tokens: tokens
          }]);

        if (insertError) {
          console.error('❌ Erreur création tenant:', insertError);
          throw new Error(`Erreur Supabase: ${insertError.message}`);
        }
      } else {
        // Mettre à jour le tenant existant
        const { error: updateError } = await supabaseService.supabase
          .from('tenants')
          .update({
            email_provider: 'gmail',
            email_oauth_tokens: tokens
          })
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error('❌ Erreur mise à jour Supabase:', updateError);
          throw new Error(`Erreur Supabase: ${updateError.message}`);
        }
      }

      console.log('✅ Tokens Gmail sauvegardés dans Supabase');

      // Créer le credential Gmail dans n8n
      console.log('🔑 Création du credential Gmail dans n8n...');
      let gmailCredential;
      try {
        gmailCredential = await n8nService.createCredential(
          'gmailOAuth2',
          `Gmail - ${tenantId}`,
          {
            serverUrl: "",
            clientId: oauthConfig.google.clientId,
            clientSecret: oauthConfig.google.clientSecret,
            sendAdditionalBodyProperties: false,
            additionalBodyProperties: {},
            oauthTokenData: tokens
          }
        );

        console.log(`✅ Credential Gmail créé: ${gmailCredential.id}`);

        // Sauvegarder l'ID du credential dans Supabase
        await supabaseService.supabase
          .from('tenants')
          .update({ gmail_credential_id: gmailCredential.id })
          .eq('tenant_id', tenantId);

      } catch (credentialError) {
        console.error('⚠️  Erreur création credential:', credentialError.message);
        gmailCredential = null;
      }

      // Créer automatiquement le workflow n8n
      console.log('🤖 Création automatique du workflow n8n...');

      let workflowResult;
      try {
        workflowResult = await workflowService.createGmailWorkflow(tenantId, gmailCredential?.id);

        if (workflowResult.created) {
          console.log(`✅ Workflow créé automatiquement: ${workflowResult.workflowId}`);
        } else {
          console.log(`⚠️  Workflow existant réutilisé: ${workflowResult.workflowId}`);
        }
      } catch (workflowError) {
        console.error('⚠️  Erreur création workflow:', workflowError.message);
        // On continue même si le workflow n'a pas pu être créé
        workflowResult = { created: false, error: workflowError.message };
      }

      res.send(`
        <h1>✅ Gmail connecté avec succès !</h1>
        <p>Votre compte Gmail est maintenant connecté.</p>
        <p>✅ Tokens OAuth sauvegardés dans Supabase</p>
        ${workflowResult.created
          ? `<p>✅ Workflow n8n créé automatiquement: <strong>${workflowResult.workflowId}</strong></p>
             <p>🎉 Votre système est prêt ! Les emails seront traités automatiquement.</p>`
          : workflowResult.workflowId
            ? `<p>✅ Workflow existant: <strong>${workflowResult.workflowId}</strong></p>`
            : `<p>⚠️  Workflow non créé automatiquement. Utilisez: <code>node create-workflow-final.js ${tenantId}</code></p>`
        }
        <p>Vous pouvez fermer cette fenêtre.</p>
        <script>setTimeout(() => window.close(), 5000)</script>
      `);
      
    } catch (error) {
      console.error('Erreur Gmail callback:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new OAuthController();