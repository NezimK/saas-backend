require('dotenv').config();
const supabaseService = require('./services/supabaseService');
const n8nService = require('./services/n8nService');

async function createGmailWorkflow() {
  try {
    const tenantId = 'test-tenant-001';

    console.log('1️⃣ Récupération du tenant...');
    const { data: tenant } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (!tenant || !tenant.email_oauth_tokens) {
      console.error('❌ Tenant non trouvé ou Gmail non connecté');
      return;
    }

    console.log('2️⃣ Récupération du template email-parser...');
    const template = await supabaseService.getWorkflowTemplate('email-parser');

    const workflowJson = typeof template.template_json === 'string'
      ? JSON.parse(template.template_json)
      : template.template_json;

    console.log('3️⃣ Modification du workflow: remplacement Webhook par Gmail Trigger...');

    // Remplacer le premier nœud (Webhook) par Gmail Trigger
    // Garder tous les autres nœuds identiques
    const newWorkflow = {
      name: `${workflowJson.name} - ${tenantId}`,
      nodes: [
        // Nœud 1: Gmail Trigger (remplace Webhook)
        {
          name: 'Gmail Trigger',
          type: 'n8n-nodes-base.gmailTrigger',
          position: workflowJson.nodes[0].position,
          parameters: {
            pollTimes: {
              item: [
                {
                  mode: 'everyMinute'
                }
              ]
            },
            filters: {
              sender: [
                {
                  value: '*@leboncoin.fr'
                },
                {
                  value: '*@seloger.com'
                }
              ]
            },
            options: {}
          },
          typeVersion: 1
        },
        // Garder tous les autres nœuds du template
        ...workflowJson.nodes.slice(1)
      ],
      connections: {
        // Connecter Gmail Trigger au deuxième nœud
        'Gmail Trigger': {
          main: [[{
            node: workflowJson.nodes[1].name,
            type: 'main',
            index: 0
          }]]
        },
        // Garder toutes les autres connexions (sauf la première)
        ...Object.fromEntries(
          Object.entries(workflowJson.connections || {})
            .filter(([key]) => key !== workflowJson.nodes[0].name)
        )
      },
      settings: workflowJson.settings || {}
    };

    console.log('4️⃣ Création du workflow dans n8n...');
    const workflow = await n8nService.createWorkflow(newWorkflow, tenantId);

    console.log('\n✅ SUCCÈS !');
    console.log('ID Workflow:', workflow.id);
    console.log('Nom:', workflow.name);
    console.log('\n⚠️  IMPORTANT:');
    console.log('1. Allez dans n8n: https://n8n.emkai.fr');
    console.log('2. Ouvrez le workflow:', workflow.name);
    console.log('3. Configurez le credential Gmail OAuth2 sur le nœud "Gmail Trigger"');
    console.log('4. Configurez le credential OpenAI sur le nœud "Parse with AI"');
    console.log('5. Activez le workflow');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error.stack);
  }
}

createGmailWorkflow();
