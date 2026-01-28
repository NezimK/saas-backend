require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testExecSQL() {
  console.log('🧪 Test de la fonction RPC exec_sql...');
  console.log('📍 Supabase URL:', process.env.SUPABASE_URL);

  try {
    // Test simple: créer un schéma temporaire
    const testSQL = `
      CREATE SCHEMA IF NOT EXISTS test_schema_temp;
      DROP SCHEMA IF EXISTS test_schema_temp CASCADE;
    `;

    console.log('\n📤 Exécution SQL de test...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: testSQL });

    if (error) {
      console.error('\n❌ ERREUR RPC:');
      console.error('Message:', error.message);
      console.error('Code:', error.code);
      console.error('Details:', error.details);
      console.error('Hint:', error.hint);
      console.error('\n⚠️  La fonction exec_sql n\'existe probablement pas dans Supabase!');
      console.error('📝 Créez-la avec le fichier: migrations/create-exec-sql-function.sql');
      process.exit(1);
    }

    console.log('\n✅ Fonction RPC exec_sql fonctionne!');
    console.log('Résultat:', data);
    console.log('\n🎉 Les tables peuvent maintenant être créées!');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ Erreur inattendue:', err.message);
    process.exit(1);
  }
}

testExecSQL();
