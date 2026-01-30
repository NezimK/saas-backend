/**
 * Service Outlook Calendar OAuth et API
 * Gère l'authentification Microsoft OAuth2 et les opérations sur le calendrier via Graph API
 */

const { ConfidentialClientApplication } = require('@azure/msal-node');
const { Client } = require('@microsoft/microsoft-graph-client');
const crypto = require('crypto');
const calendarTokenService = require('./calendarTokenService');

// Secret pour signer le state OAuth (protection CSRF)
const STATE_SECRET = process.env.STATE_SECRET || 'default-state-secret-change-me-in-production';

// Scopes pour Microsoft Graph API
const SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'Calendars.ReadWrite',
];

/**
 * Configuration MSAL
 */
function getMsalConfig() {
  return {
    auth: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID || 'common'}`,
    },
  };
}

/**
 * Créer un client MSAL
 */
function getMsalClient() {
  return new ConfidentialClientApplication(getMsalConfig());
}

/**
 * Crée un state OAuth signé avec HMAC pour prévenir les attaques CSRF
 * @param {Object} data - Les données à inclure dans le state
 */
function createSignedState(data) {
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

/**
 * Vérifie et décode un state OAuth signé
 * @param {string} state - Le state encodé en base64
 */
function verifySignedState(state) {
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64').toString());

    const expectedSignature = crypto
      .createHmac('sha256', STATE_SECRET)
      .update(decoded.payload)
      .digest('hex');

    if (expectedSignature !== decoded.signature) {
      throw new Error('Invalid state signature - possible CSRF attack');
    }

    const data = JSON.parse(decoded.payload);

    // Vérifier que le state n'a pas expiré (10 minutes max)
    const MAX_STATE_AGE = 10 * 60 * 1000;
    if (Date.now() - data.timestamp > MAX_STATE_AGE) {
      throw new Error('State expired');
    }

    return data;
  } catch (error) {
    console.error('Outlook state verification failed:', error.message);
    throw new Error('Invalid OAuth state');
  }
}

/**
 * Générer l'URL d'autorisation Outlook OAuth
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userEmail - Email de l'utilisateur
 * @param {string} agency - ID du tenant/agence
 */
async function getOutlookAuthUrl(userId, userEmail, agency) {
  const msalClient = getMsalClient();

  // Utiliser un state signé pour protection CSRF
  const state = createSignedState({ userId, userEmail, agency, provider: 'outlook' });

  const authCodeUrlParameters = {
    scopes: SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
    state: state,
    prompt: 'consent',
  };

  return msalClient.getAuthCodeUrl(authCodeUrlParameters);
}

/**
 * Échanger le code d'autorisation contre des tokens
 * @param {string} code - Code d'autorisation Microsoft
 */
async function exchangeCodeForTokens(code) {
  const msalClient = getMsalClient();

  const tokenRequest = {
    code: code,
    scopes: SCOPES,
    redirectUri: process.env.MICROSOFT_REDIRECT_URI,
  };

  const response = await msalClient.acquireTokenByCode(tokenRequest);

  return {
    access_token: response.accessToken,
    refresh_token: response.account ? response.account.homeAccountId : null,
    expiry_date: response.expiresOn ? new Date(response.expiresOn).getTime() : Date.now() + 3600000,
    id_token: response.idToken,
    account: response.account,
  };
}

/**
 * Obtenir un client Graph avec un token valide
 * @param {string} userId - ID de l'utilisateur
 */
async function getGraphClient(userId) {
  const userTokens = await calendarTokenService.getUserTokens(userId, 'outlook');

  if (!userTokens) {
    throw new Error('User not authenticated with Outlook Calendar');
  }

  // Vérifier si le token est expiré et rafraîchir si nécessaire
  const now = Date.now();
  let accessToken = userTokens.access_token;

  if (userTokens.expiry_date < now + 5 * 60 * 1000) {
    // Token expiré ou va expirer, le rafraîchir
    accessToken = await refreshOutlookToken(userId, userTokens);
  }

  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Rafraîchir le token Outlook
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} userTokens - Tokens actuels
 */
async function refreshOutlookToken(userId, userTokens) {
  const msalClient = getMsalClient();

  try {
    const silentRequest = {
      scopes: SCOPES,
      account: userTokens.account,
    };

    const response = await msalClient.acquireTokenSilent(silentRequest);

    // Sauvegarder les nouveaux tokens
    await calendarTokenService.saveUserTokens(
      userId,
      userTokens.user_email,
      {
        access_token: response.accessToken,
        refresh_token: userTokens.refresh_token,
        expiry_date: response.expiresOn ? new Date(response.expiresOn).getTime() : Date.now() + 3600000,
        account: response.account,
      },
      'outlook'
    );

    return response.accessToken;
  } catch (error) {
    console.error('Error refreshing Outlook token:', error);
    throw new Error('Failed to refresh Outlook token. Please reconnect.');
  }
}

/**
 * Créer un événement dans Outlook Calendar
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} eventDetails - Détails de l'événement
 */
async function createCalendarEvent(userId, eventDetails) {
  try {
    const client = await getGraphClient(userId);

    const event = {
      subject: eventDetails.title,
      body: {
        contentType: 'HTML',
        content: eventDetails.description || '',
      },
      start: {
        dateTime: eventDetails.startDateTime,
        timeZone: 'Europe/Paris',
      },
      end: {
        dateTime: eventDetails.endDateTime,
        timeZone: 'Europe/Paris',
      },
      reminderMinutesBeforeStart: 30,
      isReminderOn: true,
    };

    const response = await client.api('/me/events').post(event);

    return {
      success: true,
      eventId: response.id,
      eventLink: response.webLink,
    };
  } catch (error) {
    console.error('Error creating Outlook calendar event:', error);
    throw error;
  }
}

/**
 * Supprimer un événement de Outlook Calendar
 * @param {string} userId - ID de l'utilisateur
 * @param {string} eventId - ID de l'événement
 */
async function deleteCalendarEvent(userId, eventId) {
  try {
    const client = await getGraphClient(userId);

    await client.api(`/me/events/${eventId}`).delete();

    return { success: true };
  } catch (error) {
    console.error('Error deleting Outlook calendar event:', error);
    throw error;
  }
}

module.exports = {
  getOutlookAuthUrl,
  exchangeCodeForTokens,
  verifySignedState,
  createCalendarEvent,
  deleteCalendarEvent,
  getGraphClient
};
