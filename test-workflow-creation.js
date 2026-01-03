require('dotenv').config();
const supabaseService = require('./services/supabaseService');
const n8nService = require('./services/n8nService');

async function testWorkflowCreation() {
  try {
    console.log('📥 Récupération du template...');
    const template = await supabaseService.getWorkflowTemplate('email-parser');
    
    console.log('✅ Template récupéré');

    console.log('🔧 Personnalisation pour tenant test...');
    const tenantId = 'test-' + Date.now();

    // template_json peut être soit une string, soit déjà un objet
    const workflowJson = typeof template.template_json === 'string'
      ? JSON.parse(template.template_json)
      : template.template_json;
    
    // Personnaliser le nom
    workflowJson.name = `Email Parser - ${tenantId}`;

    console.log('🚀 Création dans n8n...');
    const result = await n8nService.createWorkflow(workflowJson, tenantId);
    
    console.log('✅ SUCCÈS !');
    console.log('ID Workflow:', result.id);
    console.log('Webhook URL:', `https://n8n.emkai.fr/webhook/${result.id}/email-reception`);
    
  } catch (error) {
    console.error('❌ ERREUR:', error.message);
  }
}

testWorkflowCreation();