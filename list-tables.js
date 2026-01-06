/**
 * Script pour lister toutes les tables Supabase accessibles
 */

require('dotenv').config();
const supabaseService = require('./services/supabaseService');

async function listAllTables() {
  console.log('🔍 Recherche de toutes les tables accessibles...\n');

  // Liste des tables potentielles basées sur le code et les migrations
  const potentialTables = [
    'tenants',
    'workflows',
    'credentials',
    'users',
    'emails',
    'contacts',
    'leads',
    'properties',
    'messages',
    'logs',
    'api_keys',
    'webhooks',
    'email_logs',
    'parsed_emails',
    'filter_rules'
  ];

  const accessibleTables = [];

  for (const table of potentialTables) {
    try {
      const { data, error } = await supabaseService.supabase
        .from(table)
        .select('*')
        .limit(1);

      if (!error) {
        const count = await supabaseService.supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        accessibleTables.push({
          name: table,
          count: count.count || 0,
          columns: data && data[0] ? Object.keys(data[0]) : []
        });
      }
    } catch (e) {
      // Table n'existe pas ou inaccessible
    }
  }

  console.log('✅ Tables accessibles:\n');
  accessibleTables.forEach(table => {
    console.log(`📊 Table: ${table.name}`);
    console.log(`   Lignes: ${table.count}`);
    console.log(`   Colonnes (${table.columns.length}): ${table.columns.join(', ')}`);
    console.log('');
  });

  console.log(`\nTotal: ${accessibleTables.length} table(s) trouvée(s)`);
}

listAllTables();
