const axios = require('axios');
require('dotenv').config();

const n8nAPI = axios.create({
    baseURL: process.env.N8N_API_URL,
    headers: {
        'X-N8N-API-KEY': process.env.N8N_API_KEY,
        'Content-Type': 'application/json'
    }
});

// Créer un credential dans n8n
async function createCredential(type, name, data) {
    try {
        const payload = {
            name,
            type,
            data
        };

        console.log(`🔑 Création credential: ${name} (${type})`);

        const { data: result } = await n8nAPI.post('/credentials', payload);

        console.log(`✅ Credential créé: ${result.id}`);

        return result;
    } catch (error) {
        console.error('❌ Erreur création credential:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        throw new Error(`Erreur création credential: ${error.response?.data?.message || error.message}`);
    }
}

// Créer un workflow depuis un template
async function createWorkflow(workflowTemplate, tenantId) {
    try {
        // Clone le template
        const workflow = JSON.parse(JSON.stringify(workflowTemplate));

        // Liste des propriétés autorisées pour la création d'un workflow
        const allowedWorkflowProps = ['name', 'nodes', 'connections', 'settings'];
        const allowedNodeProps = ['name', 'type', 'position', 'parameters', 'typeVersion', 'credentials'];

        // Nettoie le workflow : garde uniquement les propriétés autorisées
        const cleanWorkflow = {};
        allowedWorkflowProps.forEach(prop => {
            if (workflow[prop] !== undefined) {
                cleanWorkflow[prop] = workflow[prop];
            }
        });

        // Nettoie les nodes : garde uniquement les propriétés autorisées
        if (cleanWorkflow.nodes) {
            cleanWorkflow.nodes = cleanWorkflow.nodes.map(node => {
                const cleanNode = {};
                allowedNodeProps.forEach(prop => {
                    if (node[prop] !== undefined) {
                        cleanNode[prop] = node[prop];
                    }
                });
                return cleanNode;
            });
        }

        // S'assure que connections existe
        if (!cleanWorkflow.connections) {
            cleanWorkflow.connections = {};
        }

        // Nettoie settings : garde uniquement les propriétés autorisées
        if (cleanWorkflow.settings) {
            const allowedSettingsProps = ['executionOrder', 'saveDataErrorExecution', 'saveDataSuccessExecution', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow'];
            const cleanSettings = {};
            allowedSettingsProps.forEach(prop => {
                if (cleanWorkflow.settings[prop] !== undefined) {
                    cleanSettings[prop] = cleanWorkflow.settings[prop];
                }
            });
            cleanWorkflow.settings = cleanSettings;
        } else {
            cleanWorkflow.settings = {};
        }

        // Personnalise le workflow pour ce tenant
        if (tenantId) {
            cleanWorkflow.name = `Email Parser - ${tenantId}`;
            if (cleanWorkflow.nodes && cleanWorkflow.nodes[0] && cleanWorkflow.nodes[0].parameters) {
                cleanWorkflow.nodes[0].parameters.path = `email-${tenantId}`;
            }
        }

        console.log('📤 Envoi à n8n:', JSON.stringify(cleanWorkflow, null, 2).substring(0, 500) + '...');

        // Crée le workflow dans n8n
        const { data } = await n8nAPI.post('/workflows', cleanWorkflow);

        console.log('✅ Workflow créé avec succès ! ID:', data.id);

        // Active le workflow
        console.log('🔄 Activation du workflow...');
        await n8nAPI.post(`/workflows/${data.id}/activate`);

        console.log('✅ Workflow activé !');

        return data;
    } catch (error) {
        console.error('❌ Erreur n8n détaillée:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        throw new Error(error.response?.data?.message || error.message);
    }
}

module.exports = { createCredential, createWorkflow };