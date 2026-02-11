/**
 * Routes pour Google Calendar et Outlook Calendar
 * OAuth authentication et gestion des événements
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const googleCalendarService = require('../services/googleCalendarService');
const outlookCalendarService = require('../services/outlookCalendarService');
const calendarTokenService = require('../services/calendarTokenService');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logger = require('../services/logger');

// Load HTML templates once at startup
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const successTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'oauth-success.html'), 'utf8');
const errorTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'oauth-error.html'), 'utf8');

// =============================================================================
// GOOGLE CALENDAR ROUTES
// =============================================================================

/**
 * POST /api/auth/google/url
 * Obtenir l'URL d'authentification Google OAuth2
 */
router.post('/auth/google/url', authMiddleware, (req, res) => {
  try {
    const userId = req.user.userId;
    const { userEmail, agency } = req.body;

    if (!userEmail || !agency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const authUrl = googleCalendarService.getAuthUrl(userId, userEmail, agency);

    res.json({ authUrl });
  } catch (error) {
    logger.error('calendar', 'Error generating Google auth URL', error.message);
    res.status(500).json({ error: 'Failed to generate auth URL' });
  }
});

/**
 * GET /api/auth/google/callback
 * Callback OAuth Google - reçoit le code et enregistre les tokens
 */
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing authorization code or state');
    }

    // Vérifier et décoder le state signé (protection CSRF)
    let userId, userEmail, agency;
    try {
      const stateData = googleCalendarService.verifySignedState(state);
      userId = stateData.userId;
      userEmail = stateData.userEmail;
      agency = stateData.agency;
    } catch (stateError) {
      logger.warn('calendar', 'Invalid Google OAuth state', stateError.message);
      return res.status(400).send('Invalid or expired OAuth state. Please try again.');
    }

    // Échanger le code contre des tokens
    const tokens = await googleCalendarService.exchangeCodeForTokens(code);

    // Sauvegarder les tokens dans Supabase
    await calendarTokenService.saveUserTokens(userId, userEmail, tokens, 'google');

    // Page de succès
    res.send(getSuccessPage('Google Calendar', '#C5A065'));
  } catch (error) {
    logger.error('calendar', 'Error in Google OAuth callback', error.message);
    res.status(500).send(getErrorPage('Google Calendar'));
  }
});

/**
 * POST /api/auth/google/status
 * Vérifier si Google Calendar est connecté
 */
router.post('/auth/google/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const tokens = await calendarTokenService.getUserTokens(userId, 'google');

    res.json({ connected: !!tokens });
  } catch (error) {
    logger.error('calendar', 'Error checking Google connection status', error.message);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

/**
 * POST /api/auth/google/disconnect
 * Déconnecter Google Calendar
 */
router.post('/auth/google/disconnect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    await calendarTokenService.deleteUserTokens(userId, 'google');

    res.json({ success: true });
  } catch (error) {
    logger.error('calendar', 'Error disconnecting Google', error.message);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// =============================================================================
// OUTLOOK CALENDAR ROUTES
// =============================================================================

/**
 * POST /api/auth/outlook/url
 * Obtenir l'URL d'authentification Outlook OAuth2
 */
router.post('/auth/outlook/url', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userEmail, agency } = req.body;

    if (!userEmail || !agency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const authUrl = await outlookCalendarService.getOutlookAuthUrl(userId, userEmail, agency);

    res.json({ authUrl });
  } catch (error) {
    logger.error('calendar', 'Error generating Outlook auth URL', error.message);
    res.status(500).json({ error: 'Failed to generate Outlook auth URL' });
  }
});

/**
 * GET /api/auth/outlook/callback
 * Callback OAuth Outlook - reçoit le code et enregistre les tokens
 */
router.get('/auth/outlook/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing authorization code or state');
    }

    // Vérifier et décoder le state signé (protection CSRF)
    let userId, userEmail, agency;
    try {
      const stateData = outlookCalendarService.verifySignedState(state);
      userId = stateData.userId;
      userEmail = stateData.userEmail;
      agency = stateData.agency;
    } catch (stateError) {
      logger.warn('calendar', 'Invalid Outlook OAuth state', stateError.message);
      return res.status(400).send('Invalid or expired OAuth state. Please try again.');
    }

    // Échanger le code contre des tokens
    const tokens = await outlookCalendarService.exchangeCodeForTokens(code);

    // Sauvegarder les tokens dans Supabase
    await calendarTokenService.saveUserTokens(userId, userEmail, tokens, 'outlook');

    // Page de succès
    res.send(getSuccessPage('Outlook Calendar', '#0078D4'));
  } catch (error) {
    logger.error('calendar', 'Error in Outlook OAuth callback', error.message);
    res.status(500).send(getErrorPage('Outlook Calendar'));
  }
});

/**
 * POST /api/auth/outlook/status
 * Vérifier si Outlook Calendar est connecté
 */
router.post('/auth/outlook/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const tokens = await calendarTokenService.getUserTokens(userId, 'outlook');

    res.json({ connected: !!tokens });
  } catch (error) {
    logger.error('calendar', 'Error checking Outlook connection status', error.message);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

/**
 * POST /api/auth/outlook/disconnect
 * Déconnecter Outlook Calendar
 */
router.post('/auth/outlook/disconnect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    await calendarTokenService.deleteUserTokens(userId, 'outlook');

    res.json({ success: true });
  } catch (error) {
    logger.error('calendar', 'Error disconnecting Outlook', error.message);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

// =============================================================================
// UNIFIED CALENDAR STATUS
// =============================================================================

/**
 * POST /api/auth/calendar/status
 * Vérifier le statut de tous les calendriers connectés
 */
router.post('/auth/calendar/status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const providers = await calendarTokenService.getConnectedProviders(userId);

    res.json(providers);
  } catch (error) {
    logger.error('calendar', 'Error checking calendar status', error.message);
    res.status(500).json({ error: 'Failed to check calendar status' });
  }
});

// =============================================================================
// CALENDAR EVENTS (Protected by JWT)
// =============================================================================

/**
 * POST /api/calendar/event
 * Créer un événement Google Calendar
 */
router.post('/calendar/event', authMiddleware, async (req, res) => {
  try {
    const { eventDetails } = req.body;
    const userId = req.user.userId;

    if (!userId || !eventDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await googleCalendarService.createCalendarEvent(userId, eventDetails);

    res.json(result);
  } catch (error) {
    logger.error('calendar', 'Error creating Google event', error.message);
    res.status(500).json({ error: 'Failed to create calendar event', message: error.message });
  }
});

/**
 * POST /api/calendar/event/update
 * Mettre à jour un événement Google Calendar
 */
router.post('/calendar/event/update', authMiddleware, async (req, res) => {
  try {
    const { eventId, eventDetails } = req.body;
    const userId = req.user.userId;

    if (!userId || !eventId || !eventDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await googleCalendarService.updateCalendarEvent(userId, eventId, eventDetails);

    res.json(result);
  } catch (error) {
    logger.error('calendar', 'Error updating Google event', error.message);
    res.status(500).json({ error: 'Failed to update calendar event', message: error.message });
  }
});

/**
 * POST /api/calendar/event/delete
 * Supprimer un événement Google Calendar
 */
router.post('/calendar/event/delete', authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.userId;

    if (!userId || !eventId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await googleCalendarService.deleteCalendarEvent(userId, eventId);

    res.json(result);
  } catch (error) {
    logger.error('calendar', 'Error deleting Google event', error.message);
    res.status(500).json({ error: 'Failed to delete calendar event', message: error.message });
  }
});

/**
 * POST /api/calendar/outlook/event
 * Créer un événement Outlook Calendar
 */
router.post('/calendar/outlook/event', authMiddleware, async (req, res) => {
  try {
    const { eventDetails } = req.body;
    const userId = req.user.userId;

    if (!userId || !eventDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await outlookCalendarService.createCalendarEvent(userId, eventDetails);

    res.json(result);
  } catch (error) {
    logger.error('calendar', 'Error creating Outlook event', error.message);
    res.status(500).json({ error: 'Failed to create Outlook calendar event', message: error.message });
  }
});

/**
 * POST /api/calendar/outlook/event/update
 * Mettre à jour un événement Outlook Calendar
 */
router.post('/calendar/outlook/event/update', authMiddleware, async (req, res) => {
  try {
    const { eventId, eventDetails } = req.body;
    const userId = req.user.userId;

    if (!userId || !eventId || !eventDetails) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await outlookCalendarService.updateCalendarEvent(userId, eventId, eventDetails);

    res.json(result);
  } catch (error) {
    logger.error('calendar', 'Error updating Outlook event', error.message);
    res.status(500).json({ error: 'Failed to update Outlook calendar event', message: error.message });
  }
});

/**
 * POST /api/calendar/outlook/event/delete
 * Supprimer un événement Outlook Calendar
 */
router.post('/calendar/outlook/event/delete', authMiddleware, async (req, res) => {
  try {
    const { eventId } = req.body;
    const userId = req.user.userId;

    if (!userId || !eventId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await outlookCalendarService.deleteCalendarEvent(userId, eventId);

    res.json(result);
  } catch (error) {
    logger.error('calendar', 'Error deleting Outlook event', error.message);
    res.status(500).json({ error: 'Failed to delete Outlook calendar event', message: error.message });
  }
});

// =============================================================================
// HELPER FUNCTIONS - Success/Error Pages
// =============================================================================

const ALLOWED_SERVICES = ['Google Calendar', 'Outlook Calendar'];
const ALLOWED_COLORS = { '#C5A065': 'black', '#0078D4': 'white' };

function sanitizeServiceName(name) {
  return ALLOWED_SERVICES.includes(name) ? name : 'Calendar';
}

function getSuccessPage(serviceName, accentColor) {
  const safeName = sanitizeServiceName(serviceName);
  const safeColor = Object.keys(ALLOWED_COLORS).includes(accentColor) ? accentColor : '#C5A065';
  const iconColor = ALLOWED_COLORS[safeColor];
  return successTemplate
    .replace(/\{\{ACCENT_COLOR\}\}/g, safeColor)
    .replace(/\{\{ICON_COLOR\}\}/g, iconColor)
    .replace(/\{\{SERVICE_NAME\}\}/g, safeName);
}

function getErrorPage(serviceName) {
  const safeName = sanitizeServiceName(serviceName);
  return errorTemplate.replace(/\{\{SERVICE_NAME\}\}/g, safeName);
}

module.exports = router;
