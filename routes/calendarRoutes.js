/**
 * Routes pour Google Calendar et Outlook Calendar
 * OAuth authentication et gestion des événements
 */

const express = require('express');
const router = express.Router();

const googleCalendarService = require('../services/googleCalendarService');
const outlookCalendarService = require('../services/outlookCalendarService');
const calendarTokenService = require('../services/calendarTokenService');
const { authMiddleware } = require('../middlewares/authMiddleware');

// =============================================================================
// GOOGLE CALENDAR ROUTES
// =============================================================================

/**
 * POST /api/auth/google/url
 * Obtenir l'URL d'authentification Google OAuth2
 */
router.post('/auth/google/url', (req, res) => {
  try {
    const { userId, userEmail, agency } = req.body;

    if (!userId || !userEmail || !agency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const authUrl = googleCalendarService.getAuthUrl(userId, userEmail, agency);

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
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
      console.error('Invalid OAuth state:', stateError.message);
      return res.status(400).send('Invalid or expired OAuth state. Please try again.');
    }

    // Échanger le code contre des tokens
    const tokens = await googleCalendarService.exchangeCodeForTokens(code);

    // Sauvegarder les tokens dans Supabase
    await calendarTokenService.saveUserTokens(userId, userEmail, tokens, 'google');

    // Page de succès
    res.send(getSuccessPage('Google Calendar', '#C5A065'));
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    res.status(500).send(getErrorPage('Google Calendar'));
  }
});

/**
 * POST /api/auth/google/status
 * Vérifier si Google Calendar est connecté
 */
router.post('/auth/google/status', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const tokens = await calendarTokenService.getUserTokens(userId, 'google');

    res.json({ connected: !!tokens });
  } catch (error) {
    console.error('Error checking Google connection status:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

/**
 * POST /api/auth/google/disconnect
 * Déconnecter Google Calendar
 */
router.post('/auth/google/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    await calendarTokenService.deleteUserTokens(userId, 'google');

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google:', error);
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
router.post('/auth/outlook/url', async (req, res) => {
  try {
    const { userId, userEmail, agency } = req.body;

    if (!userId || !userEmail || !agency) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const authUrl = await outlookCalendarService.getOutlookAuthUrl(userId, userEmail, agency);

    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating Outlook auth URL:', error);
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
      console.error('Invalid Outlook OAuth state:', stateError.message);
      return res.status(400).send('Invalid or expired OAuth state. Please try again.');
    }

    // Échanger le code contre des tokens
    const tokens = await outlookCalendarService.exchangeCodeForTokens(code);

    // Sauvegarder les tokens dans Supabase
    await calendarTokenService.saveUserTokens(userId, userEmail, tokens, 'outlook');

    // Page de succès
    res.send(getSuccessPage('Outlook Calendar', '#0078D4'));
  } catch (error) {
    console.error('Error in Outlook OAuth callback:', error);
    res.status(500).send(getErrorPage('Outlook Calendar'));
  }
});

/**
 * POST /api/auth/outlook/status
 * Vérifier si Outlook Calendar est connecté
 */
router.post('/auth/outlook/status', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const tokens = await calendarTokenService.getUserTokens(userId, 'outlook');

    res.json({ connected: !!tokens });
  } catch (error) {
    console.error('Error checking Outlook connection status:', error);
    res.status(500).json({ error: 'Failed to check connection status' });
  }
});

/**
 * POST /api/auth/outlook/disconnect
 * Déconnecter Outlook Calendar
 */
router.post('/auth/outlook/disconnect', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    await calendarTokenService.deleteUserTokens(userId, 'outlook');

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Outlook:', error);
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
router.post('/auth/calendar/status', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const providers = await calendarTokenService.getConnectedProviders(userId);

    res.json(providers);
  } catch (error) {
    console.error('Error checking calendar status:', error);
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
    console.error('Error creating Google event:', error);
    res.status(500).json({ error: 'Failed to create calendar event', message: error.message });
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
    console.error('Error deleting Google event:', error);
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
    console.error('Error creating Outlook event:', error);
    res.status(500).json({ error: 'Failed to create Outlook calendar event', message: error.message });
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
    console.error('Error deleting Outlook event:', error);
    res.status(500).json({ error: 'Failed to delete Outlook calendar event', message: error.message });
  }
});

// =============================================================================
// HELPER FUNCTIONS - Success/Error Pages
// =============================================================================

function getSuccessPage(serviceName, accentColor) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Connexion réussie</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #0F0F0F;
          }
          .container {
            background: #1A1A1A;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            text-align: center;
            max-width: 400px;
            border: 1px solid rgba(197, 160, 101, 0.2);
          }
          .success-icon {
            width: 70px;
            height: 70px;
            background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            color: ${accentColor === '#0078D4' ? 'white' : 'black'};
            font-size: 36px;
            font-weight: bold;
            box-shadow: 0 4px 20px ${accentColor}33;
          }
          h1 { color: #FFFFFF; margin: 0 0 12px; font-size: 26px; font-weight: bold; }
          p { color: #9CA3AF; margin: 0 0 20px; line-height: 1.6; }
          .highlight { color: ${accentColor}; font-weight: 600; }
          .button {
            background: linear-gradient(135deg, ${accentColor} 0%, ${accentColor}dd 100%);
            color: ${accentColor === '#0078D4' ? 'white' : 'black'};
            border: none;
            padding: 14px 28px;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            box-shadow: 0 4px 12px ${accentColor}22;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px ${accentColor}44;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="success-icon">✓</div>
          <h1>Connexion réussie !</h1>
          <p>Votre <span class="highlight">${serviceName}</span> a été connecté avec succès.</p>
          <p style="font-size: 14px; color: #6B7280;">Cette fenêtre va se fermer automatiquement...</p>
          <button class="button" onclick="window.close()">Fermer</button>
        </div>
        <script>
          setTimeout(() => { window.close(); }, 3000);
        </script>
      </body>
    </html>
  `;
}

function getErrorPage(serviceName) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Erreur de connexion</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #f87171 0%, #dc2626 100%);
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
            max-width: 400px;
          }
          .error-icon {
            width: 60px;
            height: 60px;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            color: white;
            font-size: 30px;
          }
          h1 { color: #1f2937; margin: 0 0 10px; font-size: 24px; }
          p { color: #6b7280; margin: 0 0 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error-icon">✕</div>
          <h1>Erreur de connexion</h1>
          <p>Une erreur s'est produite lors de la connexion à ${serviceName}.</p>
          <p style="font-size: 14px;">Veuillez réessayer.</p>
        </div>
      </body>
    </html>
  `;
}

module.exports = router;
