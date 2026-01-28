/**
 * Service d'authentification pour le dashboard
 * Gère le hashing des mots de passe, les JWT et la validation des utilisateurs
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const supabaseService = require('./supabaseService');

class AuthService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.JWT_EXPIRES_IN = '15m'; // Access token court
    this.REFRESH_TOKEN_EXPIRES_DAYS = 7;
  }

  /**
   * Hash un mot de passe avec bcrypt
   */
  async hashPassword(password) {
    return bcrypt.hash(password, 12);
  }

  /**
   * Vérifie un mot de passe contre son hash
   */
  async verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Génère un access token JWT
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        role: user.role,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
      },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  /**
   * Génère un refresh token et le stocke en base
   */
  async generateRefreshToken(userId) {
    const token = crypto.randomBytes(64).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await supabaseService.supabase
      .from('refresh_tokens')
      .insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString()
      });

    if (error) {
      console.error('Erreur création refresh token:', error);
      throw new Error('Impossible de créer le refresh token');
    }

    return token;
  }

  /**
   * Vérifie et décode un access token
   */
  verifyAccessToken(token) {
    return jwt.verify(token, this.JWT_SECRET);
  }

  /**
   * Valide les credentials d'un utilisateur
   */
  async validateUser(email, password) {
    const { data: user, error } = await supabaseService.supabase
      .from('users')
      .select('*, tenants(company_name)')
      .eq('email', email.toLowerCase())
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return null;
    }

    // Mettre à jour last_login
    await supabaseService.supabase
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    return user;
  }

  /**
   * Crée un nouvel utilisateur
   */
  async createUser(tenantId, userData) {
    const passwordHash = await this.hashPassword(userData.password);

    const { data, error } = await supabaseService.supabase
      .from('users')
      .insert({
        tenant_id: tenantId,
        email: userData.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: userData.firstName || null,
        last_name: userData.lastName || null,
        role: userData.role || 'agent'
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur création utilisateur:', error);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Valide et rotate un refresh token
   */
  async rotateRefreshToken(refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Chercher le token en base
    const { data: tokenRecord, error: findError } = await supabaseService.supabase
      .from('refresh_tokens')
      .select('*, users(*)')
      .eq('token_hash', tokenHash)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (findError || !tokenRecord) {
      return null;
    }

    // Vérifier que l'utilisateur est toujours actif
    if (!tokenRecord.users || !tokenRecord.users.is_active) {
      return null;
    }

    // Révoquer l'ancien token
    await supabaseService.supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // Générer de nouveaux tokens
    const user = tokenRecord.users;
    const accessToken = this.generateAccessToken(user);
    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken,
      newRefreshToken,
      user
    };
  }

  /**
   * Révoque un refresh token
   */
  async revokeRefreshToken(refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const { error } = await supabaseService.supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_hash', tokenHash);

    return !error;
  }

  /**
   * Révoque tous les refresh tokens d'un utilisateur (logout complet)
   */
  async revokeAllUserTokens(userId) {
    const { error } = await supabaseService.supabase
      .from('refresh_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);

    return !error;
  }

  /**
   * Génère un mot de passe temporaire
   */
  generateTemporaryPassword(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  /**
   * Récupère un utilisateur par son ID
   */
  async getUserById(userId) {
    const { data, error } = await supabaseService.supabase
      .from('users')
      .select('*, tenants(company_name)')
      .eq('id', userId)
      .eq('is_active', true)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Met à jour le mot de passe d'un utilisateur
   */
  async updatePassword(userId, newPassword) {
    const passwordHash = await this.hashPassword(newPassword);

    const { error } = await supabaseService.supabase
      .from('users')
      .update({ password_hash: passwordHash })
      .eq('id', userId);

    if (error) {
      throw new Error('Impossible de mettre à jour le mot de passe');
    }

    // Révoquer tous les refresh tokens existants
    await this.revokeAllUserTokens(userId);

    return true;
  }

  /**
   * Crée un utilisateur SANS mot de passe (pour magic link)
   * L'utilisateur devra définir son mot de passe via set-password
   */
  async createUserWithoutPassword(tenantId, userData) {
    const { data, error } = await supabaseService.supabase
      .from('users')
      .insert({
        tenant_id: tenantId,
        email: userData.email.toLowerCase(),
        password_hash: null, // Pas de mot de passe initial
        first_name: userData.firstName || userData.companyName || null,
        last_name: userData.lastName || null,
        role: userData.role || 'manager',
        requires_password_setup: true
      })
      .select()
      .single();

    if (error) {
      console.error('Erreur création utilisateur sans password:', error);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Génère un token temporaire pour la page set-password
   * Valide 30 minutes
   */
  generateSetupToken(userId) {
    return jwt.sign(
      { userId, purpose: 'password_setup' },
      this.JWT_SECRET,
      { expiresIn: '30m' }
    );
  }

  /**
   * Vérifie un setup token et retourne le userId
   */
  verifySetupToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET);
      if (decoded.purpose !== 'password_setup') {
        return null;
      }
      return decoded.userId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Définit le mot de passe initial d'un utilisateur (après magic link)
   */
  async setInitialPassword(userId, password) {
    const passwordHash = await this.hashPassword(password);

    const { error } = await supabaseService.supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        requires_password_setup: false
      })
      .eq('id', userId);

    if (error) {
      throw new Error('Impossible de définir le mot de passe');
    }

    return true;
  }

  /**
   * Génère les tokens d'authentification pour un utilisateur
   */
  async generateTokens(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);
    return { accessToken, refreshToken };
  }
}

module.exports = new AuthService();
