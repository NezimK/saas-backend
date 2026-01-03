/**
 * Crée un workflow qui récupère les tokens directement depuis Supabase
 * SANS passer par l'API backend - pour le développement
 */

require('dotenv').config();
const supabaseService = require('./services/supabaseService');
const n8nService = require('./services/n8nService');

async function createWorkflowNoBackend(tenantId) {
    try {
        console.log(`📋 Création du workflow Gmail (sans backend API) pour: ${tenantId}\n`);

        const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        if (!tenant || !tenant.email_oauth_tokens) {
            throw new Error(`Tenant ${tenantId} n'a pas de tokens OAuth`);
        }

        console.log('✅ Tenant trouvé avec tokens OAuth');

        // Workflow simplifié qui utilise les tokens directement
        const workflow = {
            name: `Email Parser Direct - ${tenantId}`,
            nodes: [
                // Schedule Trigger
                {
                    name: 'Schedule',
                    type: 'n8n-nodes-base.scheduleTrigger',
                    typeVersion: 1,
                    position: [250, 300],
                    parameters: {
                        rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] }
                    }
                },

                // List Gmail Messages avec token en dur (pour dev)
                {
                    name: 'List Gmail Messages',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [450, 300],
                    parameters: {
                        url: `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from:alimekzine@emkai.fr&maxResults=10&access_token=${tenant.email_oauth_tokens.access_token}`,
                        method: 'GET',
                        authentication: 'none'
                    }
                },

                // Check if messages exist
                {
                    name: 'Check Messages',
                    type: 'n8n-nodes-base.if',
                    typeVersion: 2,
                    position: [650, 300],
                    parameters: {
                        conditions: {
                            options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
                            conditions: [{
                                leftValue: '={{ $json.messages }}',
                                rightValue: '',
                                operator: { type: 'array', operation: 'notEmpty' }
                            }],
                            combineOperation: 'all'
                        }
                    }
                },

                // Split Messages
                {
                    name: 'Split Messages',
                    type: 'n8n-nodes-base.splitInBatches',
                    typeVersion: 3,
                    position: [850, 200],
                    parameters: { batchSize: 1 }
                },

                // Get Message Details
                {
                    name: 'Get Message Details',
                    type: 'n8n-nodes-base.httpRequest',
                    typeVersion: 4,
                    position: [1050, 200],
                    parameters: {
                        url: `=https://gmail.googleapis.com/gmail/v1/users/me/messages/{{ $json.messages[0].id }}?format=full&access_token=${tenant.email_oauth_tokens.access_token}`,
                        method: 'GET',
                        authentication: 'none'
                    }
                }
            ],

            connections: {
                'Schedule': { main: [[{ node: 'List Gmail Messages', type: 'main', index: 0 }]] },
                'List Gmail Messages': { main: [[{ node: 'Check Messages', type: 'main', index: 0 }]] },
                'Check Messages': { main: [[{ node: 'Split Messages', type: 'main', index: 0 }], []] },
                'Split Messages': { main: [[{ node: 'Get Message Details', type: 'main', index: 0 }]] }
            },

            settings: {}
        };

        console.log('📤 Création du workflow dans n8n...');
        const createdWorkflow = await n8nService.createWorkflow(workflow, tenantId);

        console.log(`✅ Workflow créé: ${createdWorkflow.id}`);
        console.log(`\n⚠️  NOTE: Ce workflow utilise le token en dur - pour dev seulement`);
        console.log(`   Le token expire le: ${new Date(tenant.email_oauth_tokens.expiry_date).toISOString()}`);

        return createdWorkflow;

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        throw error;
    }
}

const tenantId = process.argv[2] || 'test-tenant-001';
createWorkflowNoBackend(tenantId);
