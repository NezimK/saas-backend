/**
 * Service de gestion des tokens OAuth pour les calendriers
 * Stockage dans Supabase avec chiffrement AES-256
 */

const crypto = require('crypto');
const supabaseService = require('./supabaseService');

// =============================================================================
// CHIFFREMENT AES-256
// =============================================================================

// Clé de chiffrement (doit être 32 bytes = 64 caractères hex)
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
const IV_LENGTH = 16;

/**
 * Chiffre une chaîne avec AES-256-CBC
 * @param {string} text - Texte à chiffrer
 * @returns {string} Texte chiffré au format "iv:encrypted" en hex
 */
function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error.message);
    return text;
  }
}

/**
 * Déchiffre une chaîne chiffrée avec AES-256-CBC
 * @param {string} text - Texte chiffré au format "iv:encrypted"
 * @returns {string} Texte déchiffré
 */
function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const [ivHex, encryptedHex] = text.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY, 'hex'),
      iv
    );
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return text;
  }
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Sauvegarder ou mettre à jour les tokens d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} userEmail - Email utilisé pour l'auth OAuth
 * @param {Object} tokens - Tokens OAuth
 * @param {string} provider - 'google' ou 'outlook'
 */
async function saveUserTokens(userId, userEmail, tokens, provider = 'google') {
  const encryptedAccessToken = encrypt(tokens.access_token);
  const encryptedRefreshToken = encrypt(tokens.refresh_token);

  const tokenData = {
    user_id: userId,
    provider: provider,
    access_token: encryptedAccessToken,
    refresh_token: encryptedRefreshToken,
    expiry_date: tokens.expiry_date,
    account: tokens.account || null,
    user_email: userEmail,
    updated_at: new Date().toISOString()
  };

  // Upsert: insert ou update si existe déjà
  const { data, error } = await supabaseService.supabase
    .from('calendar_tokens')
    .upsert(tokenData, {
      onConflict: 'user_id,provider',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving calendar tokens:', error);
    throw new Error(`Failed to save tokens: ${error.message}`);
  }

  return data;
}

/**
 * Récupérer les tokens d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} provider - 'google' ou 'outlook'
 * @returns {Object|null} Tokens déchiffrés ou null si non trouvé
 */
async function getUserTokens(userId, provider = 'google') {
  const { data, error } = await supabaseService.supabase
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // Pas de résultat trouvé
      return null;
    }
    console.error('Error getting calendar tokens:', error);
    return null;
  }

  if (!data) return null;

  // Déchiffrer les tokens avant de les retourner
  return {
    ...data,
    access_token: decrypt(data.access_token),
    refresh_token: decrypt(data.refresh_token)
  };
}

/**
 * Supprimer les tokens d'un utilisateur (déconnexion)
 * @param {string} userId - ID de l'utilisateur
 * @param {string} provider - 'google' ou 'outlook'
 */
async function deleteUserTokens(userId, provider = 'google') {
  const { error } = await supabaseService.supabase
    .from('calendar_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);

  if (error) {
    console.error('Error deleting calendar tokens:', error);
    throw new Error(`Failed to delete tokens: ${error.message}`);
  }

  return true;
}

/**
 * Vérifier quels calendriers sont connectés pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object} { google: boolean, outlook: boolean }
 */
async function getConnectedProviders(userId) {
  const { data, error } = await supabaseService.supabase
    .from('calendar_tokens')
    .select('provider')
    .eq('user_id', userId);

  if (error) {
    console.error('Error checking connected providers:', error);
    return { google: false, outlook: false };
  }

  const providers = data.map(row => row.provider);
  return {
    google: providers.includes('google'),
    outlook: providers.includes('outlook')
  };
}

module.exports = {
  saveUserTokens,
  getUserTokens,
  deleteUserTokens,
  getConnectedProviders,
  encrypt,
  decrypt
};
