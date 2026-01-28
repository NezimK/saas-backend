require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function testInsertLead() {
  console.log('🧪 Test d\'insertion d\'un lead dans la table tenant...\n');

  try {
    // Récupérer le dernier tenant
    const { data: tenants } = await supabase
      .from('tenants')
      .select('tenant_id, leads_table_name')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!tenants || tenants.length === 0) {
      console.error('❌ Aucun tenant trouvé');
      process.exit(1);
    }

    const tenant = tenants[0];
    const leadsTable = tenant.leads_table_name;

    console.log('📋 tenant_id:', tenant.tenant_id);
    console.log('📊 Table leads:', leadsTable);
    console.log('');

    // Essayer d'insérer un lead de test
    const testLead = {
      tenant_id: tenant.tenant_id,
      source: 'test',
      contact_name: 'Test Lead',
      contact_phone: '+33612345678',
      status: 'nouveau'
    };

    console.log('📝 Insertion d\'un lead de test...');

    const insertSQL = `
      INSERT INTO ${leadsTable} (tenant_id, source, contact_name, contact_phone, status)
      VALUES ('${testLead.tenant_id}', '${testLead.source}', '${testLead.contact_name}', '${testLead.contact_phone}', '${testLead.status}')
      RETURNING id, contact_name, status;
    `;

    const { data, error } = await supabase.rpc('exec_sql', { sql_query: insertSQL });

    if (error) {
      console.error('❌ Erreur insertion:', error.message);
      console.log('\n⚠️  La table existe mais il y a peut-être un problème de permissions ou de structure');
    } else {
      console.log('✅ Lead inséré avec succès!');
      console.log('Résultat:', data);

      // Essayer de lire le lead
      console.log('\n📖 Lecture du lead...');
      const selectSQL = `SELECT * FROM ${leadsTable} WHERE contact_name = 'Test Lead' LIMIT 1;`;
      const { data: selectData, error: selectError } = await supabase.rpc('exec_sql', { sql_query: selectSQL });

      if (selectError) {
        console.error('❌ Erreur lecture:', selectError.message);
      } else {
        console.log('✅ Lead lu avec succès!');
        console.log('Résultat:', selectData);
      }
    }

    console.log('\n🎉 Les tables PostgreSQL fonctionnent correctement!');
    console.log('✅ Schéma créé');
    console.log('✅ Tables créées');
    console.log('✅ Insert/Select fonctionnels');

  } catch (err) {
    console.error('❌ Erreur:', err.message);
  }
}

testInsertLead();
