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

      // 3. Récupérer le mapping des champs pour le logiciel du tenant
      let fieldMapping = null;
      if (tenant.logiciel) {
        const { data: mappingData } = await supabaseService.supabase
          .from('logiciel_mappings')
          .select('mapping_biens')
          .eq('logiciel', tenant.logiciel)
          .single();

        if (mappingData) {
          fieldMapping = Object.keys(mappingData.mapping_biens);
          console.log(`📋 Champs disponibles pour ${tenant.logiciel}: ${fieldMapping.length} champs`);
        }
      }

      // 4. Récupérer le template depuis Supabase
      const template = await supabaseService.getWorkflowTemplate('email-parser');
      const workflowJson = typeof template.template_json === 'string'
        ? JSON.parse(template.template_json)
        : template.template_json;

      // 5. Vérifier que le credential Gmail existe
      if (!gmailCredentialId) {
        throw new Error('Gmail credential ID manquant');
      }

      // 6. Construire la requête de filtrage Gmail à partir des filtres du tenant
      const emailFilters = tenant.email_filters || ['leboncoin.fr', 'seloger.com', 'pap.fr', 'logic-immo.com', 'bienici.com'];
      const gmailQuery = 'from:(' + emailFilters.map(domain => `*@${domain}`).join(' OR ') + ')';

      console.log(`📧 Filtres email configurés: ${emailFilters.join(', ')}`);
      console.log(`🔍 Requête Gmail: ${gmailQuery}`);

      // 6. Personnaliser le workflow depuis le template
      const workflow = {
        name: `Email Parser - ${tenantId}`,
        nodes: workflowJson.nodes.map((node, index) => {
          // Node 0: Gmail Trigger - personnaliser avec credential et filtres
          if (index === 0 && node.type === 'n8n-nodes-base.gmailTrigger') {
            return {
              ...node,
              parameters: {
                ...node.parameters,
                filters: {
                  labelIds: ['INBOX'],
                  q: gmailQuery
                }
              },
              credentials: {
                gmailOAuth2: {
                  id: gmailCredentialId,
                  name: `Gmail - ${tenantId}`
                }
              }
            };
          }

          // Node 1: Set Tenant Info (Code) - remplacer les placeholders
          if (index === 1 && node.name === 'Set Tenant Info') {
            const jsCode = `const inputData = $input.first().json;

return {
  json: {
    ...inputData,
    tenant_id: '${tenantId}',
    client_id: '${tenant.client_id || tenantId}'
  }
};`;

            return {
              ...node,
              parameters: {
                jsCode: jsCode
              }
            };
          }

          // Autres nodes: retourner tel quel
          return node;
        }),
        connections: workflowJson.connections || {},
        settings: workflowJson.settings || { executionOrder: 'v1' }
      };

      // 7. Créer le workflow dans n8n
      console.log('📤 Création du workflow dans n8n...');
      const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId);

      console.log(`✅ Workflow créé: ${createdWorkflow.id}`);

      // 8. Sauvegarder l'ID du workflow dans Supabase
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
