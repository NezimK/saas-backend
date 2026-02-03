const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const authService = require('../services/authService');
const magicLinkService = require('../services/magicLinkService');
const emailService = require('../services/emailService');

// Stripe will be initialized when the module loads
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  console.warn('⚠️ Stripe SDK not installed or STRIPE_SECRET_KEY not set');
}

// Mapping plans → Stripe price IDs (à configurer dans .env après création dans Stripe Dashboard)
const PRICE_IDS = {
  essentiel: process.env.STRIPE_PRICE_ESSENTIEL,
  avance: process.env.STRIPE_PRICE_AVANCE,
  premium: process.env.STRIPE_PRICE_PREMIUM
};

// Plan details for validation
const VALID_PLANS = ['essentiel', 'avance', 'premium'];

// Limites par plan
const PLAN_LIMITS = {
  essentiel: { monthly_conversation_limit: 600, max_users: 3 },
  avance: { monthly_conversation_limit: 1500, max_users: 6 },
  premium: { monthly_conversation_limit: 3000, max_users: -1 } // -1 = illimité
};

/**
 * POST /api/stripe/create-checkout-session
 * Crée une session Stripe Checkout pour le paiement d'un abonnement
 */
router.post('/create-checkout-session', async (req, res) => {
  try {
    // Vérifier que Stripe est configuré
    if (!stripe) {
      return res.status(500).json({
        error: 'Stripe non configuré. Veuillez contacter le support.'
      });
    }

    const { email, companyName, responsableName, accountType, plan } = req.body;

    // Validation des champs requis
    if (!email || !companyName || !accountType || !plan) {
      return res.status(400).json({
        error: 'Tous les champs sont requis (email, companyName, accountType, plan)'
      });
    }

    // Validation du nom du responsable pour les agences
    if (accountType === 'agence' && !responsableName) {
      return res.status(400).json({
        error: 'Le nom et prénom du responsable est requis pour une agence'
      });
    }

    // Validation du plan
    if (!VALID_PLANS.includes(plan)) {
      return res.status(400).json({ error: 'Plan invalide' });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email invalide' });
    }

    // Validation du type de compte
    if (!['agence', 'independant'].includes(accountType)) {
      return res.status(400).json({ error: 'Type de compte invalide' });
    }

    // Vérifier si un utilisateur existe déjà avec cet email
    const { data: existingUsers } = await supabaseService.supabase
      .from('users')
      .select('id, email')
      .eq('email', email.toLowerCase());

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        error: 'Un compte existe déjà avec cet email. Veuillez vous connecter ou utiliser un autre email.'
      });
    }

    // Récupérer le price ID pour le plan choisi
    const priceId = PRICE_IDS[plan];
    console.log(`📋 Plan demandé: ${plan}, Price ID: ${priceId}`);
    console.log('📋 PRICE_IDS disponibles:', PRICE_IDS);

    if (!priceId) {
      console.error(`Price ID non configuré pour le plan: ${plan}`);
      return res.status(500).json({
        error: 'Configuration du plan manquante. Veuillez contacter le support.'
      });
    }

    // URLs de redirection
    const successUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/payment-success.html?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${process.env.FRONTEND_URL || 'https://www.emkai.fr'}/checkout.html?plan=${plan}&canceled=true`;

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        companyName: companyName,
        responsableName: responsableName || '',
        accountType: accountType,
        plan: plan,
        source: 'emkai_website'
      },
      // Options supplémentaires pour une meilleure UX
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      locale: 'fr'
    });

    console.log(`✅ Stripe Checkout session créée: ${session.id} pour ${email} (plan: ${plan})`);

    res.json({
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('❌ Erreur création session Stripe:', error);

    // Erreurs Stripe spécifiques
    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        error: 'Erreur de configuration Stripe. Veuillez contacter le support.'
      });
    }

    res.status(500).json({
      error: 'Une erreur est survenue lors de la création de la session de paiement'
    });
  }
});

/**
 * POST /api/stripe/webhook
 * Reçoit les événements Stripe (checkout.session.completed, etc.)
 * IMPORTANT: Ce endpoint doit recevoir le body brut (express.raw)
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    if (!stripe) {
      console.error('Stripe non configuré pour le webhook');
      return res.status(500).send('Webhook Error: Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET non configuré');
      return res.status(500).send('Webhook Error: Secret not configured');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('❌ Signature webhook invalide:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Traiter les différents types d'événements
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log('✅ Paiement réussi:', session.id);
        console.log('   Customer:', session.customer_email);
        console.log('   Metadata:', session.metadata);

        try {
          // 1. Vérifier si un tenant existe déjà avec cet email
          const { data: existingTenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('email', session.customer_email.toLowerCase())
            .single();

          let tenant;

          // Récupérer les limites du plan
          const planLimits = PLAN_LIMITS[session.metadata.plan] || PLAN_LIMITS.essentiel;

          if (existingTenant) {
            // Mettre à jour le tenant existant avec les infos Stripe
            const { data: updatedTenant, error: updateError } = await supabaseService.supabase
              .from('tenants')
              .update({
                company_name: session.metadata.companyName,
                responsable_name: session.metadata.responsableName || null,
                account_type: session.metadata.accountType,
                plan: session.metadata.plan,
                monthly_conversation_limit: planLimits.monthly_conversation_limit,
                max_users: planLimits.max_users,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                status: 'pending_onboarding'
              })
              .eq('tenant_id', existingTenant.tenant_id)
              .select()
              .single();

            if (updateError) throw updateError;
            tenant = updatedTenant;
            console.log('📝 Tenant existant mis à jour:', tenant.tenant_id);
          } else {
            // Créer un nouveau tenant
            tenant = await supabaseService.createTenant({
              email: session.customer_email.toLowerCase(),
              company_name: session.metadata.companyName,
              responsable_name: session.metadata.responsableName || null,
              account_type: session.metadata.accountType,
              plan: session.metadata.plan,
              monthly_conversation_limit: planLimits.monthly_conversation_limit,
              max_users: planLimits.max_users,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription,
              status: 'pending_onboarding'
            });
            console.log('🆕 Nouveau tenant créé:', tenant.tenant_id);
          }

          // 2. Vérifier si un utilisateur existe déjà
          const { data: existingUser } = await supabaseService.supabase
            .from('users')
            .select('*')
            .eq('email', session.customer_email.toLowerCase())
            .single();

          let user;

          if (existingUser) {
            user = existingUser;
            console.log('👤 Utilisateur existant:', user.id);
          } else {
            // Créer l'utilisateur manager SANS mot de passe
            user = await authService.createUserWithoutPassword(tenant.tenant_id, {
              email: session.customer_email,
              companyName: session.metadata.companyName,
              role: 'manager'
            });
            console.log('👤 Nouvel utilisateur créé:', user.id);
          }

          // 3. Générer le magic link
          const magicLink = await magicLinkService.generateMagicLink(user.id);
          console.log('🔗 Magic link généré pour', session.customer_email);

          // 4. Envoyer l'email
          const emailResult = await emailService.sendMagicLinkEmail(
            session.customer_email,
            magicLink,
            session.metadata.companyName
          );

          if (emailResult.success) {
            console.log('📧 Email magic link envoyé avec succès');
          } else {
            console.error('❌ Erreur envoi email:', emailResult.error);
          }

        } catch (err) {
          console.error('❌ Erreur traitement checkout.session.completed:', err);
          // Ne pas faire échouer le webhook même si le traitement échoue
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        console.log('📝 Abonnement mis à jour:', subscription.id);
        // TODO: Mettre à jour le plan du tenant
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        console.log('🚫 Abonnement annulé:', subscription.id);
        // TODO: Désactiver le tenant ou mettre en pause
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        console.log('❌ Paiement échoué:', invoice.id);
        // TODO: Notifier le client, suspendre le compte après X échecs
        break;
      }

      default:
        console.log(`⚠️ Événement Stripe non géré: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('❌ Erreur webhook Stripe:', error);
    res.status(500).send('Webhook Error');
  }
});

/**
 * GET /api/stripe/session/:sessionId
 * Récupère les détails d'une session Stripe (pour pré-remplir l'onboarding)
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe non configuré' });
    }

    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID requis' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Ne retourner que les infos nécessaires pour l'onboarding
    res.json({
      email: session.customer_email,
      companyName: session.metadata?.companyName,
      accountType: session.metadata?.accountType,
      plan: session.metadata?.plan,
      paymentStatus: session.payment_status,
      customerId: session.customer,
      subscriptionId: session.subscription
    });

  } catch (error) {
    console.error('❌ Erreur récupération session Stripe:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    res.status(500).json({ error: 'Erreur lors de la récupération de la session' });
  }
});

/**
 * POST /api/stripe/create-portal-session
 * Crée une session Customer Portal pour gérer l'abonnement
 */
router.post('/create-portal-session', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe non configuré' });
    }

    const { customerId, returnUrl } = req.body;

    if (!customerId) {
      return res.status(400).json({ error: 'Customer ID requis' });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.DASHBOARD_URL || 'http://localhost:5173'}/settings`
    });

    res.json({ url: portalSession.url });

  } catch (error) {
    console.error('❌ Erreur création portal session:', error);
    res.status(500).json({ error: 'Erreur lors de la création de la session' });
  }
});

/**
 * POST /api/stripe/resend-magic-link
 * Change l'email et renvoie le magic link après un paiement
 */
router.post('/resend-magic-link', async (req, res) => {
  try {
    const { sessionId, newEmail } = req.body;

    if (!sessionId || !newEmail) {
      return res.status(400).json({
        success: false,
        error: 'Session ID et nouvel email requis'
      });
    }

    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Format d\'email invalide'
      });
    }

    // Récupérer la session Stripe
    if (!stripe) {
      return res.status(500).json({
        success: false,
        error: 'Stripe non configuré'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Session de paiement invalide ou non payée'
      });
    }

    const oldEmail = session.customer_email;

    // Chercher l'utilisateur avec l'ancien email
    const { data: user, error: userError } = await supabaseService.supabase
      .from('users')
      .select('*')
      .eq('email', oldEmail)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Utilisateur non trouvé'
      });
    }

    // Vérifier que le nouvel email n'est pas déjà utilisé
    const { data: existingUsers } = await supabaseService.supabase
      .from('users')
      .select('id')
      .eq('email', newEmail);

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cet email est déjà utilisé par un autre compte'
      });
    }

    // Mettre à jour l'email de l'utilisateur
    const { error: updateError } = await supabaseService.supabase
      .from('users')
      .update({ email: newEmail })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Erreur mise à jour email:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour de l\'email'
      });
    }

    // Générer un nouveau magic link
    const magicLink = await magicLinkService.generateMagicLink(user.id);

    // Envoyer l'email au nouvel email
    const emailResult = await emailService.sendMagicLinkEmail(
      newEmail,
      magicLink,
      session.metadata?.companyName || 'votre agence'
    );

    if (!emailResult.success) {
      console.error('❌ Erreur envoi email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'envoi de l\'email'
      });
    }

    console.log(`📧 Magic link renvoyé de ${oldEmail} vers ${newEmail}`);

    res.json({
      success: true,
      message: 'Un email de connexion a été envoyé à votre nouvelle adresse'
    });

  } catch (error) {
    console.error('❌ Erreur resend-magic-link:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du renvoi de l\'email'
    });
  }
});

module.exports = router;
