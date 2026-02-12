/**
 * Routes de gestion des utilisateurs
 * CRUD utilisateurs avec contrôle d'accès par rôle
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const authService = require('../services/authService');
const supabaseService = require('../services/supabaseService');
const { sendInvitationEmail } = require('../services/emailService');
const logger = require('../services/logger');

// Toutes les routes nécessitent une authentification
router.use(authMiddleware);

/**
 * GET /api/users
 * Liste les utilisateurs du tenant
 * - Agent: ne voit que lui-même
 * - Manager/Admin: voit tous les utilisateurs du tenant
 */
router.get('/', async (req, res) => {
  try {
    let query = supabaseService.supabase
      .from('users')
      .select('id, email, first_name, last_name, role, is_active, requires_password_setup, last_login, created_at')
      .eq('tenant_id', req.user.tenantId)
      .order('created_at', { ascending: false });

    // Les agents ne voient qu'eux-mêmes
    if (req.user.role === 'agent') {
      query = query.eq('id', req.user.userId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('users', 'Erreur récupération utilisateurs', error.message);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }

    // Formater les utilisateurs pour le dashboard
    const users = data.map(user => ({
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      isActive: user.is_active,
      requiresPasswordSetup: user.requires_password_setup,
      lastLogin: user.last_login,
      createdAt: user.created_at
    }));

    res.json({ success: true, users });
  } catch (error) {
    logger.error('users', 'Erreur GET /api/users', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * GET /api/users/agents
 * Liste les agents disponibles pour l'assignation de leads
 */
router.get('/agents', async (req, res) => {
  try {
    const { data, error } = await supabaseService.supabase
      .from('users')
      .select('id, email, first_name, last_name, role')
      .eq('tenant_id', req.user.tenantId)
      .eq('is_active', true)
      .in('role', ['agent', 'manager', 'admin'])
      .order('first_name');

    if (error) {
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }

    const agents = data.map(user => ({
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      role: user.role
    }));

    res.json({ success: true, agents });
  } catch (error) {
    logger.error('users', 'Erreur GET /api/users/agents', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/users
 * Crée un nouvel utilisateur par invitation email (managers et admins uniquement)
 * L'utilisateur recevra un email avec un lien pour définir son mot de passe
 */
router.post('/', requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { email, firstName, lastName, role } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email requis' });
    }

    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'Prénom et nom requis' });
    }

    // Les managers ne peuvent créer que des agents
    const userRole = role || 'agent';
    if (req.user.role === 'manager' && userRole !== 'agent') {
      return res.status(403).json({ success: false, error: 'Les managers ne peuvent créer que des agents' });
    }

    // Vérifier que l'email n'existe pas déjà
    const { data: existing } = await supabaseService.supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (existing) {
      return res.status(409).json({ success: false, error: 'Un utilisateur avec cet email existe déjà' });
    }

    // Récupérer les infos du tenant (limite utilisateurs + nom entreprise)
    const { data: tenant, error: tenantError } = await supabaseService.supabase
      .from('tenants')
      .select('company_name, max_users, plan')
      .eq('tenant_id', req.user.tenantId)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    // Vérifier la limite max_users (-1 = illimité pour Premium)
    if (tenant.max_users !== -1) {
      const { count: activeUsersCount } = await supabaseService.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', req.user.tenantId)
        .eq('is_active', true);

      if (activeUsersCount >= tenant.max_users) {
        return res.status(403).json({
          success: false,
          error: 'Limite d\'utilisateurs atteinte pour votre plan',
          code: 'MAX_USERS_REACHED',
          usersCount: activeUsersCount,
          usersLimit: tenant.max_users,
          plan: tenant.plan
        });
      }
    }

    // Créer l'utilisateur sans mot de passe (invitation flow)
    const user = await authService.createUserWithoutPassword(req.user.tenantId, {
      email,
      firstName,
      lastName,
      role: userRole
    });

    // Générer le token d'invitation (valide 24h)
    const inviteToken = authService.generateSetupToken(user.id);

    // Construire le lien d'invitation (vers le frontend, pas le backend)
    const baseUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';
    const inviteLink = `${baseUrl}/set-password?token=${inviteToken}`;

    // Envoyer l'email d'invitation
    const emailResult = await sendInvitationEmail(
      email,
      inviteLink,
      req.user.name,
      tenant?.company_name || 'votre agence',
      firstName
    );

    if (!emailResult.success) {
      logger.warn('users', 'Email d\'invitation non envoyé', emailResult.error);
    }

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        requiresPasswordSetup: true
      },
      emailSent: emailResult.success,
      message: emailResult.success
        ? 'Invitation envoyée par email'
        : 'Utilisateur créé mais email non envoyé'
    });
  } catch (error) {
    logger.error('users', 'Erreur POST /api/users', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * PUT /api/users/:id
 * Met à jour un utilisateur
 * - Les utilisateurs peuvent modifier leur propre profil (sauf le rôle)
 * - Les managers peuvent modifier les agents de leur tenant
 * - Les admins peuvent tout modifier
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, role, isActive } = req.body;

    // Vérifier que l'utilisateur cible appartient au même tenant
    const { data: targetUser, error: findError } = await supabaseService.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .single();

    if (findError || !targetUser) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Vérifier les permissions
    const isSelf = id === req.user.userId;
    const canModifyOthers = ['manager', 'admin'].includes(req.user.role);

    if (!isSelf && !canModifyOthers) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    // Préparer les mises à jour
    const updates = {};
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (email !== undefined) updates.email = email.toLowerCase();

    // Seuls les admins/managers peuvent modifier le rôle et le statut actif (et pas pour eux-mêmes)
    if (!isSelf && canModifyOthers) {
      if (role !== undefined) {
        // Les managers ne peuvent pas créer d'autres managers ou admins
        if (req.user.role === 'manager' && ['manager', 'admin'].includes(role)) {
          return res.status(403).json({ success: false, error: 'Les managers ne peuvent pas promouvoir au rang de manager ou admin' });
        }
        updates.role = role;
      }
      if (isActive !== undefined) {
        // Vérifier la limite max_users lors de la réactivation
        if (isActive === true && !targetUser.is_active) {
          const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('max_users, plan')
            .eq('tenant_id', req.user.tenantId)
            .single();

          if (tenant && tenant.max_users !== -1) {
            const { count: activeUsersCount } = await supabaseService.supabase
              .from('users')
              .select('*', { count: 'exact', head: true })
              .eq('tenant_id', req.user.tenantId)
              .eq('is_active', true);

            if (activeUsersCount >= tenant.max_users) {
              return res.status(403).json({
                success: false,
                error: 'Limite d\'utilisateurs atteinte pour votre plan',
                code: 'MAX_USERS_REACHED',
                usersCount: activeUsersCount,
                usersLimit: tenant.max_users,
                plan: tenant.plan
              });
            }
          }
        }
        updates.is_active = isActive;
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, error: 'Aucune modification fournie' });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseService.supabase
      .from('users')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .select()
      .single();

    if (error) {
      logger.error('users', 'Erreur mise à jour utilisateur', error.message);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }

    res.json({
      success: true,
      user: {
        id: data.id,
        email: data.email,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role,
        isActive: data.is_active
      },
      message: 'Utilisateur mis à jour'
    });
  } catch (error) {
    logger.error('users', 'Erreur PUT /api/users/:id', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * DELETE /api/users/:id
 * Désactive un utilisateur (soft delete)
 * Les managers/admins uniquement, et pas pour soi-même
 */
router.delete('/:id', requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.userId) {
      return res.status(400).json({ success: false, error: 'Vous ne pouvez pas vous désactiver vous-même' });
    }

    // Vérifier que l'utilisateur cible appartient au même tenant
    const { data: targetUser } = await supabaseService.supabase
      .from('users')
      .select('role')
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .single();

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Les managers ne peuvent pas désactiver d'autres managers ou admins
    if (req.user.role === 'manager' && ['manager', 'admin'].includes(targetUser.role)) {
      return res.status(403).json({ success: false, error: 'Vous ne pouvez pas désactiver un manager ou admin' });
    }

    // Soft delete: désactiver l'utilisateur
    const { error } = await supabaseService.supabase
      .from('users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId);

    if (error) {
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }

    // Révoquer tous ses tokens
    await authService.revokeAllUserTokens(id);

    res.json({ success: true, message: 'Utilisateur désactivé' });
  } catch (error) {
    logger.error('users', 'Erreur DELETE /api/users/:id', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/users/me/update-email
 * Met à jour l'email de l'utilisateur connecté avec vérification du mot de passe
 */
router.post('/me/update-email', async (req, res) => {
  try {
    const { newEmail, password } = req.body;

    if (!newEmail || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }

    // Récupérer l'utilisateur actuel avec son hash de mot de passe
    const { data: currentUser, error: findError } = await supabaseService.supabase
      .from('users')
      .select('*')
      .eq('id', req.user.userId)
      .single();

    if (findError || !currentUser) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Vérifier le mot de passe
    const isPasswordValid = await authService.verifyPassword(password, currentUser.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
    }

    // Vérifier que le nouvel email n'est pas déjà utilisé
    const emailLower = newEmail.toLowerCase();
    const { data: existingUser } = await supabaseService.supabase
      .from('users')
      .select('id')
      .eq('email', emailLower)
      .neq('id', req.user.userId)
      .single();

    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Cet email est déjà utilisé' });
    }

    // Mettre à jour l'email dans la table users
    const { data, error } = await supabaseService.supabase
      .from('users')
      .update({ email: emailLower, updated_at: new Date().toISOString() })
      .eq('id', req.user.userId)
      .select()
      .single();

    if (error) {
      logger.error('users', 'Erreur update email', error.message);
      return res.status(500).json({ success: false, error: 'Erreur serveur' });
    }

    // Mettre à jour l'email dans la table tenants si c'est l'admin/owner du tenant
    const { error: tenantError } = await supabaseService.supabase
      .from('tenants')
      .update({ email: emailLower, updated_at: new Date().toISOString() })
      .eq('tenant_id', req.user.tenantId)
      .eq('email', currentUser.email); // Seulement si l'ancien email correspond

    if (tenantError) {
      logger.warn('users', 'Erreur mise à jour email tenant (peut être normal si pas owner)', tenantError.message);
    }

    res.json({
      success: true,
      user: {
        id: data.id,
        email: data.email,
        name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        firstName: data.first_name,
        lastName: data.last_name,
        role: data.role
      },
      message: 'Email mis à jour avec succès'
    });
  } catch (error) {
    logger.error('users', 'Erreur POST /api/users/me/update-email', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/users/:id/reset-password
 * Réinitialise le mot de passe d'un utilisateur (managers uniquement)
 */
router.post('/:id/reset-password', requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que l'utilisateur cible appartient au même tenant
    const { data: targetUser } = await supabaseService.supabase
      .from('users')
      .select('email, role')
      .eq('id', id)
      .eq('tenant_id', req.user.tenantId)
      .single();

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Utilisateur non trouvé' });
    }

    // Les managers ne peuvent pas réinitialiser le mot de passe d'autres managers ou admins
    if (req.user.role === 'manager' && ['manager', 'admin'].includes(targetUser.role)) {
      return res.status(403).json({ success: false, error: 'Accès non autorisé' });
    }

    // Générer un nouveau mot de passe temporaire
    const temporaryPassword = authService.generateTemporaryPassword();
    await authService.updatePassword(id, temporaryPassword);

    // Ne pas renvoyer le mot de passe en clair dans la réponse API
    // Le manager doit communiquer le mot de passe au collaborateur de manière sécurisée
    res.json({
      success: true,
      temporaryPassword: temporaryPassword.slice(0, 2) + '••••••••' + temporaryPassword.slice(-2),
      message: `Mot de passe réinitialisé pour ${targetUser.email}. Communiquez-le de manière sécurisée.`
    });
  } catch (error) {
    logger.error('users', 'Erreur POST /api/users/:id/reset-password', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
