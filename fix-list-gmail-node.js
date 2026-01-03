/**
 * Corrige le node "List Gmail Messages" pour ajouter le token dans les query parameters
 */

require('dotenv').config();
const axios = require('axios');

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

async function fixListGmailNode(workflowId) {
    try {
        console.log(`🔧 Correction du workflow: ${workflowId}\n`);

        // 1. Récupérer le workflow
        const { data: workflow } = await n8nAPI.get(`/workflows/${workflowId}`);
        console.log('✅ Workflow récupéré');

        // 2. Mettre à jour le node "List Gmail Messages"
        const updatedNodes = workflow.nodes.map(node => {
            if (node.name === 'List Gmail Messages') {
                console.log('\n📝 Mise à jour du node "List Gmail Messages"...');
                console.log('   Ancien:', JSON.stringify(node.parameters, null, 2));

                const newNode = {
                    ...node,
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
                };

                console.log('   Nouveau:', JSON.stringify(newNode.parameters, null, 2));
                return newNode;
            }
            return node;
        });

        // 3. Nettoyer et envoyer
        console.log('\n📤 Envoi de la mise à jour...');
        const allowedNodeProps = ['name', 'type', 'position', 'parameters', 'typeVersion', 'credentials'];

        const cleanedNodes = updatedNodes.map(node => {
            const cleanNode = {};
            allowedNodeProps.forEach(prop => {
                if (node[prop] !== undefined) {
                    cleanNode[prop] = node[prop];
                }
            });
            return cleanNode;
        });

        const updatePayload = {
            name: workflow.name,
            nodes: cleanedNodes,
            connections: workflow.connections,
            settings: workflow.settings
        };

        await n8nAPI.put(`/workflows/${workflowId}`, updatePayload);
        console.log('✅ Workflow mis à jour avec succès !');

        console.log('\n🎉 Le node "List Gmail Messages" utilise maintenant le token correctement');

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

const workflowId = process.argv[2] || 'DeTiJsXeRMiXi53c';
fixListGmailNode(workflowId);
