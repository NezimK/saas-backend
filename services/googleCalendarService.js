/**
 * Service Google Calendar OAuth et API
 * Gère l'authentification OAuth2 et les opérations sur le calendrier
 */

const { google } = require('googleapis');
const crypto = require('crypto');
const calendarTokenService = require('./calendarTokenService');
const logger = require('./logger');

// Secret pour signer le state OAuth (protection CSRF)
const STATE_SECRET = process.env.STATE_SECRET || 'default-state-secret-change-me-in-production';

/**
 * Créer un client OAuth2 Google
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Crée un state OAuth signé avec HMAC pour prévenir les attaques CSRF
 * @param {Object} data - Les données à inclure dans le state
 * @returns {string} Le state encodé et signé en base64
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
 * @returns {Object} Les données décodées
 * @throws {Error} Si la signature est invalide ou le state a expiré
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
    logger.error('google-calendar', 'State verification failed', error.message);
    throw new Error('Invalid OAuth state');
  }
}

/**
 * Générer l'URL d'autorisation Google OAuth
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userEmail - Email de l'utilisateur
 * @param {string} agency - ID du tenant/agence
 */
function getAuthUrl(userId, userEmail, agency) {
  const oauth2Client = getOAuth2Client();

  const scopes = ['https://www.googleapis.com/auth/calendar.events'];

  // Utiliser un state signé pour protection CSRF
  const state = createSignedState({ userId, userEmail, agency });

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: state,
    prompt: 'consent' // Force consent pour obtenir refresh token
  });
}

/**
 * Échanger le code d'autorisation contre des tokens
 * @param {string} code - Code d'autorisation Google
 */
async function exchangeCodeForTokens(code) {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Rafraîchir le token d'accès si expiré
 * @param {string} userId - ID de l'utilisateur
 */
async function refreshAccessToken(userId) {
  const userTokens = await calendarTokenService.getUserTokens(userId, 'google');

  if (!userTokens) {
    throw new Error('No tokens found for user');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: userTokens.refresh_token
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  // Sauvegarder les nouveaux tokens
  await calendarTokenService.saveUserTokens(
    userId,
    userTokens.user_email,
    {
      access_token: credentials.access_token,
      refresh_token: credentials.refresh_token || userTokens.refresh_token,
      expiry_date: credentials.expiry_date
    },
    'google'
  );

  return credentials;
}

/**
 * Obtenir un token d'accès valide (rafraîchit si nécessaire)
 * @param {string} userId - ID de l'utilisateur
 */
async function getValidAccessToken(userId) {
  const userTokens = await calendarTokenService.getUserTokens(userId, 'google');

  if (!userTokens) {
    throw new Error('User not authenticated with Google Calendar');
  }

  const now = Date.now();

  // Si le token expire dans moins de 5 minutes, le rafraîchir
  if (userTokens.expiry_date < now + 5 * 60 * 1000) {
    const newTokens = await refreshAccessToken(userId);
    return newTokens.access_token;
  }

  return userTokens.access_token;
}

/**
 * Créer un événement dans Google Calendar
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} eventDetails - Détails de l'événement
 */
async function createCalendarEvent(userId, eventDetails) {
  try {
    const accessToken = await getValidAccessToken(userId);

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: eventDetails.title,
      description: eventDetails.description,
      location: eventDetails.location || '',
      start: {
        dateTime: eventDetails.startDateTime,
        timeZone: 'Europe/Paris',
      },
      end: {
        dateTime: eventDetails.endDateTime,
        timeZone: 'Europe/Paris',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 1440 }, // 24 heures
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    };
  } catch (error) {
    logger.error('google-calendar', 'Error creating calendar event', error.message);
    throw error;
  }
}

/**
 * Mettre à jour un événement Google Calendar existant
 * @param {string} userId - ID de l'utilisateur
 * @param {string} eventId - ID de l'événement à modifier
 * @param {Object} eventDetails - Nouveaux détails de l'événement
 */
async function updateCalendarEvent(userId, eventId, eventDetails) {
  try {
    const accessToken = await getValidAccessToken(userId);

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const event = {
      summary: eventDetails.title,
      description: eventDetails.description,
      location: eventDetails.location || '',
      start: {
        dateTime: eventDetails.startDateTime,
        timeZone: 'Europe/Paris',
      },
      end: {
        dateTime: eventDetails.endDateTime,
        timeZone: 'Europe/Paris',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 1440 },
        ],
      },
    };

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: event,
    });

    return {
      success: true,
      eventId: response.data.id,
      eventLink: response.data.htmlLink
    };
  } catch (error) {
    logger.error('google-calendar', 'Error updating calendar event', error.message);
    throw error;
  }
}

/**
 * Supprimer un événement de Google Calendar
 * @param {string} userId - ID de l'utilisateur
 * @param {string} eventId - ID de l'événement
 */
async function deleteCalendarEvent(userId, eventId) {
  try {
    const accessToken = await getValidAccessToken(userId);

    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token: accessToken });

    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });

    return { success: true };
  } catch (error) {
    logger.error('google-calendar', 'Error deleting calendar event', error.message);
    throw error;
  }
}

module.exports = {
  getOAuth2Client,
  getAuthUrl,
  exchangeCodeForTokens,
  verifySignedState,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getValidAccessToken
};
