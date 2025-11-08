import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendInvitationEmailParams {
  to: string;
  invitationCode: string;
  caseTitle: string;
  inviterName: string;
}

export async function sendInvitationEmail({
  to,
  invitationCode,
  caseTitle,
  inviterName,
}: SendInvitationEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.RESEND_API_KEY) {
      console.warn('⚠️ RESEND_API_KEY not configured, skipping email send');
      return { success: false, error: 'Email service not configured' };
    }

    const invitationLink = `${process.env.PUBLIC_BASE_URL || 'http://localhost:5000'}/invitation/${invitationCode}`;

    const { data, error } = await resend.emails.send({
      from: 'Rechtstreeks.ai <noreply@rechtstreeks.ai>',
      to: [to],
      subject: `Uitnodiging voor mediation - ${caseTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 600; }
              .footer { text-align: center; color: #6b7280; font-size: 14px; margin-top: 30px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Rechtstreeks.ai</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">Online mediation platform</p>
              </div>
              <div class="content">
                <h2 style="color: #1f2937; margin-top: 0;">Je bent uitgenodigd voor mediation</h2>
                <p><strong>${inviterName}</strong> heeft je uitgenodigd om deel te nemen aan een online mediation voor de volgende zaak:</p>
                <p style="background: white; padding: 15px; border-left: 4px solid #667eea; margin: 20px 0;">
                  <strong>${caseTitle}</strong>
                </p>
                <p>Via Rechtstreeks.ai kun je dit geschil oplossen met behulp van AI-mediatie, zonder naar de rechter te hoeven.</p>
                
                <h3 style="color: #1f2937;">Hoe werkt het?</h3>
                <ol style="padding-left: 20px;">
                  <li>Klik op de knop hieronder om de uitnodiging te accepteren</li>
                  <li>Maak een gratis account aan (of log in)</li>
                  <li>Bekijk de zaak informatie en keur deze goed</li>
                  <li>Upload je eigen documenten</li>
                  <li>Start de mediation met AI-begeleiding</li>
                </ol>

                <div style="text-align: center;">
                  <a href="${invitationLink}" class="button">Accepteer uitnodiging</a>
                </div>

                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
                  Deze uitnodiging is 30 dagen geldig. Na deze periode verloopt de link automatisch.
                </p>
              </div>
              <div class="footer">
                <p>Deze email is verstuurd door Rechtstreeks.ai</p>
                <p>Heb je vragen? Neem contact op met de persoon die je heeft uitgenodigd.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });

    if (error) {
      console.error('❌ Failed to send invitation email:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Invitation email sent successfully to:', to);
    return { success: true };
  } catch (error: any) {
    console.error('❌ Error sending invitation email:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
