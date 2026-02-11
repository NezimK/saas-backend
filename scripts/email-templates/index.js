/**
 * Index des templates d'emails pour les portails immobiliers
 * Exporte tous les templates disponibles
 *
 * Données basées sur les vrais biens de la base Supabase
 */

const leboncoin = require('./leboncoin');
const seloger = require('./seloger');
const pap = require('./pap');
const logicImmo = require('./logic-immo');
const bienici = require('./bienici');
const figaroImmo = require('./figaro-immo');
const avendrealouer = require('./avendrealouer');
const paruvendu = require('./paruvendu');
const ouestfranceImmo = require('./ouestfrance-immo');

// Liste des portails disponibles
const PORTALS = {
  'leboncoin': leboncoin,
  'seloger': seloger,
  'pap': pap,
  'logic-immo': logicImmo,
  'bienici': bienici,
  'figaro-immo': figaroImmo,
  'avendrealouer': avendrealouer,
  'paruvendu': paruvendu,
  'ouestfrance-immo': ouestfranceImmo
};

// Biens reels de la base Supabase (tenant Emkai)
const REAL_PROPERTIES = [
  {
    reference: 'VA011',
    title: 'Vente Appartement 74m²',
    price: '266 400 €',
    location: 'Pignan 34570',
    type: 'Appartement',
    surface: '74m²',
    rooms: 5,
    bedrooms: 4,
    address: '2 Rue des Verdales'
  },
  {
    reference: 'VA001',
    title: 'Vente Appartement 17m²',
    price: '53 941 €',
    location: 'Frontignan 34110',
    type: 'Appartement',
    surface: '17m²',
    rooms: 1,
    bedrooms: 1,
    address: '12 Rue de la Fourmi'
  },
  {
    reference: 'VA013',
    title: 'Vente Appartement 64m²',
    price: '143 680 €',
    location: 'Agde 34300',
    type: 'Appartement',
    surface: '64m²',
    rooms: 4,
    bedrooms: 3,
    address: '17 Rue de Rome'
  },
  {
    reference: 'VA005',
    title: 'Vente Appartement 16m²',
    price: '72 208 €',
    location: 'Frontignan 34110',
    type: 'Appartement',
    surface: '16m²',
    rooms: 1,
    bedrooms: 1,
    address: '9 Rue de la Gaze'
  },
  {
    reference: 'VA003',
    title: 'Vente Appartement 60m²',
    price: '204 180 €',
    location: 'Pignan 34570',
    type: 'Appartement',
    surface: '60m²',
    rooms: 4,
    bedrooms: 3,
    address: '5 Rue Dieudonne Vidal'
  }
];

// Differents profils de prospects avec des questions variees
const PROSPECT_PROFILES = [
  {
    firstName: 'Jean',
    lastName: 'Dupont',
    phone: '+33645541319',
    email: 'jean.dupont@gmail.com',
    message: `Bonjour,

Je suis tres interesse par votre bien.
Serait-il possible d'organiser une visite cette semaine ? Je suis disponible en fin d'apres-midi.

Je recherche un bien pour y habiter avec ma famille.

Cordialement,
Jean Dupont`
  },
  {
    firstName: 'Marie',
    lastName: 'Martin',
    phone: '+33645541319',
    email: 'marie.martin@outlook.fr',
    message: `Bonjour,

J'aimerais connaitre le montant des charges mensuelles pour ce bien.
Y a-t-il un parking inclus dans le prix ?

Merci d'avance pour votre reponse.

Marie Martin`
  },
  {
    firstName: 'Pierre',
    lastName: 'Bernard',
    phone: '+33645541319',
    email: 'p.bernard@yahoo.fr',
    message: `Bonjour,

Le bien est-il toujours disponible ?
Quelle est la classe energetique du logement (DPE) ?

J'envisage un achat pour investissement locatif.

Bien cordialement,
Pierre Bernard`
  },
  {
    firstName: 'Sophie',
    lastName: 'Leroy',
    phone: '+33645541319',
    email: 'sophie.leroy@free.fr',
    message: `Bonjour,

Je souhaiterais visiter ce bien rapidement.
Pouvez-vous me rappeler pour fixer un rendez-vous ?
Je suis disponible samedi matin ou en semaine apres 18h.

Sophie Leroy`
  },
  {
    firstName: 'Antoine',
    lastName: 'Moreau',
    phone: '+33645541319',
    email: 'antoine.moreau@gmail.com',
    message: `Bonjour,

Je suis acheteur serieux avec un financement deja valide par ma banque.
Ce bien correspond exactement a mes criteres.

Questions :
- Y a-t-il un balcon ou une terrasse ?
- L'immeuble dispose-t-il d'un ascenseur ?
- Quel est l'etage ?

Merci de me recontacter au plus vite.

Antoine Moreau`
  },
  {
    firstName: 'Claire',
    lastName: 'Petit',
    phone: '+33645541319',
    email: 'claire.petit@laposte.net',
    message: `Bonjour,

Je cherche un appartement pour ma fille etudiante.
Ce studio semble correspondre a son budget.

Pouvez-vous me confirmer :
- Le loyer charges comprises ?
- La proximite avec les transports en commun ?
- Si les animaux sont acceptes ?

Merci beaucoup.

Claire Petit`
  },
  {
    firstName: 'Thomas',
    lastName: 'Roux',
    phone: '+33645541319',
    email: 'thomas.roux@sfr.fr',
    message: `Bonjour,

Je suis interesse par ce bien pour un projet d'investissement.
Quel serait le loyer estimatif si je le mettais en location ?

Le quartier est-il calme ?

Thomas Roux`
  },
  {
    firstName: 'Isabelle',
    lastName: 'Fournier',
    phone: '+33645541319',
    email: 'isabelle.fournier@orange.fr',
    message: `Bonjour,

Je vends mon appartement actuel et je cherche plus grand.
Ce bien m'interesse beaucoup.

Est-ce que le prix est negociable ?
Y a-t-il eu des travaux recents dans l'immeuble ?

Cordialement,
Isabelle Fournier`
  },
  {
    firstName: 'Nicolas',
    lastName: 'Girard',
    phone: '+33645541319',
    email: 'n.girard@numericable.fr',
    message: `Bonjour,

Demande de visite pour ce bien.
Je suis mute professionnellement dans la region et dois trouver un logement rapidement.

Budget OK - financement pret.

Disponible tous les jours.

Nicolas Girard`
  }
];

// Association portail -> profil + bien (pour varier les tests)
const PORTAL_TEST_DATA = {
  'leboncoin': { propertyIndex: 0, prospectIndex: 0 }, // VA011 - Jean (visite)
  'seloger': { propertyIndex: 1, prospectIndex: 1 },   // VA001 - Marie (charges/parking)
  'pap': { propertyIndex: 2, prospectIndex: 2 },       // VA013 - Pierre (DPE/investissement)
  'logic-immo': { propertyIndex: 3, prospectIndex: 3 }, // VA005 - Sophie (RDV visite)
  'bienici': { propertyIndex: 4, prospectIndex: 4 },    // VA003 - Antoine (questions multiples)
  'figaro-immo': { propertyIndex: 0, prospectIndex: 5 }, // VA011 - Claire (etudiante)
  'avendrealouer': { propertyIndex: 1, prospectIndex: 6 }, // VA001 - Thomas (investissement)
  'paruvendu': { propertyIndex: 2, prospectIndex: 7 },    // VA013 - Isabelle (negociation)
  'ouestfrance-immo': { propertyIndex: 3, prospectIndex: 8 } // VA005 - Nicolas (mutation)
};

// Donnees de test par defaut (fallback)
const DEFAULT_TEST_DATA = {
  prospect: PROSPECT_PROFILES[0],
  property: REAL_PROPERTIES[0]
};

/**
 * Recupere un template par son nom
 * @param {string} portalName - Nom du portail (ex: 'leboncoin', 'seloger')
 * @returns {Object|null} - Le template ou null si non trouve
 */
function getTemplate(portalName) {
  const normalizedName = portalName.toLowerCase().trim();
  return PORTALS[normalizedName] || null;
}

/**
 * Recupere la liste de tous les portails disponibles
 * @returns {string[]} - Liste des noms de portails
 */
function getAvailablePortals() {
  return Object.keys(PORTALS);
}

/**
 * Genere les donnees d'email pour un portail donne
 * Utilise automatiquement des donnees variees selon le portail
 * @param {string} portalName - Nom du portail
 * @param {Object} customData - Donnees personnalisees (optionnel)
 * @returns {Object} - Donnees formatees pour l'envoi d'email
 */
function generateEmailData(portalName, customData = {}) {
  const template = getTemplate(portalName);
  if (!template) {
    throw new Error(`Template non trouve pour le portail: ${portalName}`);
  }

  // Recuperer les donnees specifiques au portail
  const portalConfig = PORTAL_TEST_DATA[portalName.toLowerCase()] || { propertyIndex: 0, prospectIndex: 0 };
  const baseProperty = REAL_PROPERTIES[portalConfig.propertyIndex] || REAL_PROPERTIES[0];
  const baseProspect = PROSPECT_PROFILES[portalConfig.prospectIndex] || PROSPECT_PROFILES[0];

  // Fusionner les donnees par defaut avec les donnees personnalisees
  const data = {
    prospect: { ...baseProspect, ...customData.prospect },
    property: { ...baseProperty, ...customData.property }
  };

  return {
    portalName,
    subject: template.getSubject(data),
    senderName: template.getSenderName(),
    senderDomain: template.getSenderDomain(),
    replyTo: template.getReplyTo(),
    html: template.getHTML(data),
    text: template.getText(data),
    brandColor: template.BRAND_COLOR,
    brandName: template.BRAND_NAME
  };
}

/**
 * Recupere un profil prospect aleatoire
 * @returns {Object} - Profil prospect
 */
function getRandomProspect() {
  const index = Math.floor(Math.random() * PROSPECT_PROFILES.length);
  return PROSPECT_PROFILES[index];
}

/**
 * Recupere un bien aleatoire
 * @returns {Object} - Donnees du bien
 */
function getRandomProperty() {
  const index = Math.floor(Math.random() * REAL_PROPERTIES.length);
  return REAL_PROPERTIES[index];
}

module.exports = {
  PORTALS,
  REAL_PROPERTIES,
  PROSPECT_PROFILES,
  PORTAL_TEST_DATA,
  DEFAULT_TEST_DATA,
  getTemplate,
  getAvailablePortals,
  generateEmailData,
  getRandomProspect,
  getRandomProperty,
  // Export direct des templates pour un acces facile
  leboncoin,
  seloger,
  pap,
  logicImmo,
  bienici,
  figaroImmo,
  avendrealouer,
  paruvendu,
  ouestfranceImmo
};
