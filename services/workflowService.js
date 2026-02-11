const supabaseService = require('./supabaseService');
const n8nService = require('./n8nService');
const fs = require('fs');
const path = require('path');
const logger = require('./logger');

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
    logger.debug('workflow', 'replacePlaceholdersInWorkflow - Debut');
    logger.debug('workflow', 'tenantId:', tenantId);

    // Tables partagées dans public (pas de schémas séparés)
    const leadsTable = 'leads';
    const biensTable = 'biens';

    logger.debug('workflow', 'leadsTable:', leadsTable);
    logger.debug('workflow', 'biensTable:', biensTable);

    return {
      ...workflowJson,
      nodes: workflowJson.nodes.map((node, index) => {
        logger.debug('workflow', `Node ${index}: type=${node.type}, name=${node.name}`);

        // 1. Config nodes (n8n-nodes-base.set named "Config")
        if (node.type === 'n8n-nodes-base.set' && (node.name === 'Config' || node.name === 'Config1')) {
          logger.debug('workflow', 'Config node trouve! Avant:', JSON.stringify(node.parameters, null, 2));

          // Garder la structure existante mais mettre à jour les valeurs
          const updatedAssignments = node.parameters.assignments?.assignments?.map(assignment => {
            if (assignment.name === 'TENANT_ID') {
              return { ...assignment, value: tenantId };
            } else if (assignment.name === 'LEADS_TABLE') {
              return { ...assignment, value: leadsTable };
            } else if (assignment.name === 'BIENS_TABLE') {
              return { ...assignment, value: biensTable };
            } else if (assignment.name === 'CRM_API_KEY') {
              return { ...assignment, value: tenant.api_key || '' };
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

          logger.debug('workflow', 'Config node apres:', JSON.stringify(updatedNode.parameters, null, 2));
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
      logger.info('workflow', `Creation du workflow Email Parser pour: ${tenantId}`);
      logger.info('workflow', 'Bot Qualification et Response Dashboard sont des workflows partages multi-tenant');

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
        logger.warn('workflow', 'Le workflow Email Parser existe deja pour ce tenant');
        return {
          emailParser: tenant.n8n_workflow_id,
          created: false
        };
      }

      // 3. Tables partagées dans public - pas besoin de créer de schéma
      logger.info('workflow', 'Utilisation des tables partagees (public.leads, public.biens)');

      // 4. Créer ou récupérer le dossier n8n pour ce tenant
      const project = await n8nService.createOrGetProjectFolder(tenant.company_name, tenantId);
      const projectId = project ? project.id : null;

      // 5. Créer uniquement le workflow Email Parser (avec Gmail credential)
      // Bot Qualification et Response Dashboard sont des workflows partagés
      logger.info('workflow', 'Creation workflow: Email Parser');
      const emailParserWorkflow = await this.createEmailParserWorkflow(
        tenantId,
        tenant,
        gmailCredentialId,
        projectId
      );

      // 6. Sauvegarder l'ID du workflow dans Supabase
      const leadsTableName = 'leads';
      const biensTableName = 'biens';

      logger.info('workflow', 'Sauvegarde dans Supabase...');

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
        logger.error('workflow', 'Erreur sauvegarde Supabase', updateError.message);
        throw new Error(`Impossible de sauvegarder le workflow: ${updateError.message}`);
      }

      logger.debug('workflow', 'Donnees sauvegardees:', JSON.stringify(updateData, null, 2));
      logger.info('workflow', 'Workflow Email Parser cree et sauvegarde dans Supabase');

      return {
        emailParser: emailParserWorkflow.id,
        projectId,
        created: true
      };

    } catch (error) {
      logger.error('workflow', `Erreur creation workflow pour ${tenantId}`, error.message);
      throw error;
    }
  }

  /**
   * Crée le workflow Email Parser avec personnalisation Gmail
   */
  async createEmailParserWorkflow(tenantId, tenant, gmailCredentialId, projectId) {
    logger.debug('workflow', 'createEmailParserWorkflow - Debut');
    logger.debug('workflow', 'tenantId:', tenantId);
    logger.debug('workflow', 'tenant:', JSON.stringify(tenant, null, 2));

    // Charger le template Gmail depuis WorkflowBeta
    const templatePath = path.join(__dirname, '../WorkflowBeta/Email Parser Gmail - 4b88ddd2-6e4b-46c6-b4ea-5f58c7b19394.json');
    let workflowJson = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

    logger.debug('workflow', 'Template Gmail Beta charge, nodes:', workflowJson.nodes?.length);

    // Vérifier que le credential Gmail existe
    if (!gmailCredentialId) {
      throw new Error('Gmail credential ID manquant');
    }

    // Remplacer tous les placeholders (Config, Code, Supabase nodes)
    workflowJson = this.replacePlaceholdersInWorkflow(workflowJson, tenantId, tenant);

    // Construire la requête de filtrage Gmail
    const emailFilters = tenant.email_filters || ['leboncoin.fr', 'seloger.com', 'pap.fr', 'logic-immo.com', 'bienici.com', 'figaroimmo.fr', 'avendrealouer.fr', 'paruvendu.fr', 'ouestfrance-immo.com'];
    const gmailQuery = 'from:(' + emailFilters.map(domain => `*@${domain}`).join(' OR ') + ')';

    logger.info('workflow', `Filtres email: ${emailFilters.join(', ')}`);
    logger.debug('workflow', `Requete Gmail: ${gmailQuery}`);

    // Personnalisation spécifique Email Parser (Gmail credential et filtres)
    const workflowName = `Email Parser Gmail - ${tenantId}`;
    logger.debug('workflow', 'Nom du workflow defini:', workflowName);

    const workflow = {
      name: workflowName,
      nodes: workflowJson.nodes.map((node, index) => {
        // Gmail Trigger: personnaliser avec credential et filtres
        if (node.type === 'n8n-nodes-base.gmailTrigger') {
          logger.debug('workflow', `Gmail Trigger trouve a l'index ${index}, application credential et filtres`);
          return {
            ...node,
            parameters: {
              ...node.parameters,
              filters: {
                ...node.parameters.filters,
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

    logger.debug('workflow', 'Workflow a envoyer a n8nService.createWorkflow:');
    logger.debug('workflow', '- name:', workflow.name);
    logger.debug('workflow', '- nodes count:', workflow.nodes.length);

    // Créer le workflow dans n8n
    const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId, projectId);
    logger.info('workflow', `Email Parser Gmail cree: ${createdWorkflow.id}`);
    logger.debug('workflow', 'Workflow cree, nom retourne par n8n:', createdWorkflow.name);

    return createdWorkflow;
  }

  /**
   * Crée un workflow depuis un template (générique)
   */
  async createWorkflowFromTemplate(templateName, tenantId, tenant, projectId) {
    logger.debug('workflow', `createWorkflowFromTemplate - Debut pour template: ${templateName}`);

    // Récupérer le template
    const template = await supabaseService.getWorkflowTemplate(templateName);
    let workflowJson = typeof template.template_json === 'string'
      ? JSON.parse(template.template_json)
      : template.template_json;

    logger.debug('workflow', 'Template recupere, nodes:', workflowJson.nodes?.length);

    // Remplacer tous les placeholders (Config, Code, Supabase nodes)
    workflowJson = this.replacePlaceholdersInWorkflow(workflowJson, tenantId, tenant);

    // Personnaliser le nom du workflow
    const workflowNames = {
      'bot-qualification': `Bot Qualification - ${tenantId}`,
      'response-dashboard': `Response Dashboard - ${tenantId}`
    };

    const workflowName = workflowNames[templateName] || `${templateName} - ${tenantId}`;
    logger.debug('workflow', 'Nom du workflow defini:', workflowName);

    const workflow = {
      name: workflowName,
      nodes: workflowJson.nodes, // Les placeholders ont déjà été remplacés
      connections: workflowJson.connections || {},
      settings: workflowJson.settings || { executionOrder: 'v1' }
    };

    logger.debug('workflow', 'Workflow a envoyer, name:', workflow.name);

    // Créer le workflow dans n8n
    const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId, projectId);
    logger.info('workflow', `${workflowName} cree: ${createdWorkflow.id}`);
    logger.debug('workflow', 'Workflow cree, nom retourne par n8n:', createdWorkflow.name);

    return createdWorkflow;
  }

  /**
   * Alias pour compatibilité avec l'ancien code
   */
  async createGmailWorkflow(tenantId, gmailCredentialId) {
    return this.createAllWorkflows(tenantId, gmailCredentialId);
  }

  /**
   * Crée un workflow Email selon le provider (Gmail ou Outlook)
   */
  async createEmailWorkflow(tenantId, credentialId, provider = 'gmail') {
    if (provider === 'outlook') {
      return this.createOutlookEmailParserWorkflow(tenantId, credentialId);
    }
    return this.createAllWorkflows(tenantId, credentialId);
  }

  /**
   * Crée le workflow Email Parser pour Outlook
   */
  async createOutlookEmailParserWorkflow(tenantId, outlookCredentialId) {
    try {
      logger.info('workflow', `Creation workflow Email Parser Outlook pour: ${tenantId}`);

      // 1. Verifier que le tenant existe
      const { data: tenant, error } = await supabaseService.supabase
        .from('tenants')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      if (error || !tenant) {
        throw new Error(`Tenant ${tenantId} non trouve`);
      }

      // 2. Verifier si le workflow existe deja
      if (tenant.n8n_workflow_id) {
        logger.warn('workflow', 'Le workflow Email Parser existe deja pour ce tenant');
        return {
          workflowId: tenant.n8n_workflow_id,
          created: false,
          provider: 'outlook'
        };
      }

      // 3. Charger le template Outlook depuis WorkflowBeta
      const templatePath = path.join(__dirname, '../WorkflowBeta/Email Parser Outlook - d521dfe4-1c34-442f-a871-64c8ae434da5 (2).json');
      let workflowJson = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

      logger.debug('workflow', 'Template Outlook Beta charge, nodes:', workflowJson.nodes?.length);

      // 4. Personnaliser le nom du workflow
      workflowJson.name = `Email Parser Outlook - ${tenantId}`;

      // 5. Appliquer tous les remplacements standards (Config1, Code nodes, Supabase nodes)
      workflowJson = this.replacePlaceholdersInWorkflow(workflowJson, tenantId, tenant);

      // 6. Remplacements specifiques Outlook (credential, filtres email)
      const emailFilters = tenant.email_filters || [
        'leboncoin.fr', 'seloger.com', 'pap.fr', 'logic-immo.com',
        'bienici.com', 'figaroimmo.fr', 'avendrealouer.fr',
        'paruvendu.fr', 'ouestfrance-immo.com'
      ];

      logger.info('workflow', `Filtres email Outlook: ${emailFilters.join(', ')}`);

      workflowJson.nodes = workflowJson.nodes.map(node => {
        // Outlook Trigger: associer le credential
        if (node.name === 'Outlook Trigger' && node.type === 'n8n-nodes-base.microsoftOutlookTrigger' && outlookCredentialId) {
          return {
            ...node,
            credentials: {
              microsoftOutlookOAuth2Api: {
                id: outlookCredentialId,
                name: `Outlook - ${tenantId}`
              }
            }
          };
        }

        // Code in JavaScript6: remplacer le tableau allowedDomains hardcode par les domaines du tenant
        if (node.name === 'Code in JavaScript6' && node.type === 'n8n-nodes-base.code') {
          const allowedDomains = JSON.stringify(emailFilters);
          return {
            ...node,
            parameters: {
              ...node.parameters,
              jsCode: node.parameters.jsCode.replace(
                /const allowedDomains = \[.*?\];/,
                `const allowedDomains = ${allowedDomains};`
              )
            }
          };
        }

        return node;
      });

      // 6. Creer ou recuperer le dossier n8n pour ce tenant
      const project = await n8nService.createOrGetProjectFolder(tenant.company_name, tenantId);
      const projectId = project ? project.id : null;

      // 7. Creer le workflow dans n8n
      const createdWorkflow = await n8nService.createWorkflow(workflowJson, tenantId, projectId);
      logger.info('workflow', `Email Parser Outlook cree: ${createdWorkflow.id}`);

      // 8. Sauvegarder l'ID du workflow dans Supabase
      await supabaseService.supabase
        .from('tenants')
        .update({
          n8n_workflow_id: createdWorkflow.id,
          n8n_project_id: projectId
        })
        .eq('tenant_id', tenantId);

      logger.info('workflow', 'Workflow Outlook sauvegarde dans Supabase');

      return {
        workflowId: createdWorkflow.id,
        projectId,
        created: true,
        provider: 'outlook'
      };

    } catch (error) {
      logger.error('workflow', `Erreur creation workflow Outlook pour ${tenantId}`, error.message);
      throw error;
    }
  }
}

module.exports = new WorkflowService();
