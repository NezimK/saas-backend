const crypto = require('crypto');
const supabaseService = require('./supabaseService');
const logger = require('./logger');

/**
 * Genere un magic link pour un utilisateur
 * @param {string} userId - L'ID de l'utilisateur
 * @returns {Promise<string>} - Le magic link complet
 */
async function generateMagicLink(userId) {
  // Generer un token aleatoire
  const token = crypto.randomBytes(32).toString('hex');

  // Hash du token pour le stockage
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Expiration dans 24 heures
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Stocker en base de donnees
  const { data, error } = await supabaseService.supabase
    .from('magic_links')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) {
    logger.error('magic-link', 'Erreur creation magic_link', error.message);
    throw new Error('Impossible de creer le magic link');
  }

  logger.info('magic-link', `Magic link cree pour user ${userId}, expire le ${expiresAt.toISOString()}`);

  // Construire l'URL complete (utilise BACKEND_URL car set-password.html est servi par le backend)
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  return `${baseUrl}/set-password.html?token=${token}`;
}

/**
 * Valide un magic link et retourne l'utilisateur associe
 * @param {string} token - Le token du magic link
 * @returns {Promise<object|null>} - L'utilisateur ou null si invalide
 */
async function validateMagicLink(token) {
  // Hash du token pour la recherche
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  // Rechercher le magic link valide
  const { data: magicLink, error: linkError } = await supabaseService.supabase
    .from('magic_links')
    .select('*')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (linkError || !magicLink) {
    logger.warn('magic-link', 'Magic link invalide ou expire');
    return null;
  }

  // Recuperer l'utilisateur
  const { data: user, error: userError } = await supabaseService.supabase
    .from('users')
    .select('*, tenants(*)')
    .eq('id', magicLink.user_id)
    .single();

  if (userError || !user) {
    logger.error('magic-link', 'Utilisateur non trouve pour le magic link');
    return null;
  }

  // NOTE: Ne pas marquer comme utilisé ici - sera fait après la création du mot de passe
  // via markMagicLinkAsUsed()

  logger.info('magic-link', `Magic link valide pour user ${user.email}`);
  return user;
}

/**
 * Marque un magic link comme utilisé (à appeler après la création du mot de passe)
 * @param {string} token - Le token du magic link
 * @returns {Promise<boolean>} - true si marqué avec succès
 */
async function markMagicLinkAsUsed(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { error } = await supabaseService.supabase
    .from('magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', tokenHash);

  if (error) {
    logger.error('magic-link', 'Erreur lors du marquage du magic link comme utilise', error.message);
    return false;
  }

  logger.info('magic-link', 'Magic link marque comme utilise');
  return true;
}

/**
 * Supprime les magic links expires (cleanup)
 */
async function cleanupExpiredLinks() {
  const { error } = await supabaseService.supabase
    .from('magic_links')
    .delete()
    .lt('expires_at', new Date().toISOString());

  if (error) {
    logger.error('magic-link', 'Erreur cleanup magic_links', error.message);
  }
}

module.exports = {
  generateMagicLink,
  validateMagicLink,
  markMagicLinkAsUsed,
  cleanupExpiredLinks
};
