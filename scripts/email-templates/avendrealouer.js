/**
 * Template email AVendreALouer
 * Format estimé basé sur les conventions des portails immobiliers français
 */

const BRAND_COLOR = '#00B140';
const BRAND_NAME = 'AVendreALouer';

function getSubject(data) {
  return `Demande de contact - ${data.property.type} à ${data.property.location.split(' ')[0]}`;
}

function getSenderName() {
  return 'AVendreALouer';
}

function getSenderDomain() {
  return 'avendrealouer.fr';
}

function getReplyTo() {
  return 'noreply@avendrealouer.fr';
}

function getHTML(data) {
  const { prospect, property } = data;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Nouveau contact - AVendreALouer</title>
</head>
<body style="font-family: Arial, sans-serif; color: #333; background-color: #f5f5f5; padding: 20px;">

  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">

    <!-- Header -->
    <div style="background-color: ${BRAND_COLOR}; padding: 20px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px; font-weight: bold;">
        <span style="font-weight: normal;">A</span>Vendre<span style="font-weight: normal;">A</span>Louer
      </h1>
      <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 12px;">Votre partenaire immobilier</p>
    </div>

    <!-- Content -->
    <div style="padding: 30px;">

      <h2 style="color: ${BRAND_COLOR}; font-size: 20px; margin-bottom: 20px;">
        Nouveau contact
      </h2>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
        Bonjour,
      </p>

      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 25px;">
        Vous avez reçu une nouvelle demande de contact via AVendreALouer.fr concernant l'un de vos biens.
      </p>

      <!-- Annonce Card -->
      <div style="border: 2px solid ${BRAND_COLOR}; border-radius: 8px; padding: 20px; margin-bottom: 25px; background-color: #f0fff4;">
        <p style="font-size: 12px; color: ${BRAND_COLOR}; margin: 0 0 8px 0; font-weight: bold; text-transform: uppercase;">
          Bien concerné
        </p>
        <p style="font-size: 16px; font-weight: bold; color: #333; margin: 0 0 15px 0;">
          ${property.title}
        </p>
        <div style="font-size: 14px; color: #666;">
          <p style="margin: 5px 0;">
            <span style="color: #999;">Réf :</span> ${property.reference}
          </p>
          <p style="margin: 5px 0;">
            <span style="color: #999;">Type :</span> ${property.type}
          </p>
          <p style="margin: 5px 0;">
            <span style="color: #999;">Prix :</span> <strong style="color: ${BRAND_COLOR};">${property.price}</strong>
          </p>
          <p style="margin: 5px 0;">
            <span style="color: #999;">Ville :</span> ${property.location}
          </p>
        </div>
      </div>

      <!-- Prospect Info -->
      <div style="background-color: #fafafa; border-radius: 8px; padding: 20px; margin-bottom: 25px;">
        <p style="font-size: 12px; color: #666; margin: 0 0 15px 0; font-weight: bold; text-transform: uppercase;">
          Coordonnées du prospect
        </p>
        <table style="width: 100%; font-size: 14px;">
          <tr>
            <td style="padding: 8px 0; color: #666; width: 100px;">Nom</td>
            <td style="padding: 8px 0; color: #333; font-weight: bold;">${prospect.firstName} ${prospect.lastName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Téléphone</td>
            <td style="padding: 8px 0; color: #333; font-weight: bold;">${prospect.phone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Email</td>
            <td style="padding: 8px 0; color: #333; font-weight: bold;">${prospect.email}</td>
          </tr>
        </table>
      </div>

      <!-- Message -->
      <div style="margin-bottom: 25px;">
        <p style="font-size: 12px; color: #666; margin: 0 0 10px 0; font-weight: bold; text-transform: uppercase;">
          Message
        </p>
        <div style="background-color: #fff; border: 1px solid #ddd; border-left: 4px solid ${BRAND_COLOR}; padding: 15px;">
          <p style="font-size: 14px; line-height: 1.6; margin: 0; color: #333;">
            ${prospect.message.replace(/\n/g, '<br>')}
          </p>
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="https://www.avendrealouer.fr/pro"
           style="display: inline-block; background-color: ${BRAND_COLOR}; color: white; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: bold; font-size: 15px;">
          Contacter le prospect
        </a>
      </div>

      <p style="font-size: 12px; color: #999; text-align: center;">
        Répondez rapidement pour augmenter vos chances de conclure !
      </p>

    </div>

    <!-- Footer -->
    <div style="background-color: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
      <p style="margin: 5px 0;">
        Ce message a été envoyé automatiquement par AVendreALouer.
      </p>
      <p style="margin: 5px 0;">
        © 2025 AVendreALouer - LBC France
      </p>
      <p style="margin: 10px 0 0 0;">
        <a href="https://www.avendrealouer.fr" style="color: ${BRAND_COLOR}; text-decoration: none;">www.avendrealouer.fr</a>
      </p>
    </div>

  </div>

</body>
</html>`;
}

function getText(data) {
  const { prospect, property } = data;

  return `Demande de contact - ${property.type} à ${property.location.split(' ')[0]}

AVENDREALOUER
Votre partenaire immobilier

Nouveau contact

Bonjour,

Vous avez reçu une nouvelle demande de contact via AVendreALouer.fr concernant l'un de vos biens.

BIEN CONCERNÉ
-------------
${property.title}
Réf : ${property.reference}
Type : ${property.type}
Prix : ${property.price}
Ville : ${property.location}

COORDONNÉES DU PROSPECT
-----------------------
Nom : ${prospect.firstName} ${prospect.lastName}
Téléphone : ${prospect.phone}
Email : ${prospect.email}

MESSAGE
-------
${prospect.message}

---

Contacter le prospect : https://www.avendrealouer.fr/pro

Répondez rapidement pour augmenter vos chances de conclure !

© 2025 AVendreALouer - LBC France - www.avendrealouer.fr`;
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
