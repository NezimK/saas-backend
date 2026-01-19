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
async function createWorkflow(workflowTemplate, tenantId, projectId = null) {
    try {
        console.log('🔍 [DEBUG n8nService.createWorkflow] Début');
        console.log('🔍 [DEBUG] workflowTemplate.name reçu:', workflowTemplate.name);

        // Clone le template
        const workflow = JSON.parse(JSON.stringify(workflowTemplate));
        console.log('🔍 [DEBUG] workflow.name après clone:', workflow.name);

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

        console.log('🔍 [DEBUG] cleanWorkflow.name après nettoyage:', cleanWorkflow.name);

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

        // Personnalise le webhook path si c'est un webhook trigger (premier node)
        if (tenantId && cleanWorkflow.nodes && cleanWorkflow.nodes[0] && cleanWorkflow.nodes[0].parameters) {
            // Si le premier node a un path (webhook), le personnaliser
            if (cleanWorkflow.nodes[0].parameters.path !== undefined) {
                cleanWorkflow.nodes[0].parameters.path = `email-${tenantId}`;
            }
        }

        // Ajouter le projectId si fourni
        if (projectId) {
            cleanWorkflow.projectId = projectId;
            console.log(`📁 Workflow sera créé dans le dossier: ${projectId}`);
        }

        console.log('🔍 [DEBUG] cleanWorkflow.name FINAL avant envoi à n8n:', cleanWorkflow.name);
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

// Créer ou récupérer un dossier (project) pour un tenant
async function createOrGetProjectFolder(companyName, tenantId) {
    try {
        console.log(`📁 Création/Récupération du dossier n8n pour: ${companyName}`);

        // Nom du dossier
        const folderName = companyName || `Client-${tenantId.substring(0, 8)}`;

        // 1. Vérifier si le dossier existe déjà
        const { data: projects } = await n8nAPI.get('/projects');
        const existingProject = projects.find(p => p.name === folderName);

        if (existingProject) {
            console.log(`✅ Dossier existant trouvé: ${existingProject.name} (ID: ${existingProject.id})`);
            return existingProject;
        }

        // 2. Créer un nouveau dossier
        const { data: newProject } = await n8nAPI.post('/projects', {
            name: folderName,
            type: 'team' // ou 'personal' selon la version n8n
        });

        console.log(`✅ Nouveau dossier créé: ${newProject.name} (ID: ${newProject.id})`);
        return newProject;

    } catch (error) {
        console.error('❌ Erreur création/récupération dossier:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        // Si l'API projects n'existe pas (404) ou nécessite une licence (403), retourner null
        if (error.response?.status === 404 || error.response?.status === 403) {
            console.log('⚠️  API projects non disponible (nécessite licence Enterprise) - workflows créés sans dossier');
            return null;
        }

        throw new Error(`Erreur dossier n8n: ${error.response?.data?.message || error.message}`);
    }
}

module.exports = { createCredential, createWorkflow, createOrGetProjectFolder };