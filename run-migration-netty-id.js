/**
 * Script pour exécuter la migration add-netty-id-column.sql
 */
require('dotenv').config();
const supabaseService = require('./services/supabaseService');

async function runMigration() {
  console.log('🚀 Exécution de la migration: add-netty-id-column.sql\n');

  try {
    // 1. Ajouter la colonne netty_id
    console.log('1️⃣ Ajout de la colonne netty_id...');
    await supabaseService.executeRawSQL(`
      ALTER TABLE public.biens
      ADD COLUMN IF NOT EXISTS netty_id VARCHAR(255)
    `);
    console.log('   ✅ Colonne netty_id ajoutée\n');

    // 2. Créer l'index unique pour upsert
    console.log('2️⃣ Création de l\'index unique (netty_id, tenant_id)...');
    await supabaseService.executeRawSQL(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_biens_netty_id_tenant_id
      ON public.biens(netty_id, tenant_id)
      WHERE netty_id IS NOT NULL
    `);
    console.log('   ✅ Index unique créé\n');

    // 3. Créer l'index simple
    console.log('3️⃣ Création de l\'index simple netty_id...');
    await supabaseService.executeRawSQL(`
      CREATE INDEX IF NOT EXISTS idx_biens_netty_id
      ON public.biens(netty_id)
      WHERE netty_id IS NOT NULL
    `);
    console.log('   ✅ Index simple créé\n');

    // 4. Vérifier la structure
    console.log('4️⃣ Vérification de la structure...');
    const columns = await supabaseService.executeRawSQL(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'biens'
      AND column_name = 'netty_id'
    `);
    console.log('   Résultat:', columns);

    console.log('\n✅ Migration terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

runMigration();
