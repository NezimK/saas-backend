/**
 * Crée un workflow Gmail complet avec HTTP Request
 * Utilise notre service de tokens pour gérer automatiquement le refresh
 */

require('dotenv').config();
const supabaseService = require('./services/supabaseService');
const n8nService = require('./services/n8nService');

async function createGmailWorkflowFinal(tenantId) {
    try {
        console.log(`📋 Création du workflow Gmail automatisé pour: ${tenantId}\n`);

        // 1. Vérifier que le tenant a des tokens OAuth
        const { data: tenant, error } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (error || !tenant || !tenant.email_oauth_tokens) {
            throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth. Connectez Gmail d'abord via: http://localhost:3000/auth/gmail/connect?tenantId=${tenantId}`);
        }

        console.log('✅ Tenant trouvé avec tokens OAuth');

        // 2. Récupérer le template email-parser
        const template = await supabaseService.getWorkflowTemplate('email-parser');
        const workflowJson = typeof template.template_json === 'string'
            ? JSON.parse(template.template_json)
            : template.template_json;

        console.log('✅ Template récupéré');

        // 3. Construire le workflow avec HTTP Request
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

                // Node 2: Get Valid Access Token from our API
                {
                    name: 'Get Access Token',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [450, 300],
                    parameters: {
                        url: `http://localhost:3000/api/token/gmail/${tenantId}`,
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
                        url: '=https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:*@leboncoin.fr OR from:*@seloger.com&maxResults=10',
                        method: 'GET',
                        authentication: 'none',
                        options: {
                            queryParameters: {
                                parameters: [
                                    {
                                        name: 'access_token',
                                        value: '={{ $json.access_token }}'
                                    }
                                ]
                            }
                        }
                    }
                },

                // Node 4: Split Messages
                {
                    name: 'Split Messages',
                    type: 'n8n-nodes-base.splitInBatches',
                    typeVersion: 3,
                    position: [850, 300],
                    parameters: {
                        batchSize: 1,
                        options: {}
                    }
                },

                // Node 5: Get Message Details
                {
                    name: 'Get Message Details',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [1050, 300],
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

                // Node 6: Extract Email Body
                {
                    name: 'Extract Email Body',
                    type: 'n8n-nodes-base.code',
                    typeVersion: 2,
                    position: [1250, 300],
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

                // Ajouter les autres nodes du template (OpenAI Parser, etc.)
                ...workflowJson.nodes.slice(1).map((node, index) => ({
                    ...node,
                    position: [1450 + (index * 200), 300]
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
                    main: [[{ node: 'Split Messages', type: 'main', index: 0 }]]
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

        console.log('📤 Création du workflow dans n8n...');

        const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId);

        console.log(`✅ Workflow créé avec succès!`);
        console.log(`   ID: ${createdWorkflow.id}`);
        console.log(`   Nom: ${createdWorkflow.name}`);
        console.log(`   Status: Actif`);

        // Sauvegarder l'ID du workflow dans Supabase
        await supabaseService.supabase
            .from('tenants')
            .update({ n8n_workflow_id: createdWorkflow.id })
            .eq('tenant_id', tenantId);

        console.log('✅ Workflow ID sauvegardé dans Supabase');

        console.log(`\n🎉 TERMINÉ!`);
        console.log(`\n📊 Résumé:`);
        console.log(`   • Tenant: ${tenantId}`);
        console.log(`   • Workflow ID: ${createdWorkflow.id}`);
        console.log(`   • Token API: http://localhost:3000/api/token/gmail/${tenantId}`);
        console.log(`   • Le workflow vérifie les emails toutes les minutes`);
        console.log(`   • Les tokens sont automatiquement refreshés si expirés`);

        return createdWorkflow;

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        throw error;
    }
}

// Exécution
const tenantId = process.argv[2] || 'test-tenant-001';
createGmailWorkflowFinal(tenantId);
