const { google } = require('googleapis');
const oauthConfig = require('../config/oauth');
const supabaseService = require('./supabaseService');
const { encrypt, decrypt } = require('./calendarTokenService');
const logger = require('./logger');

class GmailTokenService {
  /**
   * Vérifie si le token est expiré
   */
  isTokenExpired(expiryDate) {
    if (!expiryDate) return true;
    // Ajoute un buffer de 5 minutes
    return Date.now() >= (expiryDate - 5 * 60 * 1000);
  }

  /**
   * Refresh l'access token en utilisant le refresh token
   */
  async refreshAccessToken(tenantId) {
    try {
      logger.info('gmail-token', `Refresh du token pour tenant: ${tenantId}`);

      // Récupérer les tokens actuels
      const { data: tenant, error } = await supabaseService.supabase
        .from('tenants')
        .select('email_oauth_tokens')
        .eq('tenant_id', tenantId)
        .single();

      if (error || !tenant || !tenant.email_oauth_tokens) {
        throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
      }

      const storedTokens = tenant.email_oauth_tokens;

      // Déchiffrer les tokens stockés
      const currentTokens = {
        ...storedTokens,
        access_token: decrypt(storedTokens.access_token),
        refresh_token: decrypt(storedTokens.refresh_token)
      };

      // Configurer OAuth2 client
      const oauth2Client = new google.auth.OAuth2(
        oauthConfig.google.clientId,
        oauthConfig.google.clientSecret,
        oauthConfig.google.redirectUri
      );

      oauth2Client.setCredentials({
        refresh_token: currentTokens.refresh_token
      });

      // Refresh le token
      const { credentials } = await oauth2Client.refreshAccessToken();

      // Chiffrer et sauvegarder les nouveaux tokens
      const tokensToStore = {
        ...storedTokens,
        access_token: encrypt(credentials.access_token),
        expiry_date: credentials.expiry_date,
        token_type: credentials.token_type || 'Bearer'
      };

      // Sauvegarder dans Supabase (chiffré)
      const { error: updateError } = await supabaseService.supabase
        .from('tenants')
        .update({ email_oauth_tokens: tokensToStore })
        .eq('tenant_id', tenantId);

      if (updateError) {
        throw new Error(`Erreur sauvegarde tokens: ${updateError.message}`);
      }

      logger.info('gmail-token', `Token refreshe pour tenant: ${tenantId}`);

      return credentials.access_token;

    } catch (error) {
      logger.error('gmail-token', `Erreur refresh token pour ${tenantId}`, error.message);
      throw error;
    }
  }

  /**
   * Récupère un access token valide (refresh si nécessaire)
   */
  async getValidAccessToken(tenantId) {
    try {
      // Récupérer les tokens
      const { data: tenant } = await supabaseService.supabase
        .from('tenants')
        .select('email_oauth_tokens')
        .eq('tenant_id', tenantId)
        .single();

      if (!tenant || !tenant.email_oauth_tokens) {
        throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
      }

      const storedTokens = tenant.email_oauth_tokens;

      // Vérifier si le token est expiré
      if (this.isTokenExpired(storedTokens.expiry_date)) {
        logger.warn('gmail-token', `Token expire pour ${tenantId}, refresh...`);
        return await this.refreshAccessToken(tenantId);
      }

      logger.info('gmail-token', `Token valide pour ${tenantId}`);
      return decrypt(storedTokens.access_token);

    } catch (error) {
      logger.error('gmail-token', `Erreur getValidAccessToken pour ${tenantId}`, error.message);
      throw error;
    }
  }

  /**
   * Endpoint HTTP pour que n8n puisse récupérer un token valide
   * Usage dans n8n: GET http://localhost:3000/api/gmail/token/:tenantId
   */
  async getTokenForWorkflow(tenantId) {
    const accessToken = await this.getValidAccessToken(tenantId);
    return {
      access_token: accessToken,
      tenant_id: tenantId,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new GmailTokenService();
