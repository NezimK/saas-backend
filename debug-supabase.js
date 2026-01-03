require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function debugSupabase() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  console.log('🔍 Vérification de la connexion Supabase...');
  console.log('URL:', process.env.SUPABASE_URL);
  console.log('Key présente:', !!process.env.SUPABASE_KEY);
  console.log('');

  console.log('📋 Récupération de TOUS les templates...');
  const { data: allTemplates, error: allError } = await supabase
    .from('workflow_templates')
    .select('*');

  if (allError) {
    console.error('❌ Erreur:', allError);
    return;
  }

  console.log(`✅ Nombre de templates trouvés: ${allTemplates?.length || 0}`);
  console.log('');

  if (allTemplates && allTemplates.length > 0) {
    console.log('📝 Liste des templates:');
    allTemplates.forEach((template, index) => {
      console.log(`\n${index + 1}. Template:`);
      console.log(`   - ID: ${template.id}`);
      console.log(`   - Name: "${template.name}"`);
      console.log(`   - Name (type): ${typeof template.name}`);
      console.log(`   - Name (length): ${template.name?.length}`);
      console.log(`   - Name (bytes): [${Buffer.from(template.name || '').join(', ')}]`);
      console.log(`   - Description: ${template.description}`);
      console.log(`   - Created at: ${template.created_at}`);
    });
  }

  console.log('\n🔎 Recherche spécifique de "email-parser"...');
  const { data: specific, error: specificError } = await supabase
    .from('workflow_templates')
    .select('*')
    .eq('name', 'email-parser');

  if (specificError) {
    console.error('❌ Erreur:', specificError);
    return;
  }

  console.log(`Résultat: ${specific?.length || 0} template(s) trouvé(s)`);
  if (specific && specific.length > 0) {
    console.log('✅ Template trouvé:', specific[0]);
  } else {
    console.log('❌ Aucun template avec name="email-parser"');
  }
}

debugSupabase();
