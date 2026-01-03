require('dotenv').config();
const supabaseService = require('./services/supabaseService');

async function viewTemplate() {
  try {
    console.log('📋 Récupération du template email-parser...\n');
    const template = await supabaseService.getWorkflowTemplate('email-parser');

    console.log('ID:', template.id);
    console.log('Name:', template.name);
    console.log('Description:', template.description);
    console.log('\n📦 Structure du workflow:\n');

    const workflowJson = typeof template.template_json === 'string'
      ? JSON.parse(template.template_json)
      : template.template_json;

    console.log(JSON.stringify(workflowJson, null, 2));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

viewTemplate();
