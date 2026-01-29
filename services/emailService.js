const { Resend } = require('resend');

// Initialiser Resend
let resend = null;
if (process.env.RESEND_API_KEY) {
  resend = new Resend(process.env.RESEND_API_KEY);
} else {
  console.warn('RESEND_API_KEY non configure - les emails ne seront pas envoyes');
}

/**
 * Envoie un email de magic link pour la premiere connexion
 */
async function sendMagicLinkEmail(email, magicLink, companyName) {
  if (!resend) {
    console.error('Resend non configure, impossible d\'envoyer l\'email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'IMMO Copilot <noreply@emkai.fr>',
      to: email,
      subject: 'Bienvenue sur IMMO Copilot - Finalisez votre inscription',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 16px; border: 1px solid #2a2a2a;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">
                <span style="color: #C5A065;">IMMO</span><span style="color: white;">Copilot</span>
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="color: white; margin: 0 0 15px; font-size: 22px;">
                Bienvenue ${companyName} !
              </h2>
              <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                Votre compte IMMO Copilot a ete cree avec succes. Cliquez sur le bouton ci-dessous pour definir votre mot de passe et finaliser votre inscription.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #C5A065 0%, #B08F55 100%); color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                      Finaliser mon inscription
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                Ce lien est valable pendant <strong style="color: #9ca3af;">24 heures</strong>. Si vous n'avez pas demande cette inscription, ignorez simplement cet email.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 30px 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
              </p>
              <p style="color: #C5A065; font-size: 12px; margin: 10px 0 0; text-align: center; word-break: break-all;">
                ${magicLink}
              </p>
            </td>
          </tr>

          <!-- Copyright -->
          <tr>
            <td style="padding: 20px 40px; background-color: #111111; border-radius: 0 0 16px 16px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                &copy; 2026 EMKAI - IMMO Copilot | Tous droits reserves
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    if (error) {
      console.error('Erreur envoi email Resend:', error);
      return { success: false, error: error.message };
    }

    console.log(`Email magic link envoye a ${email} - ID: ${data.id}`);
    return { success: true, id: data.id };

  } catch (error) {
    console.error('Exception envoi email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie un email de bienvenue apres la configuration complete
 */
async function sendWelcomeEmail(email, companyName, dashboardUrl) {
  if (!resend) {
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'IMMO Copilot <noreply@emkai.fr>',
      to: email,
      subject: 'Configuration terminee - Votre dashboard est pret !',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 16px; border: 1px solid #2a2a2a;">
          <tr>
            <td style="padding: 40px; text-align: center;">
              <h1 style="margin: 0 0 20px; font-size: 28px;">
                <span style="color: #C5A065;">IMMO</span><span style="color: white;">Copilot</span>
              </h1>
              <h2 style="color: white; margin: 0 0 15px;">Configuration terminee !</h2>
              <p style="color: #9ca3af; font-size: 16px; line-height: 1.6;">
                Felicitations ${companyName} ! Votre compte est maintenant entierement configure.
                Vous pouvez acceder a votre dashboard pour commencer a gerer vos leads.
              </p>
              <a href="${dashboardUrl}" style="display: inline-block; margin-top: 25px; background: linear-gradient(135deg, #C5A065 0%, #B08F55 100%); color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600;">
                Acceder au dashboard
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #111111; border-radius: 0 0 16px 16px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                &copy; 2026 EMKAI - IMMO Copilot
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    if (error) {
      console.error('Erreur envoi email welcome:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };

  } catch (error) {
    console.error('Exception envoi email welcome:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Envoie un email de reinitialisation de mot de passe
 */
async function sendPasswordResetEmail(email, resetLink, userName = '') {
  if (!resend) {
    console.error('Resend non configure, impossible d\'envoyer l\'email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'IMMO Copilot <noreply@emkai.fr>',
      to: email,
      subject: 'Réinitialisation de votre mot de passe - IMMO Copilot',
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f0f0f; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #1a1a1a; border-radius: 16px; border: 1px solid #2a2a2a;">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">
                <span style="color: #C5A065;">IMMO</span><span style="color: white;">Copilot</span>
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px;">
              <h2 style="color: white; margin: 0 0 15px; font-size: 22px;">
                Réinitialisation de mot de passe
              </h2>
              <p style="color: #9ca3af; font-size: 16px; line-height: 1.6; margin: 0 0 25px;">
                ${userName ? `Bonjour ${userName},<br><br>` : ''}Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
              </p>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center" style="padding: 20px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #C5A065 0%, #B08F55 100%); color: #000000; text-decoration: none; padding: 16px 40px; border-radius: 10px; font-weight: 600; font-size: 16px;">
                      Réinitialiser mon mot de passe
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 20px 0 0;">
                Ce lien est valable pendant <strong style="color: #9ca3af;">1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <hr style="border: none; border-top: 1px solid #2a2a2a; margin: 30px 0;">
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 0 40px 40px;">
              <p style="color: #6b7280; font-size: 13px; margin: 0; text-align: center;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :
              </p>
              <p style="color: #C5A065; font-size: 12px; margin: 10px 0 0; text-align: center; word-break: break-all;">
                ${resetLink}
              </p>
            </td>
          </tr>

          <!-- Copyright -->
          <tr>
            <td style="padding: 20px 40px; background-color: #111111; border-radius: 0 0 16px 16px;">
              <p style="color: #6b7280; font-size: 12px; margin: 0; text-align: center;">
                &copy; 2026 EMKAI - IMMO Copilot | Tous droits reserves
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `
    });

    if (error) {
      console.error('Erreur envoi email reset password:', error);
      return { success: false, error: error.message };
    }

    console.log(`Email reset password envoye a ${email} - ID: ${data.id}`);
    return { success: true, id: data.id };

  } catch (error) {
    console.error('Exception envoi email reset password:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendMagicLinkEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail
};
