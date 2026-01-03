/**
 * Met à jour le filtre d'email dans un workflow existant
 * Usage: node update-workflow-filter.js <workflowId> <emailFilter>
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

async function updateWorkflowFilter(workflowId, emailFilter) {
    try {
        console.log(`\n🔧 Mise à jour du workflow: ${workflowId}`);
        console.log(`📧 Nouveau filtre: ${emailFilter}\n`);

        // 1. Récupérer le workflow actuel
        console.log('1️⃣  Récupération du workflow...');
        const { data: workflow } = await n8nAPI.get(`/workflows/${workflowId}`);
        console.log(`✅ Workflow récupéré: ${workflow.name}`);

        // 2. Trouver et mettre à jour le node "List Gmail Messages"
        console.log('\n2️⃣  Mise à jour du filtre...');
        const updatedNodes = workflow.nodes.map(node => {
            if (node.name === 'List Gmail Messages') {
                console.log(`   Ancien URL: ${node.parameters.url}`);
                return {
                    ...node,
                    parameters: {
                        ...node.parameters,
                        url: `=https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${emailFilter}&maxResults=10`
                    }
                };
            }
            return node;
        });

        const nodeUpdated = updatedNodes.find(n => n.name === 'List Gmail Messages');
        if (nodeUpdated) {
            console.log(`   Nouveau URL: ${nodeUpdated.parameters.url}`);
        }

        // 3. Mettre à jour le workflow
        console.log('\n3️⃣  Envoi de la mise à jour à n8n...');

        // Nettoyer le workflow (supprimer les champs read-only)
        const allowedWorkflowProps = ['name', 'nodes', 'connections', 'settings'];
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

        console.log(`\n🎉 Le workflow ${workflowId} utilise maintenant le filtre: ${emailFilter}`);

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

// Arguments
const workflowId = process.argv[2];
const emailFilter = process.argv[3];

if (!workflowId || !emailFilter) {
    console.error('❌ Usage: node update-workflow-filter.js <workflowId> <emailFilter>');
    console.error('\nExemples:');
    console.error('  node update-workflow-filter.js Q7Q4ApxKEEjiAgml "from:alimekzine@emkai.fr"');
    console.error('  node update-workflow-filter.js Q7Q4ApxKEEjiAgml "from:*@leboncoin.fr OR from:*@seloger.com"');
    process.exit(1);
}

updateWorkflowFilter(workflowId, emailFilter);
