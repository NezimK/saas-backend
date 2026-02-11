/**
 * Constantes partagées du backend
 */

const DEFAULT_EMAIL_FILTERS = [
  'leboncoin.fr',
  'seloger.com',
  'pap.fr',
  'logic-immo.com',
  'bienici.com',
  'figaroimmo.fr',
  'avendrealouer.fr',
  'paruvendu.fr',
  'ouestfrance-immo.com'
];

const VALID_PLANS = ['essentiel', 'avance', 'premium'];

const PLAN_LIMITS = {
  essentiel: { monthly_conversation_limit: 600, max_users: 3 },
  avance: { monthly_conversation_limit: 1500, max_users: 6 },
  premium: { monthly_conversation_limit: 3000, max_users: -1 } // -1 = illimité
};

module.exports = {
  DEFAULT_EMAIL_FILTERS,
  VALID_PLANS,
  PLAN_LIMITS
};
