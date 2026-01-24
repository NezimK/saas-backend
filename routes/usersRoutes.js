/**
 * Routes de gestion des utilisateurs
 * CRUD utilisateurs avec contrôle d'accès par rôle
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const authService = require('../services/authService');
const supabaseService = require('../services/supabaseService');

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
      .select('id, email, first_name, last_name, role, is_active, last_login, created_at')
      .eq('tenant_id', req.user.tenantId)
      .order('created_at', { ascending: false });

    // Les agents ne voient qu'eux-mêmes
    if (req.user.role === 'agent') {
      query = query.eq('id', req.user.userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erreur récupération utilisateurs:', error);
      return res.status(500).json({ success: false, error: error.message });
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
      lastLogin: user.last_login,
      createdAt: user.created_at
    }));

    res.json({ success: true, users });
  } catch (error) {
    console.error('Erreur GET /api/users:', error);
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
      return res.status(500).json({ success: false, error: error.message });
    }

    const agents = data.map(user => ({
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      role: user.role
    }));

    res.json({ success: true, agents });
  } catch (error) {
    console.error('Erreur GET /api/users/agents:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/users
 * Crée un nouvel utilisateur (managers et admins uniquement)
 */
router.post('/', requireRole('manager', 'admin'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email et mot de passe requis' });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Le mot de passe doit faire au moins 8 caractères' });
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

    const user = await authService.createUser(req.user.tenantId, {
      email,
      password,
      firstName,
      lastName,
      role: userRole
    });

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
        role: user.role
      },
      message: 'Utilisateur créé avec succès'
    });
  } catch (error) {
    console.error('Erreur POST /api/users:', error);
    res.status(500).json({ success: false, error: error.message || 'Erreur serveur' });
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
      if (isActive !== undefined) updates.is_active = isActive;
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
      console.error('Erreur mise à jour utilisateur:', error);
      return res.status(500).json({ success: false, error: error.message });
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
    console.error('Erreur PUT /api/users/:id:', error);
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
      return res.status(500).json({ success: false, error: error.message });
    }

    // Révoquer tous ses tokens
    await authService.revokeAllUserTokens(id);

    res.json({ success: true, message: 'Utilisateur désactivé' });
  } catch (error) {
    console.error('Erreur DELETE /api/users/:id:', error);
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

    res.json({
      success: true,
      temporaryPassword,
      message: `Mot de passe réinitialisé pour ${targetUser.email}`
    });
  } catch (error) {
    console.error('Erreur POST /api/users/:id/reset-password:', error);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

module.exports = router;
