/**
 * Script pour réinitialiser le mot de passe d'un utilisateur
 * Usage: node scripts/reset-password.js <email> <nouveau_mot_de_passe>
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
);

async function resetPassword(email, newPassword) {
  if (!email || !newPassword) {
    console.log('Usage: node scripts/reset-password.js <email> <nouveau_mot_de_passe>');
    console.log('Exemple: node scripts/reset-password.js test@agence.com MonMotDePasse123');
    process.exit(1);
  }

  console.log(`🔄 Réinitialisation du mot de passe pour: ${email}`);

  // Hasher le nouveau mot de passe
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Mettre à jour en base
  const { data, error } = await supabase
    .from('users')
    .update({ password_hash: passwordHash })
    .eq('email', email.toLowerCase())
    .select('id, email, role')
    .single();

  if (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }

  if (!data) {
    console.error('❌ Utilisateur non trouvé avec cet email');
    process.exit(1);
  }

  console.log('✅ Mot de passe réinitialisé avec succès!');
  console.log(`   Email: ${data.email}`);
  console.log(`   Rôle: ${data.role}`);
  console.log(`   Nouveau mot de passe: ${newPassword}`);
}

const [,, email, password] = process.argv;
resetPassword(email, password);
