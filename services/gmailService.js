const { google } = require('googleapis');
const oauthConfig = require('../config/oauth');

class GmailService {
  /**
   * Créer un client OAuth2 avec les tokens d'un tenant
   */
  createGmailClient(tokens) {
    const oauth2Client = new google.auth.OAuth2(
      oauthConfig.google.clientId,
      oauthConfig.google.clientSecret,
      oauthConfig.google.redirectUri
    );

    oauth2Client.setCredentials(tokens);
    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * Récupérer les emails de sources spécifiques
   */
  async getEmailsFromSources(tokens, sources = ['canva']) {
    const gmail = this.createGmailClient(tokens);

    // Mapping des sources vers leurs domaines
    const sourceQueries = {
      'canva': 'from:*@canva.com',
      'leboncoin': 'from:*@leboncoin.fr',
      'seloger': 'from:*@seloger.com OR from:*@seloger.fr'
    };

    // Construire les queries basées sur les sources demandées
    const queries = sources.map(source => sourceQueries[source]).filter(Boolean);

    const allEmails = [];

    for (const query of queries) {
      try {
        console.log(`🔍 Recherche: ${query}`);

        // Rechercher les emails avec le filtre
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: query,
          maxResults: 10 // Limité à 10 pour le test
        });

        const messages = response.data.messages || [];
        console.log(`   Trouvé: ${messages.length} email(s)`);

        // Récupérer les détails de chaque email
        for (const message of messages) {
          const details = await gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full'
          });

          const email = this.parseEmail(details.data);
          allEmails.push(email);
        }
      } catch (error) {
        console.error(`❌ Erreur recherche ${query}:`, error.message);
      }
    }

    return allEmails;
  }

  /**
   * Parser un email Gmail en format simple
   */
  parseEmail(message) {
    const headers = message.payload.headers;
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header ? header.value : '';
    };

    // Extraire le corps de l'email
    let body = '';
    if (message.payload.parts) {
      // Email multipart
      const textPart = message.payload.parts.find(p => p.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    } else if (message.payload.body.data) {
      // Email simple
      body = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }

    return {
      id: message.id,
      threadId: message.threadId,
      from: getHeader('From'),
      to: getHeader('To'),
      subject: getHeader('Subject'),
      date: getHeader('Date'),
      body: body.substring(0, 500) // Limité à 500 caractères pour l'aperçu
    };
  }

  /**
   * Configurer un watch sur Gmail pour recevoir des notifications
   * Cela permet d'être notifié en temps réel des nouveaux emails
   */
  async setupGmailWatch(tokens, webhookUrl) {
    const gmail = this.createGmailClient(tokens);

    try {
      const response = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          topicName: 'projects/YOUR_PROJECT_ID/topics/gmail-notifications',
          labelIds: ['INBOX']
        }
      });

      console.log('✅ Gmail watch configuré:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erreur setup watch:', error.message);
      throw error;
    }
  }
}

module.exports = new GmailService();
