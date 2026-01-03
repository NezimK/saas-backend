const { google } = require('googleapis');
const oauthConfig = require('../config/oauth');
const supabaseService = require('./supabaseService');

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
      console.log(`🔄 Refresh du token pour tenant: ${tenantId}`);

      // Récupérer les tokens actuels
      const { data: tenant, error } = await supabaseService.supabase
        .from('tenants')
        .select('email_oauth_tokens')
        .eq('tenant_id', tenantId)
        .single();

      if (error || !tenant || !tenant.email_oauth_tokens) {
        throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
      }

      const currentTokens = tenant.email_oauth_tokens;

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

      // Nouveaux tokens
      const newTokens = {
        ...currentTokens,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date,
        token_type: credentials.token_type || 'Bearer'
      };

      // Sauvegarder dans Supabase
      const { error: updateError } = await supabaseService.supabase
        .from('tenants')
        .update({ email_oauth_tokens: newTokens })
        .eq('tenant_id', tenantId);

      if (updateError) {
        throw new Error(`Erreur sauvegarde tokens: ${updateError.message}`);
      }

      console.log(`✅ Token refreshé pour tenant: ${tenantId}`);
      console.log(`   Nouveau expiry: ${new Date(credentials.expiry_date).toISOString()}`);

      return newTokens.access_token;

    } catch (error) {
      console.error(`❌ Erreur refresh token pour ${tenantId}:`, error.message);
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

      const tokens = tenant.email_oauth_tokens;

      // Vérifier si le token est expiré
      if (this.isTokenExpired(tokens.expiry_date)) {
        console.log(`⚠️  Token expiré pour ${tenantId}, refresh...`);
        return await this.refreshAccessToken(tenantId);
      }

      console.log(`✅ Token valide pour ${tenantId}`);
      return tokens.access_token;

    } catch (error) {
      console.error(`❌ Erreur getValidAccessToken pour ${tenantId}:`, error.message);
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
