require('dotenv').config();
const supabaseService = require('./services/supabaseService');
const n8nService = require('./services/n8nService');

async function createGmailWorkflowWithHttp(tenantId) {
    try {
        console.log(`📋 Création du workflow Gmail pour: ${tenantId}\n`);

        // 1. Récupérer le template
        const template = await supabaseService.getWorkflowTemplate('email-parser');
        const workflowJson = typeof template.template_json === 'string'
            ? JSON.parse(template.template_json)
            : template.template_json;

        // 2. Récupérer les tokens du tenant
        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (!tenant || !tenant.email_oauth_tokens) {
            throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth. Connectez Gmail d'abord.`);
        }

        console.log('✅ Tokens OAuth trouvés pour le tenant');

        // 3. Créer un workflow avec Schedule Trigger + HTTP Request pour Gmail API
        const newWorkflow = {
            name: `Email Parser (HTTP) - ${tenantId}`,
            nodes: [
                // Node 1: Schedule Trigger (poll emails every minute)
                {
                    name: 'Schedule Trigger',
                    type: 'n8n-nodes-base.scheduleTrigger',
                    typeVersion: 1,
                    position: [250, 300],
                    parameters: {
                        rule: {
                            interval: [
                                {
                                    field: 'minutes',
                                    minutesInterval: 1
                                }
                            ]
                        }
                    }
                },
                // Node 2: HTTP Request to Gmail API
                {
                    name: 'Get Gmail Messages',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [450, 300],
                    parameters: {
                        url: '=https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:*@leboncoin.fr OR from:*@seloger.com&maxResults=10',
                        authentication: 'genericCredentialType',
                        genericAuthType: 'oAuth2Api',
                        options: {
                            queryParameters: {
                                parameters: [
                                    {
                                        name: 'access_token',
                                        value: tenant.email_oauth_tokens.access_token
                                    }
                                ]
                            }
                        }
                    }
                },
                // Node 3: Loop Over Messages
                {
                    name: 'Loop Messages',
                    type: 'n8n-nodes-base.splitInBatches',
                    typeVersion: 3,
                    position: [650, 300],
                    parameters: {
                        batchSize: 1,
                        options: {}
                    }
                },
                // Node 4: Get Message Details
                {
                    name: 'Get Message Details',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [850, 300],
                    parameters: {
                        url: '=https://gmail.googleapis.com/gmail/v1/users/me/messages/{{$json["id"]}}?format=full',
                        authentication: 'none',
                        options: {
                            queryParameters: {
                                parameters: [
                                    {
                                        name: 'access_token',
                                        value: tenant.email_oauth_tokens.access_token
                                    }
                                ]
                            }
                        }
                    }
                },
                // Nodes suivants du template (OpenAI Parser, JSON Parser, Airtable)
                ...workflowJson.nodes.slice(1).map((node, index) => ({
                    ...node,
                    position: [1050 + (index * 200), 300]
                }))
            ],
            connections: {
                'Schedule Trigger': {
                    main: [[{ node: 'Get Gmail Messages', type: 'main', index: 0 }]]
                },
                'Get Gmail Messages': {
                    main: [[{ node: 'Loop Messages', type: 'main', index: 0 }]]
                },
                'Loop Messages': {
                    main: [[{ node: 'Get Message Details', type: 'main', index: 0 }]]
                },
                'Get Message Details': {
                    main: [[{ node: workflowJson.nodes[1].name, type: 'main', index: 0 }]]
                },
                // Garder les connexions du template pour les nodes suivants
                ...Object.fromEntries(
                    Object.entries(workflowJson.connections || {})
                        .filter(([key]) => key !== workflowJson.nodes[0].name)
                )
            },
            settings: workflowJson.settings || {}
        };

        console.log('📤 Création du workflow dans n8n...');

        const workflow = await n8nService.createWorkflow(newWorkflow, tenantId);

        console.log(`✅ Workflow créé avec succès!`);
        console.log(`   ID: ${workflow.id}`);
        console.log(`   Nom: ${workflow.name}`);
        console.log(`   Status: Actif`);

        // Sauvegarder l'ID du workflow dans Supabase
        await supabaseService.supabase
            .from('tenants')
            .update({ n8n_workflow_id: workflow.id })
            .eq('tenant_id', tenantId);

        console.log('✅ Workflow ID sauvegardé dans Supabase');

        return workflow;

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        throw error;
    }
}

// Test
const tenantId = process.argv[2] || 'test-tenant-001';
createGmailWorkflowWithHttp(tenantId);
