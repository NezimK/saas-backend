const supabaseService = require('./supabaseService');
const n8nService = require('./n8nService');

class WorkflowService {
  /**
   * Crée automatiquement un workflow Gmail pour un tenant
   */
  async createGmailWorkflow(tenantId, gmailCredentialId) {
    try {
      console.log(`\n📋 Création automatique du workflow pour: ${tenantId}`);

      // 1. Vérifier que le tenant a des tokens OAuth
      const { data: tenant, error } = await supabaseService.supabase
        .from('tenants')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error || !tenant || !tenant.email_oauth_tokens) {
        throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
      }

      // 2. Vérifier si un workflow existe déjà
      if (tenant.n8n_workflow_id) {
        console.log(`⚠️  Un workflow existe déjà: ${tenant.n8n_workflow_id}`);
        return { workflowId: tenant.n8n_workflow_id, created: false };
      }

      // 3. Récupérer le template
      const template = await supabaseService.getWorkflowTemplate('email-parser');
      const workflowJson = typeof template.template_json === 'string'
        ? JSON.parse(template.template_json)
        : template.template_json;

      // 4. Vérifier que le credential Gmail existe
      if (!gmailCredentialId) {
        throw new Error('Gmail credential ID manquant');
      }

      // 5. Construire le workflow avec Gmail Trigger natif
      const workflow = {
        name: `Email Parser - ${tenantId}`,
        nodes: [
          // Node 1: Gmail Trigger (détecte les nouveaux emails)
          {
            name: 'Gmail Trigger',
            type: 'n8n-nodes-base.gmailTrigger',
            typeVersion: 1,
            position: [250, 300],
            parameters: {
              pollTimes: {
                item: [
                  {
                    mode: 'everyMinute'
                  }
                ]
              },
              filters: {
                from: 'alimekzine@emkai.fr'
              },
              simple: false
            },
            credentials: {
              gmailOAuth2: {
                id: gmailCredentialId,
                name: `Gmail - ${tenantId}`
              }
            }
          },

          // Nodes du template (OpenAI Parser, etc.)
          ...workflowJson.nodes.slice(1).map((node, index) => ({
            ...node,
            position: [450 + (index * 200), 300]
          }))
        ],

        connections: {
          'Gmail Trigger': {
            main: [[{ node: workflowJson.nodes[1].name, type: 'main', index: 0 }]]
          },
          // Conserver les connexions du template
          ...Object.fromEntries(
            Object.entries(workflowJson.connections || {})
              .filter(([key]) => key !== workflowJson.nodes[0].name)
          )
        },

        settings: workflowJson.settings || {}
      };

      // 6. Créer le workflow dans n8n
      console.log('📤 Création du workflow dans n8n...');
      const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId);

      console.log(`✅ Workflow créé: ${createdWorkflow.id}`);

      // 6. Sauvegarder l'ID du workflow dans Supabase
      await supabaseService.supabase
        .from('tenants')
        .update({ n8n_workflow_id: createdWorkflow.id })
        .eq('tenant_id', tenantId);

      console.log('✅ Workflow ID sauvegardé dans Supabase');

      return {
        workflowId: createdWorkflow.id,
        workflowName: createdWorkflow.name,
        created: true
      };

    } catch (error) {
      console.error(`❌ Erreur création workflow pour ${tenantId}:`, error.message);
      throw error;
    }
  }
}

module.exports = new WorkflowService();
