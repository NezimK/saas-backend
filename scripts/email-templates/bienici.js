/**
 * Template email BienIci
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#1A73E8';
const BRAND_NAME = "Bien'ici";

function getSubject(data) {
  return `Demande d'information - ${data.property.title}`;
}

function getSenderName() {
  return "Bien'ici";
}

function getSenderDomain() {
  return 'bienici.com';
}

function getReplyTo() {
  return 'noreply@bienici.com';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouvelle demande - Bien'ici</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 25px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 26px; font-weight: 600;">${BRAND_NAME}</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 13px;">La recherche immobilière réinventée</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <div style="text-align: center; margin-bottom: 25px;">
        <span style="display: inline-block; background-color: #E3F2FD; color: ${BRAND_COLOR}; padding: 8px 16px; border-radius: 20px; font-size: 13px; font-weight: 600;">
          Nouvelle demande
        </span>
      </div>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px; text-align: center;">
        Un utilisateur de Bien'ici souhaite en savoir plus sur votre bien.
      </p>

      <!-- Annonce Card -->
      <div style="border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; margin-bottom: 25px; background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%);">
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 0 0 8px 0;">
          Bien concerné
        </p>
        <p style="font-size: 18px; font-weight: 600; color: #333; margin: 0 0 15px 0;">
          ${property.title}
        </p>
        <div style="display: flex; flex-wrap: wrap; gap: 10px;">
          <span style="background: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-size: 12px; color: #666;">
            Réf: ${property.reference}
          </span>
          <span style="background: #f0f0f0; padding: 5px 10px; border-radius: 5px; font-size: 12px; color: #666;">
            ${property.type}
          </span>
        </div>
        <p style="margin: 15px 0 5px 0; font-size: 20px; font-weight: 700; color: ${BRAND_COLOR};">
          ${property.price}
        </p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #666;">
          📍 ${property.location}
        </p>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #E3F2FD; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: ${BRAND_COLOR}; margin: 0 0 15px 0; font-weight: 600;">
          Contact
        </p>
        <p style="margin: 0 0 8px 0; font-size: 16px; color: #333;">
          <strong>${prospect.firstName} ${prospect.lastName}</strong>
        </p>
        <p style="margin: 0 0 5px 0; font-size: 14px; color: #555;">
          📞 ${prospect.phone}
        </p>
        <p style="margin: 0; font-size: 14px; color: #555;">
          ✉️ ${prospect.email}
        </p>
      </div>

      <!-- Message -->
      <div style="margin-bottom: 25px;">
        <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin: 0 0 10px 0;">
          Message
        </p>
        <div style="background-color: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px;">
          <p style="font-size: 14px; line-height: 1.7; margin: 0; color: #333;">
            ${prospect.message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://pro.bienici.com"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 14px 35px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(26,115,232,0.3);">
          Répondre au prospect
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #f8f9fa; padding: 25px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par Bien'ici.
      </p>
      <p style="margin: 5px 0;">
        © 2025 Bien'ici - Tous droits réservés
      </p>
      <p style="margin: 15px 0 0 0;">
        <a href="https://www.bienici.com" style="color: ${BRAND_COLOR}; text-decoration: none; font-weight: 500;">www.bienici.com</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Demande d'information - ${property.title}

BIEN'ICI
La recherche immobilière réinventée

Nouvelle demande

Un utilisateur de Bien'ici souhaite en savoir plus sur votre bien.

BIEN CONCERNÉ
-------------
${property.title}
Référence : ${property.reference}
Type : ${property.type}
Prix : ${property.price}
Localisation : ${property.location}

CONTACT
-------
${prospect.firstName} ${prospect.lastName}
Téléphone : ${prospect.phone}
Email : ${prospect.email}

MESSAGE
-------
${prospect.message}

---

Répondre au prospect : https://pro.bienici.com

© 2025 Bien'ici - www.bienici.com`;
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
