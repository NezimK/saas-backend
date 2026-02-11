const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabaseService');
const authService = require('../services/authService');
const magicLinkService = require('../services/magicLinkService');
const emailService = require('../services/emailService');
const { authMiddleware, requireRole } = require('../middlewares/authMiddleware');
const logger = require('../services/logger');

// Stripe will be initialized when the module loads
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  }
} catch (error) {
  logger.warn('stripe', 'Stripe SDK not installed or STRIPE_SECRET_KEY not set');
}

// Mapping plans → Stripe price IDs (à configurer dans .env après création dans Stripe Dashboard)
const PRICE_IDS = {
  essentiel: process.env.STRIPE_PRICE_ESSENTIEL,
  avance: process.env.STRIPE_PRICE_AVANCE,
  premium: process.env.STRIPE_PRICE_PREMIUM
};

const { VALID_PLANS, PLAN_LIMITS } = require('../config/constants');

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
    logger.info('stripe', `Plan requested: ${plan}, Price ID: ${priceId}`, PRICE_IDS);

    if (!priceId) {
      logger.error('stripe', `Price ID non configure pour le plan: ${plan}`);
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
      locale: 'fr',
      // Configuration de l'abonnement avec envoi automatique des factures
      subscription_data: {
        description: `Abonnement Emkai - Plan ${plan.charAt(0).toUpperCase() + plan.slice(1)}`,
        metadata: {
          plan: plan,
          companyName: companyName
        }
      }
    });

    logger.info('stripe', `Checkout session created: ${session.id} for ${email} (plan: ${plan})`);

    res.json({
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    logger.error('stripe', 'Erreur creation session Stripe', error.message);

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
      logger.error('stripe', 'Stripe non configure pour le webhook');
      return res.status(500).send('Webhook Error: Stripe not configured');
    }

    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      logger.error('stripe', 'STRIPE_WEBHOOK_SECRET non configure');
      return res.status(500).send('Webhook Error: Secret not configured');
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      logger.error('stripe', 'Signature webhook invalide', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Traiter les différents types d'événements
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        logger.info('stripe', `Paiement réussi : ${session.id}`, { customer: session.customer_email, metadata: session.metadata });

        try {
          // Mettre à jour le customer Stripe pour activer l'envoi des factures par email
          if (session.customer) {
            await stripe.customers.update(session.customer, {
              name: session.metadata.companyName,
              metadata: {
                companyName: session.metadata.companyName,
                accountType: session.metadata.accountType,
                plan: session.metadata.plan
              },
              invoice_settings: {
                custom_fields: null,
                footer: 'Merci pour votre confiance ! - Emkai'
              }
            });
            logger.info('stripe', 'Customer Stripe mis à jour avec les paramètres de facturation');
          }
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
            logger.info('stripe', `Tenant existant mis à jour : ${tenant.tenant_id}`);
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
            logger.info('stripe', `Nouveau tenant créé : ${tenant.tenant_id}`);
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
            logger.info('stripe', `Utilisateur existant: ${user.id}`);
          } else {
            // Créer l'utilisateur manager SANS mot de passe
            user = await authService.createUserWithoutPassword(tenant.tenant_id, {
              email: session.customer_email,
              companyName: session.metadata.companyName,
              role: 'manager'
            });
            logger.info('stripe', `Nouvel utilisateur créé : ${user.id}`);
          }

          // 3. Générer le magic link + onboarding token
          const magicLink = await magicLinkService.generateMagicLink(user.id);
          const onboardingToken = authService.generateOnboardingToken(tenant.tenant_id);
          const magicLinkWithOnboarding = `${magicLink}&onboardingToken=${onboardingToken}`;
          logger.info('stripe', `Magic link + onboarding token generes pour ${session.customer_email}`);

          // 4. Envoyer l'email
          const emailResult = await emailService.sendMagicLinkEmail(
            session.customer_email,
            magicLinkWithOnboarding,
            session.metadata.companyName
          );

          if (emailResult.success) {
            logger.info('stripe', 'Email magic link envoye avec succes');
          } else {
            logger.error('stripe', 'Erreur envoi email', emailResult.error);
          }

        } catch (err) {
          logger.error('stripe', 'Erreur traitement checkout.session.completed', err.message);
          // Ne pas faire échouer le webhook même si le traitement échoue
        }

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        logger.info('stripe', `Abonnement mis à jour : ${subscription.id}`, { status: subscription.status, customer: subscription.customer });

        try {
          // Récupérer le tenant par stripe_subscription_id
          const { data: tenant, error: findError } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (findError || !tenant) {
            logger.warn('stripe', `Tenant non trouvé pour subscription : ${subscription.id}`);
            break;
          }

          // Récupérer le plan et les sièges extra depuis les items de la subscription
          let newPlan = tenant.plan; // Garder l'ancien plan par défaut
          let extraSeats = 0;
          const extraSeatPriceId = process.env.STRIPE_PRICE_EXTRA_SEAT;

          for (const item of (subscription.items?.data || [])) {
            const itemPriceId = item.price?.id;
            if (itemPriceId === process.env.STRIPE_PRICE_ESSENTIEL) newPlan = 'essentiel';
            else if (itemPriceId === process.env.STRIPE_PRICE_AVANCE) newPlan = 'avance';
            else if (itemPriceId === process.env.STRIPE_PRICE_PREMIUM) newPlan = 'premium';
            else if (extraSeatPriceId && itemPriceId === extraSeatPriceId) extraSeats = item.quantity || 0;
          }

          const planLimits = PLAN_LIMITS[newPlan] || PLAN_LIMITS.essentiel;
          const maxUsers = planLimits.max_users === -1 ? -1 : planLimits.max_users + extraSeats;

          // Mettre à jour le tenant
          const { error: updateError } = await supabaseService.supabase
            .from('tenants')
            .update({
              plan: newPlan,
              monthly_conversation_limit: planLimits.monthly_conversation_limit,
              max_users: maxUsers,
              subscription_status: subscription.status,
              updated_at: new Date().toISOString()
            })
            .eq('tenant_id', tenant.tenant_id);

          if (updateError) {
            logger.error('stripe', 'Erreur mise a jour tenant', updateError.message);
          } else {
            logger.info('stripe', `Tenant ${tenant.tenant_id} mis à jour : plan=${newPlan}, status=${subscription.status}`);
          }
        } catch (err) {
          logger.error('stripe', 'Erreur traitement subscription.updated', err.message);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        logger.info('stripe', `Abonnement annulé : ${subscription.id}`);

        try {
          // Récupérer le tenant par stripe_subscription_id
          const { data: tenant, error: findError } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('stripe_subscription_id', subscription.id)
            .single();

          if (findError || !tenant) {
            logger.warn('stripe', `Tenant non trouvé pour subscription : ${subscription.id}`);
            break;
          }

          // Mettre le tenant en plan "free" (désactivé)
          const { error: updateError } = await supabaseService.supabase
            .from('tenants')
            .update({
              plan: 'free',
              monthly_conversation_limit: 0,
              max_users: 1,
              subscription_status: 'canceled',
              updated_at: new Date().toISOString()
            })
            .eq('tenant_id', tenant.tenant_id);

          if (updateError) {
            logger.error('stripe', 'Erreur mise a jour tenant', updateError.message);
          } else {
            logger.info('stripe', `Tenant ${tenant.tenant_id} passé en plan free (abonnement annulé)`);
          }
        } catch (err) {
          logger.error('stripe', 'Erreur traitement subscription.deleted', err.message);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        logger.warn('stripe', `Paiement échoué : ${invoice.id}`, { customer: invoice.customer });

        try {
          // Récupérer le tenant par stripe_customer_id
          const { data: tenant } = await supabaseService.supabase
            .from('tenants')
            .select('*')
            .eq('stripe_customer_id', invoice.customer)
            .single();

          if (tenant) {
            // Mettre à jour le statut
            await supabaseService.supabase
              .from('tenants')
              .update({
                subscription_status: 'past_due',
                updated_at: new Date().toISOString()
              })
              .eq('tenant_id', tenant.tenant_id);

            logger.warn('stripe', `Tenant ${tenant.tenant_id} marque comme past_due`);
          }
        } catch (err) {
          logger.error('stripe', 'Erreur traitement invoice.payment_failed', err.message);
        }
        break;
      }

      default:
        logger.warn('stripe', `Evenement Stripe non gere: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    logger.error('stripe', 'Erreur webhook Stripe', error.message);
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

    // Vérifier que la session est récente (< 24h)
    const sessionAge = Date.now() / 1000 - session.created;
    if (sessionAge > 86400) {
      return res.status(400).json({ error: 'Session expirée' });
    }

    // Ne retourner que les infos nécessaires pour l'onboarding (pas de IDs Stripe)
    res.json({
      email: session.customer_email,
      companyName: session.metadata?.companyName,
      accountType: session.metadata?.accountType,
      plan: session.metadata?.plan,
      paymentStatus: session.payment_status
    });

  } catch (error) {
    logger.error('stripe', 'Erreur recuperation session Stripe', error.message);

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(404).json({ error: 'Session non trouvée' });
    }

    res.status(500).json({ error: 'Erreur lors de la récupération de la session' });
  }
});

/**
 * GET /api/stripe/subscription
 * Récupère les informations d'abonnement du tenant connecté
 */
router.get('/subscription', authMiddleware, requireRole('manager', 'admin'), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    logger.info('stripe', `Recuperation subscription pour tenantId: ${tenantId}`);

    // Récupérer les infos du tenant (sélection de toutes les colonnes pour éviter les erreurs si certaines n'existent pas)
    const { data: tenant, error: tenantError } = await supabaseService.supabase
      .from('tenants')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();

    if (tenantError) {
      logger.error('stripe', 'Erreur Supabase recuperation tenant', tenantError.message);
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    if (!tenant) {
      logger.error('stripe', `Tenant non trouvé pour tenantId : ${tenantId}`);
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    logger.info('stripe', `Tenant trouve: ${tenant.company_name} - Plan: ${tenant.plan}`);

    // Compter le nombre d'utilisateurs actifs
    const { count: userCount } = await supabaseService.supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    // Récupérer les détails de l'abonnement Stripe si disponible
    let stripeSubscription = null;
    if (stripe && tenant.stripe_subscription_id) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
      } catch (stripeError) {
        logger.warn('stripe', 'Impossible de recuperer l\'abonnement Stripe', stripeError.message);
      }
    }

    res.json({
      success: true,
      subscription: {
        plan: tenant.plan || 'free',
        status: tenant.subscription_status || stripeSubscription?.status || 'active',
        conversationsLimit: tenant.monthly_conversation_limit || 0,
        conversationsUsed: tenant.current_month_usage || 0,
        usersLimit: tenant.max_users || 1,
        usersCount: userCount || 1,
        currentPeriodEnd: stripeSubscription?.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : null,
        cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end || false,
        hasStripeCustomer: !!tenant.stripe_customer_id
      }
    });

  } catch (error) {
    logger.error('stripe', 'Erreur GET /api/stripe/subscription', error.message);
    res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

/**
 * POST /api/stripe/create-upgrade-session
 * Crée une session Stripe Checkout pour changer de plan (upgrade ou downgrade)
 * Utilise le Subscription Update mode de Stripe Checkout
 */
router.post('/create-upgrade-session', authMiddleware, requireRole('manager', 'admin'), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe non configuré' });
    }

    const { newPlan } = req.body;
    const tenantId = req.user.tenantId;

    // Valider le plan demandé
    if (!VALID_PLANS.includes(newPlan)) {
      return res.status(400).json({ success: false, error: 'Plan invalide' });
    }

    // Récupérer le tenant avec ses infos Stripe
    const { data: tenant, error: tenantError } = await supabaseService.supabase
      .from('tenants')
      .select('stripe_customer_id, stripe_subscription_id, plan, email')
      .eq('tenant_id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    if (!tenant.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'Aucun abonnement actif. Veuillez d\'abord souscrire à un plan.'
      });
    }

    // Vérifier que le plan est différent
    if (tenant.plan === newPlan) {
      return res.status(400).json({
        success: false,
        error: 'Vous êtes déjà sur ce plan'
      });
    }

    // Récupérer le price ID du nouveau plan
    const newPriceId = PRICE_IDS[newPlan];
    if (!newPriceId) {
      return res.status(500).json({
        success: false,
        error: 'Configuration du plan manquante'
      });
    }

    // Récupérer l'abonnement actuel pour obtenir l'item ID du plan (pas du siège extra)
    const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);
    const extraSeatPriceId = process.env.STRIPE_PRICE_EXTRA_SEAT;

    // Trouver l'item du plan principal (pas le siège supplémentaire)
    const planItem = subscription.items.data.find(
      item => !extraSeatPriceId || item.price.id !== extraSeatPriceId
    );
    const subscriptionItemId = planItem ? planItem.id : subscription.items.data[0].id;

    // Compter les sièges extra existants
    let extraSeats = 0;
    if (extraSeatPriceId) {
      const extraSeatItem = subscription.items.data.find(item => item.price.id === extraSeatPriceId);
      if (extraSeatItem) extraSeats = extraSeatItem.quantity || 0;
    }

    // Mettre à jour l'abonnement avec le nouveau prix
    // Stripe gère automatiquement le prorata
    const updatedSubscription = await stripe.subscriptions.update(tenant.stripe_subscription_id, {
      items: [{
        id: subscriptionItemId,
        price: newPriceId
      }],
      proration_behavior: 'create_prorations', // Calcul automatique du prorata
      metadata: {
        previous_plan: tenant.plan,
        new_plan: newPlan,
        changed_at: new Date().toISOString()
      }
    });

    // Mettre à jour le tenant dans la base de données (préserver les sièges extra)
    const planLimits = PLAN_LIMITS[newPlan];
    const maxUsers = planLimits.max_users === -1 ? -1 : planLimits.max_users + extraSeats;
    await supabaseService.supabase
      .from('tenants')
      .update({
        plan: newPlan,
        monthly_conversation_limit: planLimits.monthly_conversation_limit,
        max_users: maxUsers,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    logger.info('stripe', `Plan change pour tenant ${tenantId}: ${tenant.plan} -> ${newPlan}`);

    res.json({
      success: true,
      message: `Plan changé avec succès vers ${newPlan}`,
      subscription: {
        plan: newPlan,
        status: updatedSubscription.status
      }
    });

  } catch (error) {
    logger.error('stripe', 'Erreur changement de plan', error.message);

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        error: 'Erreur lors du changement de plan. Veuillez réessayer.'
      });
    }

    res.status(500).json({ success: false, error: 'Erreur lors du changement de plan' });
  }
});

/**
 * POST /api/stripe/create-portal-session
 * Crée une session Customer Portal pour gérer l'abonnement
 * Protégé par authentification - utilise le tenant de l'utilisateur connecté
 */
router.post('/create-portal-session', authMiddleware, requireRole('manager', 'admin'), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe non configuré' });
    }

    const tenantId = req.user.tenantId;

    // Récupérer le stripe_customer_id du tenant
    const { data: tenant, error: tenantError } = await supabaseService.supabase
      .from('tenants')
      .select('stripe_customer_id')
      .eq('tenant_id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    if (!tenant.stripe_customer_id) {
      return res.status(400).json({
        success: false,
        error: 'Aucun abonnement Stripe associé à ce compte'
      });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: `${process.env.DASHBOARD_URL || 'http://localhost:5173'}/settings`
    });

    res.json({ success: true, url: portalSession.url });

  } catch (error) {
    logger.error('stripe', 'Erreur creation portal session', error.message);
    res.status(500).json({ success: false, error: 'Erreur lors de la création de la session' });
  }
});

/**
 * POST /api/stripe/add-extra-seat
 * Ajoute un siège supplémentaire (15 EUR/mois) à l'abonnement existant
 * Incrémente max_users de 1 dans la table tenants
 */
router.post('/add-extra-seat', authMiddleware, requireRole('manager', 'admin'), async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe non configuré' });
    }

    const tenantId = req.user.tenantId;

    // Récupérer le tenant
    const { data: tenant, error: tenantError } = await supabaseService.supabase
      .from('tenants')
      .select('stripe_customer_id, stripe_subscription_id, plan, max_users')
      .eq('tenant_id', tenantId)
      .single();

    if (tenantError || !tenant) {
      return res.status(404).json({ success: false, error: 'Tenant non trouvé' });
    }

    if (!tenant.stripe_subscription_id) {
      return res.status(400).json({
        success: false,
        error: 'Aucun abonnement actif. Veuillez d\'abord souscrire à un plan.'
      });
    }

    // Premium a déjà des utilisateurs illimités
    if (tenant.max_users === -1) {
      return res.status(400).json({
        success: false,
        error: 'Votre plan Premium inclut déjà des utilisateurs illimités'
      });
    }

    const extraSeatPriceId = process.env.STRIPE_PRICE_EXTRA_SEAT;
    if (!extraSeatPriceId) {
      return res.status(500).json({
        success: false,
        error: 'Configuration du prix siège supplémentaire manquante'
      });
    }

    // Récupérer la subscription Stripe existante
    const subscription = await stripe.subscriptions.retrieve(tenant.stripe_subscription_id);

    // Chercher si un item siège supplémentaire existe déjà
    const existingExtraSeatItem = subscription.items.data.find(
      item => item.price.id === extraSeatPriceId
    );

    if (existingExtraSeatItem) {
      // Incrémenter la quantité
      await stripe.subscriptionItems.update(existingExtraSeatItem.id, {
        quantity: existingExtraSeatItem.quantity + 1
      });
    } else {
      // Ajouter un nouvel item
      await stripe.subscriptionItems.create({
        subscription: tenant.stripe_subscription_id,
        price: extraSeatPriceId,
        quantity: 1
      });
    }

    // Incrémenter max_users dans la table tenants
    const newMaxUsers = tenant.max_users + 1;
    const { error: updateError } = await supabaseService.supabase
      .from('tenants')
      .update({
        max_users: newMaxUsers,
        updated_at: new Date().toISOString()
      })
      .eq('tenant_id', tenantId);

    if (updateError) {
      logger.error('stripe', 'Erreur mise a jour max_users', updateError.message);
      return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour' });
    }

    logger.info('stripe', `Siege supplementaire ajoute pour tenant ${tenantId}: max_users ${tenant.max_users} -> ${newMaxUsers}`);

    res.json({
      success: true,
      message: 'Siège supplémentaire ajouté avec succès',
      newMaxUsers
    });

  } catch (error) {
    logger.error('stripe', 'Erreur add-extra-seat', error.message);

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({
        success: false,
        error: 'Erreur Stripe. Veuillez réessayer.'
      });
    }

    res.status(500).json({ success: false, error: 'Erreur lors de l\'ajout du siège supplémentaire' });
  }
});

/**
 * POST /api/stripe/resend-magic-link
 * Change l'email et renvoie le magic link après un paiement
 */
router.post('/resend-magic-link', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, error: 'Stripe non configuré' });
    }

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

    // Vérifier que la session est récente (< 24h) pour limiter l'abus
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionAge = Date.now() / 1000 - session.created;
    if (sessionAge > 86400) {
      return res.status(400).json({
        success: false,
        error: 'Session expirée. Veuillez refaire le processus de paiement.'
      });
    }

    // Vérifier que le compte n'a pas encore été activé (password non défini)
    const oldEmail = session.customer_email?.toLowerCase();
    const { data: existingUser } = await supabaseService.supabase
      .from('users')
      .select('id, requires_password_setup')
      .eq('email', oldEmail)
      .single();

    if (existingUser && !existingUser.requires_password_setup) {
      return res.status(403).json({
        success: false,
        error: 'Ce compte est déjà activé. Utilisez la page de connexion.'
      });
    }

    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        error: 'Session de paiement invalide ou non payée'
      });
    }

    // Chercher l'utilisateur avec l'ancien email
    let { data: user, error: userError } = await supabaseService.supabase
      .from('users')
      .select('*')
      .eq('email', oldEmail)
      .single();

    // Si l'utilisateur n'existe pas encore (webhook pas encore traité), le créer
    if (userError || !user) {
      logger.warn('stripe', 'Utilisateur non trouve, creation depuis resend-magic-link...');

      // Récupérer ou créer le tenant
      const planLimits = PLAN_LIMITS[session.metadata?.plan] || PLAN_LIMITS.essentiel;

      const { data: existingTenant } = await supabaseService.supabase
        .from('tenants')
        .select('*')
        .eq('email', oldEmail)
        .single();

      let tenant;
      if (existingTenant) {
        tenant = existingTenant;
      } else {
        tenant = await supabaseService.createTenant({
          email: oldEmail,
          company_name: session.metadata?.companyName || 'Mon agence',
          responsable_name: session.metadata?.responsableName || null,
          account_type: session.metadata?.accountType || 'agency',
          plan: session.metadata?.plan || 'essentiel',
          monthly_conversation_limit: planLimits.monthly_conversation_limit,
          max_users: planLimits.max_users,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: 'pending_onboarding'
        });
        logger.info('stripe', `Tenant cree depuis resend: ${tenant.tenant_id}`);
      }

      // Créer l'utilisateur
      user = await authService.createUserWithoutPassword(tenant.tenant_id, {
        email: oldEmail,
        companyName: session.metadata?.companyName || 'Mon agence',
        role: 'manager'
      });
      logger.info('stripe', `Utilisateur cree depuis resend: ${user.id}`);
    }

    const normalizedNewEmail = newEmail.toLowerCase();

    // Si l'email change, vérifier et mettre à jour
    if (normalizedNewEmail !== oldEmail) {
      // Vérifier que le nouvel email n'est pas déjà utilisé par un autre utilisateur
      const { data: existingUsers } = await supabaseService.supabase
        .from('users')
        .select('id')
        .eq('email', normalizedNewEmail)
        .neq('id', user.id);

      if (existingUsers && existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cet email est déjà utilisé par un autre compte'
        });
      }

      // Mettre à jour l'email de l'utilisateur
      const { error: updateError } = await supabaseService.supabase
        .from('users')
        .update({ email: normalizedNewEmail })
        .eq('id', user.id);

      if (updateError) {
        logger.error('stripe', 'Erreur mise a jour email', updateError.message);
        return res.status(500).json({
          success: false,
          error: 'Erreur lors de la mise à jour de l\'email'
        });
      }

      // Mettre à jour l'email dans la table tenants
      const { error: tenantUpdateError } = await supabaseService.supabase
        .from('tenants')
        .update({ email: normalizedNewEmail, updated_at: new Date().toISOString() })
        .eq('tenant_id', user.tenant_id)
        .eq('email', oldEmail);

      if (tenantUpdateError) {
        logger.warn('stripe', 'Erreur mise a jour email tenant', tenantUpdateError.message);
      }
    }

    // Générer un nouveau magic link
    const magicLink = await magicLinkService.generateMagicLink(user.id);

    // Envoyer l'email
    const targetEmail = normalizedNewEmail || oldEmail;
    const emailResult = await emailService.sendMagicLinkEmail(
      targetEmail,
      magicLink,
      session.metadata?.companyName || 'votre agence'
    );

    if (!emailResult.success) {
      logger.error('stripe', 'Erreur envoi email', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'envoi de l\'email'
      });
    }

    logger.info('stripe', `Magic link renvoye vers ${targetEmail}`);

    res.json({
      success: true,
      message: 'Un email de connexion a été envoyé à votre nouvelle adresse'
    });

  } catch (error) {
    logger.error('stripe', 'Erreur resend-magic-link', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Erreur lors du renvoi de l\'email'
    });
  }
});

module.exports = router;
