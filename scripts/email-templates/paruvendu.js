/**
 * Template email ParuVendu
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#E31E24';
const BRAND_NAME = 'ParuVendu';

function getSubject(data) {
  return `Nouveau message pour votre annonce ${data.property.reference}`;
}

function getSenderName() {
  return 'ParuVendu';
}

function getSenderDomain() {
  return 'paruvendu.fr';
}

function getReplyTo() {
  return 'noreply@paruvendu.fr';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouveau message - ParuVendu</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">${BRAND_NAME}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">Le site de petites annonces</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 20px;">
        Vous avez reçu un message
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
        Un utilisateur de ParuVendu vous a contacté concernant votre annonce immobilière.
      </p>

      <!-- Annonce Card -->
      <div style="background-color: #fff5f5; border: 1px solid #fcc; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <p style="font-size: 12px; color: ${BRAND_COLOR}; margin: 0 0 10px 0; font-weight: bold;">
          ANNONCE CONCERNÉE
        </p>
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0 0 10px 0;">
          ${property.title}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Référence : <strong>${property.reference}</strong>
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Type : ${property.type}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Prix : <strong style="color: ${BRAND_COLOR};">${property.price}</strong>
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          Localisation : ${property.location}
        </p>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin-bottom: 25px; border: 1px solid #eee;">
        <p style="font-size: 12px; color: #666; margin: 0 0 15px 0; font-weight: bold;">
          COORDONNÉES
        </p>
        <div style="font-size: 14px;">
          <p style="margin: 8px 0;">
            <strong>Nom :</strong> ${prospect.firstName} ${prospect.lastName}
          </p>
          <p style="margin: 8px 0;">
            <strong>Téléphone :</strong> ${prospect.phone}
          </p>
          <p style="margin: 8px 0;">
            <strong>Email :</strong> ${prospect.email}
          </p>
        </div>
      </div>

      <!-- Message -->
      <div style="margin-bottom: 25px;">
        <p style="font-size: 12px; color: #666; margin: 0 0 10px 0; font-weight: bold;">
          MESSAGE DU PROSPECT
        </p>
        <div style="background-color: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px;">
          <p style="font-size: 14px; line-height: 1.7; margin: 0; color: #333;">
            ${prospect.message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.paruvendu.fr/mes-contacts"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 14px 35px; border-radius: 4px; font-weight: bold; font-size: 15px;">
          Voir mes contacts
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par ParuVendu.
      </p>
      <p style="margin: 5px 0;">
        © 2025 ParuVendu - Tous droits réservés
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://www.paruvendu.fr" style="color: ${BRAND_COLOR}; text-decoration: none;">www.paruvendu.fr</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Nouveau message pour votre annonce ${property.reference}

PARUVENDU
Le site de petites annonces

Vous avez reçu un message

Bonjour,

Un utilisateur de ParuVendu vous a contacté concernant votre annonce immobilière.

ANNONCE CONCERNÉE
-----------------
${property.title}
Référence : ${property.reference}
Type : ${property.type}
Prix : ${property.price}
Localisation : ${property.location}

COORDONNÉES
-----------
Nom : ${prospect.firstName} ${prospect.lastName}
Téléphone : ${prospect.phone}
Email : ${prospect.email}

MESSAGE DU PROSPECT
-------------------
${prospect.message}

---

Voir mes contacts : https://www.paruvendu.fr/mes-contacts

© 2025 ParuVendu - www.paruvendu.fr`;
}

module.exports = {
  getSubject,
  getSenderName,
  getSenderDomain,
  getReplyTo,
  getHTML,
  getText,
  BRAND_COLOR,
  BRAND_NAME
};
