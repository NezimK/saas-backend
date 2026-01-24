/**
 * Routes d'authentification pour le dashboard
 * Login, logout, refresh token, infos utilisateur
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const supabaseService = require('../services/supabaseService');
const { authMiddleware } = require('../middlewares/authMiddleware');

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
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        tenant_id: user.tenant_id,
        agency: user.tenant_id, // Compatibilité avec le dashboard existant
        agencyName: user.tenants?.company_name || 'Mon Agence'
      },
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes en secondes
    });
  } catch (error) {
    console.error('Erreur login:', error);
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
    console.error('Erreur refresh:', error);
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
    console.error('Erreur logout:', error);
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
        id: user.id,
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        tenant_id: user.tenant_id,
        agency: user.tenant_id,
        agencyName: user.tenants?.company_name || 'Mon Agence'
      }
    });
  } catch (error) {
    console.error('Erreur /me:', error);
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
    console.error('Erreur change-password:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
});

module.exports = router;
