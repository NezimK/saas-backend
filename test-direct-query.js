require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testDirectQuery() {
  console.log('🔧 Configuration:');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Key (premiers caractères):', process.env.SUPABASE_KEY?.substring(0, 20) + '...');
  console.log('');

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  // Test 1: Compter les lignes
  console.log('📊 Test 1: Compter les lignes dans workflow_templates...');
  const { count, error: countError } = await supabase
    .from('workflow_templates')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Erreur count:', countError.message);
    console.error('   Code:', countError.code);
    console.error('   Details:', countError.details);
    console.error('   Hint:', countError.hint);
  } else {
    console.log('✅ Nombre total de lignes:', count);
  }
  console.log('');

  // Test 2: Récupérer toutes les lignes
  console.log('📋 Test 2: Récupérer toutes les lignes...');
  const { data, error } = await supabase
    .from('workflow_templates')
    .select('*');

  if (error) {
    console.error('❌ Erreur select:', error.message);
    console.error('   Code:', error.code);
    console.error('   Details:', error.details);
    console.error('   Hint:', error.hint);
  } else {
    console.log('✅ Données récupérées:', data?.length || 0, 'ligne(s)');
    if (data && data.length > 0) {
      console.log('\n📝 Contenu:');
      data.forEach((row, i) => {
        console.log(`\n[${i + 1}]`);
        console.log('  id:', row.id);
        console.log('  name:', JSON.stringify(row.name));
        console.log('  description:', row.description);
      });
    }
  }
  console.log('');

  // Test 3: Recherche par nom
  console.log('🔍 Test 3: Recherche avec eq("name", "email-parser")...');
  const { data: searchData, error: searchError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('name', 'email-parser');

  if (searchError) {
    console.error('❌ Erreur search:', searchError.message);
  } else {
    console.log('✅ Résultats:', searchData?.length || 0);
    if (searchData && searchData.length > 0) {
      console.log('   Trouvé:', searchData[0]);
    }
  }
}

testDirectQuery();
