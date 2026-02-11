/**
 * Routes d'authentification pour le dashboard
 * Login, logout, refresh token, infos utilisateur
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const supabaseService = require('../services/supabaseService');
const magicLinkService = require('../services/magicLinkService');
const emailService = require('../services/emailService');
const { authMiddleware } = require('../middlewares/authMiddleware');
const logger = require('../services/logger');

/**
 * POST /api/auth/login
 * Authentifie un utilisateur et retourne les tokens
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email et mot de passe requis'
      });
    }

    const user = await authService.validateUser(email, password);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Email ou mot de passe incorrect'
      });
    }

    const accessToken = authService.generateAccessToken(user);
    const refreshToken = await authService.generateRefreshToken(user.id);

    res.json({
      success: true,
      user: authService.formatUserResponse(user),
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes en secondes
    });
  } catch (error) {
    logger.error('auth', 'Erreur login', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/refresh
 * Renouvelle l'access token avec un refresh token valide
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token requis'
      });
    }

    const result = await authService.rotateRefreshToken(refreshToken);
    if (!result) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token invalide ou expiré',
        code: 'REFRESH_TOKEN_INVALID'
      });
    }

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.newRefreshToken,
      expiresIn: 900
    });
  } catch (error) {
    logger.error('auth', 'Erreur refresh', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/logout
 * Révoque le refresh token
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    logger.error('auth', 'Erreur logout', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * GET /api/auth/me
 * Retourne les informations de l'utilisateur connecté
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await authService.getUserById(req.user.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      user: {
        ...authService.formatUserResponse(user),
        notification_settings: user.notification_settings || null
      }
    });
  } catch (error) {
    logger.error('auth', 'Erreur /me', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change le mot de passe de l'utilisateur connecté
 */
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Mot de passe actuel et nouveau mot de passe requis'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Le nouveau mot de passe doit faire au moins 8 caractères'
      });
    }

    // Vérifier le mot de passe actuel
    const user = await authService.getUserById(req.user.userId);
    const { data: fullUser } = await supabaseService.supabase
      .from('users')
      .select('password_hash')
      .eq('id', req.user.userId)
      .single();

    const isValid = await authService.verifyPassword(currentPassword, fullUser.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Mot de passe actuel incorrect'
      });
    }

    await authService.updatePassword(req.user.userId, newPassword);

    res.json({
      success: true,
      message: 'Mot de passe mis à jour. Veuillez vous reconnecter.'
    });
  } catch (error) {
    logger.error('auth', 'Erreur change-password', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/verify-magic-link
 * Vérifie un magic link et retourne un setup token
 */
router.post('/verify-magic-link', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token requis'
      });
    }

    const user = await magicLinkService.validateMagicLink(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Lien invalide ou expiré. Veuillez contacter le support.'
      });
    }

    // Générer un token temporaire pour la page set-password
    const setupToken = authService.generateSetupToken(user.id);

    res.json({
      success: true,
      user: {
        email: user.email,
        name: user.first_name || user.email,
        tenantId: user.tenant_id
      },
      setupToken
    });
  } catch (error) {
    logger.error('auth', 'Erreur verify-magic-link', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/set-password
 * Définit le mot de passe initial après le magic link
 */
router.post('/set-password', async (req, res) => {
  try {
    const { setupToken, password, magicLinkToken } = req.body;

    if (!setupToken || !password) {
      return res.status(400).json({
        success: false,
        error: 'Setup token et mot de passe requis'
      });
    }

    // Validation du mot de passe
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Le mot de passe doit faire au moins 8 caractères'
      });
    }

    // Vérifier le setup token
    const userId = authService.verifySetupToken(setupToken);
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'Session expirée. Veuillez utiliser à nouveau le lien reçu par email.'
      });
    }

    // Définir le mot de passe
    await authService.setInitialPassword(userId, password);

    // Marquer le magic link comme utilisé APRÈS la création du mot de passe
    if (magicLinkToken) {
      await magicLinkService.markMagicLinkAsUsed(magicLinkToken);
    }

    // Récupérer l'utilisateur complet
    const user = await authService.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Générer les tokens d'authentification
    const { accessToken, refreshToken } = await authService.generateTokens(user);

    // Générer le token d'onboarding pour protéger les endpoints post-paiement
    const onboardingToken = authService.generateOnboardingToken(user.tenant_id);

    res.json({
      success: true,
      message: 'Mot de passe défini avec succès',
      user: authService.formatUserResponse(user),
      accessToken,
      refreshToken,
      onboardingToken,
      expiresIn: 900,
      redirectUrl: `/onboarding.html?tenantId=${user.tenant_id}`
    });
  } catch (error) {
    logger.error('auth', 'Erreur set-password', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Envoie un email de réinitialisation de mot de passe
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email requis'
      });
    }

    // Chercher l'utilisateur
    const { data: user, error: userError } = await supabaseService.supabase
      .from('users')
      .select('id, email, first_name')
      .eq('email', email.toLowerCase().trim())
      .single();

    // Toujours retourner success pour éviter l'énumération d'utilisateurs
    if (userError || !user) {
      logger.info('auth', `Forgot password: email not found`);
      return res.json({
        success: true,
        message: 'Si cet email existe, un lien de réinitialisation a été envoyé'
      });
    }

    // Générer le magic link pour reset
    const resetLink = await magicLinkService.generateMagicLink(user.id);
    // Remplacer set-password par reset-password dans l'URL
    const resetPasswordLink = resetLink.replace('set-password.html', 'reset-password.html');

    // Envoyer l'email
    const emailResult = await emailService.sendPasswordResetEmail(
      user.email,
      resetPasswordLink,
      user.first_name || ''
    );

    if (!emailResult.success) {
      logger.error('auth', 'Erreur envoi email reset', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'envoi de l\'email'
      });
    }

    logger.info('auth', 'Email reset password envoyé');
    res.json({
      success: true,
      message: 'Si cet email existe, un lien de réinitialisation a été envoyé'
    });

  } catch (error) {
    logger.error('auth', 'Erreur forgot-password', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Réinitialise le mot de passe avec un token valide
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        error: 'Token et mot de passe requis'
      });
    }

    // Validation du mot de passe
    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Le mot de passe doit faire au moins 8 caractères'
      });
    }

    // Valider le magic link
    const user = await magicLinkService.validateMagicLink(token);
    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Lien invalide ou expiré. Veuillez demander un nouveau lien.'
      });
    }

    // Mettre à jour le mot de passe
    await authService.updatePassword(user.id, password);

    // Marquer le magic link comme utilisé
    await magicLinkService.markMagicLinkAsUsed(token);

    // Générer les tokens d'authentification
    const accessToken = authService.generateAccessToken(user);
    const refreshToken = await authService.generateRefreshToken(user.id);

    logger.info('auth', `Mot de passe réinitialisé pour ${user.email}`);
    res.json({
      success: true,
      message: 'Mot de passe mis à jour avec succès',
      user: authService.formatUserResponse(user),
      accessToken,
      refreshToken,
      expiresIn: 900
    });

  } catch (error) {
    logger.error('auth', 'Erreur reset-password', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
