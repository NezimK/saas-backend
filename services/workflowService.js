const supabaseService = require('./supabaseService');
const n8nService = require('./n8nService');

class WorkflowService {
  /**
   * Crée automatiquement un workflow Gmail pour un tenant
   */
  async createGmailWorkflow(tenantId) {
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

      // 4. Construire le workflow avec HTTP Request
      const workflow = {
        name: `Email Parser - ${tenantId}`,
        nodes: [
          // Node 1: Schedule Trigger (toutes les minutes)
          {
            name: 'Schedule',
            type: 'n8n-nodes-base.scheduleTrigger',
            typeVersion: 1,
            position: [250, 300],
            parameters: {
              rule: {
                interval: [{ field: 'minutes', minutesInterval: 1 }]
              }
            }
          },

          // Node 2: Get Valid Access Token
          {
            name: 'Get Access Token',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [450, 300],
            parameters: {
              url: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/token/gmail/${tenantId}`,
              method: 'GET',
              options: {}
            }
          },

          // Node 3: List Gmail Messages
          {
            name: 'List Gmail Messages',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [650, 300],
            parameters: {
              url: '=https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:alimekzine@emkai.fr&maxResults=10',
              method: 'GET',
              authentication: 'none',
              options: {
                queryParameters: {
                  parameters: [
                    {
                      name: 'access_token',
                      value: '={{ $node["Get Access Token"].json.access_token }}'
                    }
                  ]
                }
              }
            }
          },

          // Node 4: Check if messages exist
          {
            name: 'Check Messages',
            type: 'n8n-nodes-base.if',
            typeVersion: 2,
            position: [850, 300],
            parameters: {
              conditions: {
                options: {
                  caseSensitive: true,
                  leftValue: '',
                  typeValidation: 'strict'
                },
                conditions: [
                  {
                    leftValue: '={{ $json.messages }}',
                    rightValue: '',
                    operator: {
                      type: 'array',
                      operation: 'notEmpty'
                    }
                  }
                ],
                combineOperation: 'all'
              }
            }
          },

          // Node 5: Split Messages
          {
            name: 'Split Messages',
            type: 'n8n-nodes-base.splitInBatches',
            typeVersion: 3,
            position: [1050, 200],
            parameters: {
              batchSize: 1,
              options: {}
            }
          },

          // Node 6: Get Message Details
          {
            name: 'Get Message Details',
            type: 'n8n-nodes-base.httpRequest',
            typeVersion: 4,
            position: [1250, 200],
            parameters: {
              url: '=https://gmail.googleapis.com/gmail/v1/users/me/messages/{{ $json.messages[0].id }}?format=full',
              method: 'GET',
              authentication: 'none',
              options: {
                queryParameters: {
                  parameters: [
                    {
                      name: 'access_token',
                      value: '={{ $node["Get Access Token"].json.access_token }}'
                    }
                  ]
                }
              }
            }
          },

          // Node 7: Extract Email Body
          {
            name: 'Extract Email Body',
            type: 'n8n-nodes-base.code',
            typeVersion: 2,
            position: [1450, 200],
            parameters: {
              mode: 'runOnceForAllItems',
              jsCode: `
// Extraire le corps de l'email
const message = $input.all()[0].json;
const payload = message.payload;

function getBody(payload) {
  if (payload.body && payload.body.data) {
    return Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }

    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf-8');
      }
    }
  }

  return '';
}

const subject = payload.headers.find(h => h.name === 'Subject')?.value || '';
const from = payload.headers.find(h => h.name === 'From')?.value || '';
const body = getBody(payload);

return [{
  json: {
    subject,
    from,
    body,
    messageId: message.id
  }
}];
`
            }
          },

          // Nodes du template (OpenAI Parser, etc.)
          ...workflowJson.nodes.slice(1).map((node, index) => ({
            ...node,
            position: [1650 + (index * 200), 200]
          }))
        ],

        connections: {
          'Schedule': {
            main: [[{ node: 'Get Access Token', type: 'main', index: 0 }]]
          },
          'Get Access Token': {
            main: [[{ node: 'List Gmail Messages', type: 'main', index: 0 }]]
          },
          'List Gmail Messages': {
            main: [[{ node: 'Check Messages', type: 'main', index: 0 }]]
          },
          'Check Messages': {
            main: [[{ node: 'Split Messages', type: 'main', index: 0 }], []]
          },
          'Split Messages': {
            main: [[{ node: 'Get Message Details', type: 'main', index: 0 }]]
          },
          'Get Message Details': {
            main: [[{ node: 'Extract Email Body', type: 'main', index: 0 }]]
          },
          'Extract Email Body': {
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

      // 5. Créer le workflow dans n8n
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
