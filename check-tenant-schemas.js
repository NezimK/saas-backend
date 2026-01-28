require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function checkSchemas() {
  console.log('🔍 Vérification des schémas PostgreSQL créés...\n');

  try {
    // Récupérer tous les schémas qui commencent par "tenant_"
    const sql = `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name LIKE 'tenant_%'
      ORDER BY schema_name;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Erreur:', error.message);
      process.exit(1);
    }

    console.log('📊 Schémas tenant trouvés:');

    // Alternative: utiliser une requête SELECT directe
    const { data: schemas, error: err } = await supabase
      .from('pg_catalog.pg_namespace')
      .select('nspname')
      .like('nspname', 'tenant_%');

    if (err) {
      console.log('⚠️  Impossible de lire pg_catalog, vérification manuelle nécessaire');
    }

    // Récupérer les tenants de la base
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('tenant_id, company_name, email, leads_table_name, biens_table_name')
      .order('created_at', { ascending: false })
      .limit(5);

    if (tenantError) {
      console.error('❌ Erreur lecture tenants:', tenantError.message);
      process.exit(1);
    }

    console.log('\n📋 Derniers tenants créés:\n');
    tenants.forEach(t => {
      const schemaName = 'tenant_' + t.tenant_id.replace(/-/g, '');
      console.log(`Tenant: ${t.company_name || t.email}`);
      console.log(`  tenant_id: ${t.tenant_id}`);
      console.log(`  Schéma attendu: ${schemaName}`);
      console.log(`  leads_table_name: ${t.leads_table_name || '❌ NON DÉFINI'}`);
      console.log(`  biens_table_name: ${t.biens_table_name || '❌ NON DÉFINI'}`);
      console.log('');
    });

    // Pour vérifier si les tables existent vraiment
    console.log('\n🔍 Test d\'accès aux tables du dernier tenant...');
    const lastTenant = tenants[0];
    if (lastTenant.leads_table_name) {
      console.log(`\n📊 Test lecture de: ${lastTenant.leads_table_name}`);

      // Essayer de lire la table leads
      const checkTableSQL = `
        SELECT COUNT(*) as count
        FROM ${lastTenant.leads_table_name};
      `;

      const { data: count, error: countErr } = await supabase.rpc('exec_sql', { sql_query: checkTableSQL });

      if (countErr) {
        console.error('❌ La table n\'existe pas:', countErr.message);
      } else {
        console.log('✅ Table accessible!');
      }
    } else {
      console.log('⚠️  Aucun nom de table défini, les tables n\'ont probablement pas été créées');
    }

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

checkSchemas();
