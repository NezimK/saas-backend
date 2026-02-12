const { google } = require('googleapis');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const crypto = require('crypto');
const oauthConfig = require('../config/oauth');
const supabaseService = require('../services/supabaseService');
const workflowService = require('../services/workflowService');
const n8nService = require('../services/n8nService');
const logger = require('../services/logger');

const STATE_SECRET = process.env.STATE_SECRET;
if (!STATE_SECRET) throw new Error('FATAL: STATE_SECRET environment variable is required');

class OAuthController {
  // ================== MSAL Helpers pour Outlook ==================

  getMsalConfig() {
    return {
      auth: {
        clientId: oauthConfig.microsoft.clientId,
        clientSecret: oauthConfig.microsoft.clientSecret,
        authority: `https://login.microsoftonline.com/${oauthConfig.microsoft.tenantId}`,
      },
    };
  }

  getMsalClient() {
    return new ConfidentialClientApplication(this.getMsalConfig());
  }

  createSignedState(data) {
    const timestamp = Date.now();
    const dataWithTimestamp = JSON.stringify({ ...data, timestamp });
    const signature = crypto
      .createHmac('sha256', STATE_SECRET)
      .update(dataWithTimestamp)
      .digest('hex');
    return Buffer.from(JSON.stringify({
      payload: dataWithTimestamp,
      signature
    })).toString('base64');
  }

  verifySignedState(state) {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
    const expectedSignature = crypto
      .createHmac('sha256', STATE_SECRET)
      .update(decoded.payload)
      .digest('hex');
    if (expectedSignature !== decoded.signature) {
      throw new Error('Invalid state signature');
    }
    const data = JSON.parse(decoded.payload);
    // Vérifier expiration (5 minutes)
    if (Date.now() - data.timestamp > 5 * 60 * 1000) {
      throw new Error('State expired');
    }
    return data;
  }

  // ================== Gmail OAuth ==================

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

    const signedState = this.createSignedState({ tenantId, provider: 'gmail' });

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: oauthConfig.google.scopes,
      state: signedState,
      prompt: 'consent' // Force le refresh_token
    });

    // Redirige directement vers Google
    res.redirect(authUrl);
  }
  
  // Callback Gmail après autorisation
  async handleGmailCallback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({ error: 'Code ou state manquant' });
      }

      // Vérifier et décoder le state signé (protection CSRF)
      let tenantId;
      try {
        const stateData = this.verifySignedState(state);
        tenantId = stateData.tenantId;
      } catch (stateError) {
        logger.warn('oauth', 'Invalid Gmail OAuth state', stateError.message);
        return res.status(400).json({ error: 'State OAuth invalide ou expiré. Veuillez réessayer.' });
      }
      
      // Échange le code contre les tokens
      const oauth2Client = new google.auth.OAuth2(
        oauthConfig.google.clientId,
        oauthConfig.google.clientSecret,
        oauthConfig.google.redirectUri
      );
      
      const { tokens } = await oauth2Client.getToken(code);

      logger.info('oauth', 'Tokens Gmail recus pour tenant: ' + tenantId);

      // Vérifier si le tenant existe
      const { data: existingTenant } = await supabaseService.supabase
        .from('tenants')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (!existingTenant) {
        // Créer le tenant s'il n'existe pas (upsert)
        logger.info('oauth', 'Creation du tenant...');
        const { error: insertError } = await supabaseService.supabase
          .from('tenants')
          .upsert([{
            tenant_id: tenantId,
            company_name: `Company ${tenantId}`,
            email_provider: 'gmail',
            email_oauth_tokens: tokens
          }]);

        if (insertError) {
          logger.error('oauth', 'Erreur creation tenant', insertError.message);
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
          logger.error('oauth', 'Erreur mise a jour Supabase', updateError.message);
          throw new Error(`Erreur Supabase: ${updateError.message}`);
        }
      }

      logger.info('oauth', 'Tokens Gmail sauvegardes dans Supabase');

      // Créer le credential Gmail dans n8n
      logger.info('oauth', 'Creation du credential Gmail dans n8n...');
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

        logger.info('oauth', `Credential Gmail cree: ${gmailCredential.id}`);

        // Sauvegarder l'ID du credential dans Supabase
        await supabaseService.supabase
          .from('tenants')
          .update({ gmail_credential_id: gmailCredential.id })
          .eq('tenant_id', tenantId);

      } catch (credentialError) {
        logger.error('oauth', 'Erreur creation credential Gmail', credentialError.message);
        gmailCredential = null;
      }

      // Créer automatiquement les 3 workflows n8n
      logger.info('oauth', 'Creation automatique des workflows n8n...');

      let workflowResult;
      try {
        workflowResult = await workflowService.createGmailWorkflow(tenantId, gmailCredential?.id);

        if (workflowResult.created) {
          logger.info('oauth', `Workflows crees automatiquement: Email Parser: ${workflowResult.emailParser}, Bot Qualification: ${workflowResult.botQualification}, Response Dashboard: ${workflowResult.responseDashboard}`);
        } else {
          logger.warn('oauth', `Workflows existants reutilises: ${workflowResult.emailParser}`);
        }
      } catch (workflowError) {
        logger.error('oauth', 'Erreur creation workflows Gmail', workflowError.message);
        // On continue même si les workflows n'ont pas pu être créés
        workflowResult = { created: false, error: workflowError.message };
      }

      // Rediriger vers l'onboarding avec le flag gmail_success
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      res.redirect(`${backendUrl}/onboarding.html?tenantId=${tenantId}&gmail_success=true`);
      
    } catch (error) {
      logger.error('oauth', 'Erreur Gmail callback', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  // ================== Outlook OAuth ==================

  // Générer l'URL de connexion Outlook
  async getOutlookAuthUrl(req, res) {
    const { tenantId } = req.query;

    if (!tenantId) {
      return res.status(400).send(`
        <h1>Erreur</h1>
        <p>Le parametre <code>tenantId</code> est requis.</p>
        <p>Exemple : <code>/auth/outlook/connect?tenantId=test-tenant-001</code></p>
      `);
    }

    try {
      const msalClient = this.getMsalClient();
      const state = this.createSignedState({ tenantId, provider: 'outlook' });

      const authCodeUrlParameters = {
        scopes: oauthConfig.microsoft.scopes,
        redirectUri: oauthConfig.microsoft.redirectUri,
        state: state,
        prompt: 'consent',
      };

      const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParameters);
      res.redirect(authUrl);
    } catch (error) {
      logger.error('oauth', 'Erreur generation URL Outlook', error.message);
      res.status(500).json({ error: error.message });
    }
  }

  // Callback Outlook après autorisation
  async handleOutlookCallback(req, res) {
    try {
      const { code, state } = req.query;

      if (!code || !state) {
        return res.status(400).json({ error: 'Code ou state manquant' });
      }

      // Vérifier le state (protection CSRF)
      const stateData = this.verifySignedState(state);
      const tenantId = stateData.tenantId;

      // Échanger le code contre des tokens via appel HTTP direct
      // (MSAL cache le refresh_token en interne, on a besoin du vrai token pour n8n)
      const axios = require('axios');
      const tokenEndpoint = `https://login.microsoftonline.com/${oauthConfig.microsoft.tenantId}/oauth2/v2.0/token`;

      const params = new URLSearchParams({
        client_id: oauthConfig.microsoft.clientId,
        client_secret: oauthConfig.microsoft.clientSecret,
        code: code,
        redirect_uri: oauthConfig.microsoft.redirectUri,
        grant_type: 'authorization_code',
        scope: oauthConfig.microsoft.scopes.join(' '),
      });

      const tokenResponse = await axios.post(tokenEndpoint, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      const tokens = {
        access_token: tokenResponse.data.access_token,
        refresh_token: tokenResponse.data.refresh_token,
        token_type: tokenResponse.data.token_type,
        expires_in: tokenResponse.data.expires_in,
        scope: tokenResponse.data.scope,
        id_token: tokenResponse.data.id_token,
      };

      logger.info('oauth', 'Tokens Outlook recus pour tenant: ' + tenantId);

      // Vérifier si le tenant existe
      const { data: existingTenant } = await supabaseService.supabase
        .from('tenants')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (!existingTenant) {
        // Créer le tenant s'il n'existe pas (upsert)
        logger.info('oauth', 'Creation du tenant...');
        const { error: insertError } = await supabaseService.supabase
          .from('tenants')
          .upsert([{
            tenant_id: tenantId,
            company_name: `Company ${tenantId}`,
            email_provider: 'outlook',
            email_oauth_tokens: tokens
          }]);

        if (insertError) {
          logger.error('oauth', 'Erreur creation tenant', insertError.message);
          throw new Error(`Erreur Supabase: ${insertError.message}`);
        }
      } else {
        // Mettre à jour le tenant existant
        const { error: updateError } = await supabaseService.supabase
          .from('tenants')
          .update({
            email_provider: 'outlook',
            email_oauth_tokens: tokens
          })
          .eq('tenant_id', tenantId);

        if (updateError) {
          logger.error('oauth', 'Erreur mise a jour Supabase', updateError.message);
          throw new Error(`Erreur Supabase: ${updateError.message}`);
        }
      }

      logger.info('oauth', 'Tokens Outlook sauvegardes dans Supabase');

      // Créer le credential Outlook dans n8n
      logger.info('oauth', 'Creation du credential Outlook dans n8n...');
      let outlookCredential;
      try {
        outlookCredential = await n8nService.createCredential(
          'microsoftOutlookOAuth2Api',
          `Outlook - ${tenantId}`,
          {
            serverUrl: '',
            authUrl: `https://login.microsoftonline.com/${oauthConfig.microsoft.tenantId}/oauth2/v2.0/authorize`,
            accessTokenUrl: `https://login.microsoftonline.com/${oauthConfig.microsoft.tenantId}/oauth2/v2.0/token`,
            clientId: oauthConfig.microsoft.clientId,
            clientSecret: oauthConfig.microsoft.clientSecret,
            sendAdditionalBodyProperties: false,
            additionalBodyProperties: {},
            userPrincipalName: '',
            oauthTokenData: tokens
          }
        );

        logger.info('oauth', `Credential Outlook cree: ${outlookCredential.id}`);

        // Sauvegarder l'ID du credential dans Supabase
        await supabaseService.supabase
          .from('tenants')
          .update({ outlook_credential_id: outlookCredential.id })
          .eq('tenant_id', tenantId);

      } catch (credentialError) {
        logger.error('oauth', 'Erreur creation credential Outlook', credentialError.message);
        outlookCredential = null;
      }

      // Créer automatiquement les workflows n8n pour Outlook
      logger.info('oauth', 'Creation automatique des workflows n8n Outlook...');

      let workflowResult;
      try {
        workflowResult = await workflowService.createEmailWorkflow(tenantId, outlookCredential?.id, 'outlook');

        if (workflowResult.created) {
          logger.info('oauth', 'Workflow Email Parser Outlook cree');
        }
      } catch (workflowError) {
        logger.error('oauth', 'Erreur creation workflows Outlook', workflowError.message);
        workflowResult = { created: false, error: workflowError.message };
      }

      // Rediriger vers l'onboarding avec le flag outlook_success
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
      res.redirect(`${backendUrl}/onboarding.html?tenantId=${tenantId}&outlook_success=true`);

    } catch (error) {
      logger.error('oauth', 'Erreur Outlook callback', error.message);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new OAuthController();