require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function verifySchemas() {
  console.log('🔍 Vérification des schémas et tables PostgreSQL...\n');

  try {
    // 1. Récupérer le dernier tenant
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('tenant_id, company_name, email, leads_table_name, biens_table_name')
      .order('created_at', { ascending: false })
      .limit(1);

    if (tenantError || !tenants || tenants.length === 0) {
      console.error('❌ Aucun tenant trouvé');
      process.exit(1);
    }

    const tenant = tenants[0];
    const schemaName = 'tenant_' + tenant.tenant_id.replace(/-/g, '');

    console.log('📋 Tenant:', tenant.company_name || tenant.email);
    console.log('🔑 tenant_id:', tenant.tenant_id);
    console.log('📁 Schéma attendu:', schemaName);
    console.log('📊 leads_table_name:', tenant.leads_table_name);
    console.log('📊 biens_table_name:', tenant.biens_table_name);
    console.log('');

    // 2. Vérifier si le schéma existe
    console.log('🔍 Vérification du schéma...');
    const checkSchemaSQL = `
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = '${schemaName}';
    `;

    const { data: schemaResult, error: schemaError } = await supabase.rpc('exec_sql', {
      sql_query: checkSchemaSQL
    });

    console.log('Schema query result:', schemaResult, 'error:', schemaError);

    // Alternative: essayer avec une vraie requête SELECT via PostgREST
    // Malheureusement, on ne peut pas accéder directement aux information_schema via Supabase

    // 3. Essayer de lire directement la table leads
    console.log('\n🔍 Test d\'accès à la table leads...');

    if (!tenant.leads_table_name) {
      console.log('❌ leads_table_name est NULL, impossible de tester');
    } else {
      // Essayer de sélectionner depuis la table
      const testSQL = `SELECT COUNT(*) as count FROM ${tenant.leads_table_name};`;

      console.log('Exécution:', testSQL);

      const { data: countResult, error: countError } = await supabase.rpc('exec_sql', {
        sql_query: testSQL
      });

      if (countError) {
        console.error('❌ La table N\'EXISTE PAS:', countError.message);
        console.log('\n⚠️  Les tables ne sont PAS créées dans PostgreSQL!');
        console.log('🔍 Vérifiez manuellement dans Supabase SQL Editor avec:');
        console.log(`   SELECT * FROM information_schema.schemata WHERE schema_name = '${schemaName}';`);
        console.log(`   SELECT * FROM information_schema.tables WHERE table_schema = '${schemaName}';`);
      } else {
        console.log('✅ La table EXISTE! Count:', countResult);

        // Tester la table biens aussi
        console.log('\n🔍 Test d\'accès à la table biens...');
        const testBiensSQL = `SELECT COUNT(*) as count FROM ${tenant.biens_table_name};`;
        const { data: biensResult, error: biensError } = await supabase.rpc('exec_sql', {
          sql_query: testBiensSQL
        });

        if (biensError) {
          console.error('❌ La table biens N\'EXISTE PAS:', biensError.message);
        } else {
          console.log('✅ La table biens EXISTE! Count:', biensResult);
        }
      }
    }

    console.log('\n📝 Pour vérifier manuellement dans Supabase:');
    console.log('1. Allez dans SQL Editor');
    console.log('2. Exécutez:');
    console.log(`   SELECT * FROM information_schema.schemata WHERE schema_name LIKE 'tenant_%';`);
    console.log(`   SELECT * FROM information_schema.tables WHERE table_schema = '${schemaName}';`);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    console.error(err.stack);
  }
}

verifySchemas();
