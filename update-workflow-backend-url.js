/**
 * Met à jour l'URL du backend dans le workflow
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

async function updateBackendUrl(workflowId) {
    try {
        const backendUrl = process.env.BACKEND_URL;

        if (!backendUrl) {
            throw new Error('BACKEND_URL non défini dans .env');
        }

        console.log(`\n🔧 Mise à jour du workflow: ${workflowId}`);
        console.log(`🌐 Nouvelle URL backend: ${backendUrl}\n`);

        // 1. Récupérer le workflow
        console.log('1️⃣  Récupération du workflow...');
        const { data: workflow } = await n8nAPI.get(`/workflows/${workflowId}`);
        console.log(`✅ Workflow récupéré: ${workflow.name}`);

        // 2. Trouver le tenant_id dans le nom du workflow
        const tenantIdMatch = workflow.name.match(/- (.+)$/);
        const tenantId = tenantIdMatch ? tenantIdMatch[1] : 'TENANT_ID';

        // 3. Mettre à jour le node "Get Access Token"
        console.log('\n2️⃣  Mise à jour du node "Get Access Token"...');
        const updatedNodes = workflow.nodes.map(node => {
            if (node.name === 'Get Access Token') {
                const oldUrl = node.parameters.url;
                const newUrl = `${backendUrl}/api/token/gmail/${tenantId}`;

                console.log(`   Ancien: ${oldUrl}`);
                console.log(`   Nouveau: ${newUrl}`);

                return {
                    ...node,
                    parameters: {
                        ...node.parameters,
                        url: newUrl
                    }
                };
            }
            return node;
        });

        // 4. Nettoyer et envoyer
        console.log('\n3️⃣  Envoi de la mise à jour...');

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

        console.log(`\n🎉 Le workflow utilise maintenant: ${backendUrl}`);

    } catch (error) {
        console.error('❌ Erreur:', error.response?.data || error.message);
    }
}

const workflowId = process.argv[2] || 'DeTiJsXeRMiXi53c';
updateBackendUrl(workflowId);
