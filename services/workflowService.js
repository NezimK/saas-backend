const supabaseService = require('./supabaseService');
const n8nService = require('./n8nService');

class WorkflowService {
  /**
   * Remplace tous les placeholders dans un workflow n8n
   * - Config nodes: TENANT_ID, LEADS_TABLE, BIENS_TABLE
   * - Code nodes: TENANT_ID_PLACEHOLDER, CLIENT_ID_PLACEHOLDER, etc.
   * - Supabase nodes: tableId hardcodé
   *
   * Architecture: Tables partagées dans public avec tenant_id pour filtrage
   */
  replacePlaceholdersInWorkflow(workflowJson, tenantId, tenant) {
    console.log('🔍 [DEBUG replacePlaceholdersInWorkflow] Début');
    console.log('🔍 [DEBUG] tenantId:', tenantId);

    // Tables partagées dans public (pas de schémas séparés)
    const leadsTable = 'leads';
    const biensTable = 'biens';

    console.log('🔍 [DEBUG] leadsTable:', leadsTable);
    console.log('🔍 [DEBUG] biensTable:', biensTable);

    return {
      ...workflowJson,
      nodes: workflowJson.nodes.map((node, index) => {
        console.log(`🔍 [DEBUG] Node ${index}: type=${node.type}, name=${node.name}`);

        // 1. Config nodes (n8n-nodes-base.set named "Config")
        if (node.type === 'n8n-nodes-base.set' && node.name === 'Config') {
          console.log('🔍 [DEBUG] Config node trouvé! Avant:', JSON.stringify(node.parameters, null, 2));

          // Garder la structure existante mais mettre à jour les valeurs
          const updatedAssignments = node.parameters.assignments?.assignments?.map(assignment => {
            if (assignment.name === 'TENANT_ID') {
              return { ...assignment, value: tenantId };
            } else if (assignment.name === 'LEADS_TABLE') {
              return { ...assignment, value: leadsTable };
            } else if (assignment.name === 'BIENS_TABLE') {
              return { ...assignment, value: biensTable };
            }
            return assignment;
          }) || [];

          const updatedNode = {
            ...node,
            parameters: {
              ...node.parameters,
              assignments: {
                ...node.parameters.assignments,
                assignments: updatedAssignments
              }
            }
          };

          console.log('🔍 [DEBUG] Config node après:', JSON.stringify(updatedNode.parameters, null, 2));
          return updatedNode;
        }

        // 2. Code nodes - remplacer placeholders dans jsCode
        if (node.type === 'n8n-nodes-base.code' && node.parameters?.jsCode) {
          return {
            ...node,
            parameters: {
              ...node.parameters,
              jsCode: node.parameters.jsCode
                .replace(/TENANT_ID_PLACEHOLDER/g, tenantId)
                .replace(/CLIENT_ID_PLACEHOLDER/g, tenant.client_id || tenantId)
                .replace(/LEADS_TABLE_PLACEHOLDER/g, leadsTable)
                .replace(/BIENS_TABLE_PLACEHOLDER/g, biensTable)
            }
          };
        }

        // 3. Supabase nodes - remplacer tableId hardcodé
        if (node.parameters?.tableId && typeof node.parameters.tableId === 'string') {
          let tableId = node.parameters.tableId;

          // Remplacer les références hardcodées
          if (tableId.includes('leads_immocope') || tableId === 'leads') {
            tableId = leadsTable;
          } else if (tableId === 'biens') {
            tableId = biensTable;
          }

          return {
            ...node,
            parameters: {
              ...node.parameters,
              tableId
            }
          };
        }

        return node;
      })
    };
  }
  /**
   * Crée le workflow Email Parser pour un tenant
   * Note: Bot Qualification et Response Dashboard sont maintenant des workflows
   * multi-tenant partagés (un seul workflow pour tous les tenants)
   */
  async createAllWorkflows(tenantId, gmailCredentialId) {
    try {
      console.log(`\n📋 Création du workflow Email Parser pour: ${tenantId}`);
      console.log('ℹ️  Bot Qualification et Response Dashboard sont des workflows partagés multi-tenant');

      // 1. Vérifier que le tenant a des tokens OAuth
      const { data: tenant, error } = await supabaseService.supabase
        .from('tenants')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error || !tenant || !tenant.email_oauth_tokens) {
        throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
      }

      // 2. Vérifier si le workflow Email Parser existe déjà
      if (tenant.n8n_workflow_id) {
        console.log(`⚠️  Le workflow Email Parser existe déjà pour ce tenant`);
        return {
          emailParser: tenant.n8n_workflow_id,
          created: false
        };
      }

      // 3. Tables partagées dans public - pas besoin de créer de schéma
      console.log('\n📊 Utilisation des tables partagées (public.leads, public.biens)');

      // 4. Créer ou récupérer le dossier n8n pour ce tenant
      const project = await n8nService.createOrGetProjectFolder(tenant.company_name, tenantId);
      const projectId = project ? project.id : null;

      // 5. Créer uniquement le workflow Email Parser (avec Gmail credential)
      // Bot Qualification et Response Dashboard sont des workflows partagés
      console.log('\n📧 Création workflow: Email Parser');
      const emailParserWorkflow = await this.createEmailParserWorkflow(
        tenantId,
        tenant,
        gmailCredentialId,
        projectId
      );

      // 6. Sauvegarder l'ID du workflow dans Supabase
      const leadsTableName = 'leads';
      const biensTableName = 'biens';

      console.log('\n💾 Sauvegarde dans Supabase...');

      const { data: updateData, error: updateError } = await supabaseService.supabase
        .from('tenants')
        .update({
          n8n_workflow_id: emailParserWorkflow.id,
          n8n_project_id: projectId,
          leads_table_name: leadsTableName,
          biens_table_name: biensTableName
        })
        .eq('tenant_id', tenantId)
        .select();

      if (updateError) {
        console.error('❌ Erreur sauvegarde Supabase:', updateError.message);
        throw new Error(`Impossible de sauvegarder le workflow: ${updateError.message}`);
      }

      console.log('🔍 [DEBUG] Données sauvegardées:', JSON.stringify(updateData, null, 2));
      console.log('\n✅ Workflow Email Parser créé et sauvegardé dans Supabase');

      return {
        emailParser: emailParserWorkflow.id,
        projectId,
        created: true
      };

    } catch (error) {
      console.error(`❌ Erreur création workflow pour ${tenantId}:`, error.message);
      throw error;
    }
  }

  /**
   * Crée le workflow Email Parser avec personnalisation Gmail
   */
  async createEmailParserWorkflow(tenantId, tenant, gmailCredentialId, projectId) {
    console.log('🔍 [DEBUG createEmailParserWorkflow] Début');
    console.log('🔍 [DEBUG] tenantId:', tenantId);
    console.log('🔍 [DEBUG] tenant:', JSON.stringify(tenant, null, 2));

    // Récupérer le template
    const template = await supabaseService.getWorkflowTemplate('email-parser');
    let workflowJson = typeof template.template_json === 'string'
      ? JSON.parse(template.template_json)
      : template.template_json;

    console.log('🔍 [DEBUG] Template récupéré, nodes:', workflowJson.nodes?.length);

    // Vérifier que le credential Gmail existe
    if (!gmailCredentialId) {
      throw new Error('Gmail credential ID manquant');
    }

    // Remplacer tous les placeholders (Config, Code, Supabase nodes)
    workflowJson = this.replacePlaceholdersInWorkflow(workflowJson, tenantId, tenant);

    // Construire la requête de filtrage Gmail
    const emailFilters = tenant.email_filters || ['leboncoin.fr', 'seloger.com', 'pap.fr', 'logic-immo.com', 'bienici.com'];
    const gmailQuery = 'from:(' + emailFilters.map(domain => `*@${domain}`).join(' OR ') + ')';

    console.log(`📧 Filtres email: ${emailFilters.join(', ')}`);
    console.log(`🔍 Requête Gmail: ${gmailQuery}`);

    // Personnalisation spécifique Email Parser (Gmail credential et filtres)
    const workflowName = `Email Parser - ${tenantId}`;
    console.log('🔍 [DEBUG] Nom du workflow défini:', workflowName);

    const workflow = {
      name: workflowName,
      nodes: workflowJson.nodes.map((node, index) => {
        // Gmail Trigger: personnaliser avec credential et filtres (chercher par type, pas par index)
        if (node.type === 'n8n-nodes-base.gmailTrigger') {
          console.log(`🔍 [DEBUG] Gmail Trigger trouvé à l'index ${index}, application credential et filtres`);
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

        // Autres nodes: retourner tel quel (déjà modifiés par replacePlaceholdersInWorkflow)
        return node;
      }),
      connections: workflowJson.connections || {},
      settings: workflowJson.settings || { executionOrder: 'v1' }
    };

    console.log('🔍 [DEBUG] Workflow à envoyer à n8nService.createWorkflow:');
    console.log('🔍 [DEBUG] - name:', workflow.name);
    console.log('🔍 [DEBUG] - nodes count:', workflow.nodes.length);

    // Créer le workflow dans n8n
    const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId, projectId);
    console.log(`✅ Email Parser créé: ${createdWorkflow.id}`);
    console.log('🔍 [DEBUG] Workflow créé, nom retourné par n8n:', createdWorkflow.name);

    return createdWorkflow;
  }

  /**
   * Crée un workflow depuis un template (générique)
   */
  async createWorkflowFromTemplate(templateName, tenantId, tenant, projectId) {
    console.log(`🔍 [DEBUG createWorkflowFromTemplate] Début pour template: ${templateName}`);

    // Récupérer le template
    const template = await supabaseService.getWorkflowTemplate(templateName);
    let workflowJson = typeof template.template_json === 'string'
      ? JSON.parse(template.template_json)
      : template.template_json;

    console.log('🔍 [DEBUG] Template récupéré, nodes:', workflowJson.nodes?.length);

    // Remplacer tous les placeholders (Config, Code, Supabase nodes)
    workflowJson = this.replacePlaceholdersInWorkflow(workflowJson, tenantId, tenant);

    // Personnaliser le nom du workflow
    const workflowNames = {
      'bot-qualification': `Bot Qualification - ${tenantId}`,
      'response-dashboard': `Response Dashboard - ${tenantId}`
    };

    const workflowName = workflowNames[templateName] || `${templateName} - ${tenantId}`;
    console.log('🔍 [DEBUG] Nom du workflow défini:', workflowName);

    const workflow = {
      name: workflowName,
      nodes: workflowJson.nodes, // Les placeholders ont déjà été remplacés
      connections: workflowJson.connections || {},
      settings: workflowJson.settings || { executionOrder: 'v1' }
    };

    console.log('🔍 [DEBUG] Workflow à envoyer, name:', workflow.name);

    // Créer le workflow dans n8n
    const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId, projectId);
    console.log(`✅ ${workflowName} créé: ${createdWorkflow.id}`);
    console.log('🔍 [DEBUG] Workflow créé, nom retourné par n8n:', createdWorkflow.name);

    return createdWorkflow;
  }

  /**
   * Alias pour compatibilité avec l'ancien code
   */
  async createGmailWorkflow(tenantId, gmailCredentialId) {
    return this.createAllWorkflows(tenantId, gmailCredentialId);
  }
}

module.exports = new WorkflowService();
