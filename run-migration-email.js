/**
 * Script pour exécuter la migration de la colonne email
 * Usage: node run-migration-email.js
 */

require('dotenv').config();
const supabaseService = require('./services/supabaseService');

async function runMigration() {
  console.log('🔧 Exécution de la migration: ajout colonne email...');

  try {
    // Vérifier d'abord si la colonne existe déjà
    const { data: testData, error: testError } = await supabaseService.supabase
      .from('tenants')
      .select('email')
      .limit(1);

    if (!testError) {
      console.log('✅ La colonne email existe déjà !');
      console.log('📊 Test de récupération réussi');
      return;
    }

    if (testError.code !== '42703') {
      // 42703 = column does not exist
      console.error('❌ Erreur inattendue:', testError);
      return;
    }

    console.log('📝 La colonne email n\'existe pas encore');
    console.log('⚠️  Pour ajouter la colonne, vous devez exécuter cette requête SQL dans Supabase:');
    console.log('');
    console.log('--- Copiez le SQL ci-dessous dans l\'éditeur SQL de Supabase ---');
    console.log('');
    console.log('ALTER TABLE tenants');
    console.log('ADD COLUMN IF NOT EXISTS email VARCHAR(255);');
    console.log('');
    console.log('CREATE UNIQUE INDEX IF NOT EXISTS tenants_email_unique');
    console.log('ON tenants(email)');
    console.log('WHERE email IS NOT NULL;');
    console.log('');
    console.log('COMMENT ON COLUMN tenants.email IS \'Email unique du client pour identifier le tenant\';');
    console.log('');
    console.log('--- Fin du SQL ---');
    console.log('');
    console.log('📍 Accédez à votre dashboard Supabase:');
    console.log('   https://supabase.com/dashboard/project/yptvhkmkmjasronywviq/sql/new');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

runMigration();
