require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function runMigrations() {
  console.log('🚀 Exécution des migrations...\n');

  const migrations = [
    'migrations/add-workflow-ids-columns.sql',
    'migrations/add-table-reference-columns.sql'
  ];

  for (const migrationFile of migrations) {
    console.log(`📝 Migration: ${migrationFile}`);

    try {
      const sql = fs.readFileSync(migrationFile, 'utf8');

      const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

      if (error) {
        console.error(`❌ Erreur: ${error.message}`);
        continue;
      }

      console.log(`✅ Migration appliquée avec succès\n`);
    } catch (err) {
      console.error(`❌ Erreur lecture fichier: ${err.message}\n`);
    }
  }

  console.log('✅ Toutes les migrations terminées!');
}

runMigrations();
