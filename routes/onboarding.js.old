const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const { createCredential, createWorkflow } = require('../services/n8nService');

router.post('/create-tenant', async (req, res) => {
    try {
        const {
            company_name,
            crm_type,
            crm_api_url,
            crm_api_key,
            openai_api_key,
            whatsapp_phone_number_id,
            whatsapp_access_token
        } = req.body;

        // Générer un tenant_id unique
        const tenant_id = `tenant_${Date.now()}`;

        console.log(`🚀 Création du tenant: ${tenant_id}`);

        // 1. Créer les credentials dans n8n
        const openaiCredId = await createCredential({
            name: `OpenAI - ${company_name}`,
            type: 'openAiApi',
            data: {
                apiKey: openai_api_key
            },
            nodesAccess: [
                { nodeType: '@n8n/n8n-nodes-langchain.openAi' }
            ]
        });

        const whatsappCredId = await createCredential({
            name: `WhatsApp - ${company_name}`,
            type: 'whatsAppApi',
            data: {
                accessToken: whatsapp_access_token
            },
            nodesAccess: [
                { nodeType: 'n8n-nodes-base.whatsApp' }
            ]
        });
        console.log(`✅ Credentials créés`);

        // 2. Récupérer le template et créer le workflow
        const template = await supabaseService.getWorkflowTemplate('email-parser');

        // template_json peut être soit une string, soit déjà un objet
        const workflowJson = typeof template.template_json === 'string'
            ? JSON.parse(template.template_json)
            : template.template_json;

        const workflow = await createWorkflow(workflowJson, tenant_id);

        console.log(`✅ Workflow créé: ${workflow.id}`);

        // 3. Enregistrer le tenant dans Supabase
        const tenant = await supabaseService.createTenant({
            tenant_id,
            company_name,
            crm_type,
            crm_api_url,
            crm_api_key,
            workflow_id: workflow.id,
            webhook_url: `https://n8n.emkai.fr/webhook/email-${tenant_id}`,
            openai_credential_id: openaiCredId,
            whatsapp_credential_id: whatsappCredId
        });

        console.log(`✅ Tenant enregistré dans Supabase`);

        res.json({
            success: true,
            tenant_id,
            webhook_url: tenant.webhook_url,
            dashboard_url: `https://ton-dashboard.com/login?tenant=${tenant_id}`
        });

    } catch (error) {
        console.error('❌ Erreur:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;