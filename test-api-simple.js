const axios = require('axios');

async function testSimpleOnboarding() {
  try {
    console.log('📞 Test simplifié de création de workflow...\n');

    // Test direct du service
    const supabaseService = require('./services/supabaseService');
    const { createWorkflow } = require('./services/n8nService');

    const tenant_id = `tenant_${Date.now()}`;

    console.log('1️⃣ Récupération du template...');
    const template = await supabaseService.getWorkflowTemplate('email-parser');

    console.log('2️⃣ Préparation du workflow...');
    const workflowJson = typeof template.template_json === 'string'
        ? JSON.parse(template.template_json)
        : template.template_json;

    console.log('3️⃣ Création du workflow dans n8n...');
    const workflow = await createWorkflow(workflowJson, tenant_id);

    console.log('\n✅ SUCCÈS !\n');
    console.log('📋 Résultat:');
    console.log('  Tenant ID:', tenant_id);
    console.log('  Workflow ID:', workflow.id);
    console.log('  Workflow Name:', workflow.name);
    console.log('  Webhook URL:', `https://n8n.emkai.fr/webhook/email-${tenant_id}`);

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error.stack);
  }
}

testSimpleOnboarding();
