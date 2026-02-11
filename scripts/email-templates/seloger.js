/**
 * Template email SeLoger
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#E00034';
const BRAND_NAME = 'SeLoger';

function getSubject(data) {
  return `Demande de renseignement - ${data.property.type} à ${data.property.location.split(' ')[0]}`;
}

function getSenderName() {
  return 'SeLoger';
}

function getSenderDomain() {
  return 'seloger.com';
}

function getReplyTo() {
  return 'noreply@seloger.com';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouvelle demande de contact - SeLoger</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">${BRAND_NAME}</h1>
      <p style="color: white; margin: 5px 0 0 0; font-size: 12px;">Le N°1 de l'immobilier</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 20px;">
        Nouvelle demande de contact
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Un internaute souhaite obtenir des informations sur l'un de vos biens.
      </p>

      <!-- Annonce Card -->
      <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 20px; background-color: #fafafa;">
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0 0 10px 0;">
          ${property.title}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          <strong>Référence :</strong> ${property.reference}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          <strong>Type :</strong> ${property.type}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          <strong>Prix :</strong> ${property.price}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #666;">
          <strong>Localisation :</strong> ${property.location}
        </p>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #fff5f5; border: 1px solid ${BRAND_COLOR}; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
        <p style="font-size: 14px; font-weight: bold; color: ${BRAND_COLOR}; margin: 0 0 10px 0;">
          Coordonnées du prospect
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #333;">
          <strong>Nom :</strong> ${prospect.lastName}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #333;">
          <strong>Prénom :</strong> ${prospect.firstName}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #333;">
          <strong>Téléphone :</strong> ${prospect.phone}
        </p>
        <p style="margin: 5px 0; font-size: 14px; color: #333;">
          <strong>Email :</strong> ${prospect.email}
        </p>
      </div>

      <!-- Message -->
      <div style="margin-bottom: 20px;">
        <p style="font-size: 14px; font-weight: bold; color: #333; margin: 0 0 10px 0;">
          Message du prospect :
        </p>
        <div style="background-color: #f9f9f9; border-left: 4px solid ${BRAND_COLOR}; padding: 15px;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #555;">
            ${prospect.message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.seloger.com/pro"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 12px 30px; border-radius: 4px; font-weight: bold; font-size: 16px;">
          Répondre au prospect
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par SeLoger.
      </p>
      <p style="margin: 5px 0;">
        © 2025 Groupe SeLoger - Tous droits réservés
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://www.seloger.com" style="color: ${BRAND_COLOR}; text-decoration: none;">www.seloger.com</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Demande de renseignement - ${property.type} à ${property.location.split(' ')[0]}

SELOGER - Le N°1 de l'immobilier

Nouvelle demande de contact

Bonjour,

Un internaute souhaite obtenir des informations sur l'un de vos biens.

DÉTAILS DE L'ANNONCE
--------------------
${property.title}
Référence : ${property.reference}
Type : ${property.type}
Prix : ${property.price}
Localisation : ${property.location}

COORDONNÉES DU PROSPECT
-----------------------
Nom : ${prospect.lastName}
Prénom : ${prospect.firstName}
Téléphone : ${prospect.phone}
Email : ${prospect.email}

MESSAGE DU PROSPECT
-------------------
${prospect.message}

---

Répondre au prospect : https://www.seloger.com/pro

© 2025 Groupe SeLoger - www.seloger.com`;
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
