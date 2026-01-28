require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function runMigration() {
  console.log('🚀 Ajout de la colonne nom_agence à la table biens...\n');

  try {
    const sql = fs.readFileSync('migrations/add-nom-agence-column.sql', 'utf8');

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error(`❌ Erreur: ${error.message}`);
      process.exit(1);
    }

    console.log('✅ Colonne nom_agence ajoutée avec succès!');
    console.log('📊 La table biens contient maintenant le champ nom_agence (VARCHAR 255)');
    console.log('🔄 Trigger créé: nom_agence sera rempli automatiquement depuis tenants.company_name');
    console.log('📝 Les biens existants ont été mis à jour avec le nom de leur agence');
  } catch (err) {
    console.error(`❌ Erreur: ${err.message}`);
    process.exit(1);
  }
}

runMigration();
