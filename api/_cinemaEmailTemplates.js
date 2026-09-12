/**
 * Cinema-grade, high-conversion HTML email templates for Stage Work Studio.
 * Designed to build client trust, market SWS USPs, drive engagement, and showcase luxury studio branding.
 */

const LOGO_URL = 'https://www.stageworkstudio.com/brand/stageworks-mark.png';

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Designer confirmation email when an applicant requests a desktop trial.
 * Uses the exact acknowledged / provisioning copy requested by studio administration.
 */
export function generateDesktopTrialReceivedEmail({ name, email }) {
  const recipientName = name ? escapeHtml(name) : 'there';
  const subject = `🎬 Stage Work Studio — Download App Application Received`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Download App Application Received</title>
</head>
<body style="margin:0;padding:0;background-color:#070605;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#e8e2d8;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#070605;padding:36px 14px 50px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#12100d;border:1px solid #28221a;border-radius:14px;overflow:hidden;box-shadow:0 24px 50px rgba(0,0,0,0.75);">
          
          <!-- Gold Accent Top Bar -->
          <tr>
            <td style="background:linear-gradient(90deg, #8d7042, #c9a36a, #e8d4a8, #c9a36a, #8d7042);height:4px;"></td>
          </tr>

          <!-- Header with Logo and Brand Identity -->
          <tr>
            <td style="padding:32px 34px 22px;text-align:center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 14px;">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" width="46" height="46" alt="Stage Work Studio" style="display:block;border-radius:10px;border:1px solid #2e2821;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.24em;color:#c9a36a;text-transform:uppercase;">
                STAGE WORK STUDIO · CINEMA PRODUCTION OS
              </p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#fdfbf7;letter-spacing:-0.01em;">
                Application Received
              </h1>
              <p style="margin:8px 0 0;font-size:13px;color:#9e9587;font-style:italic;">
                "From Script to Screen at the Speed of Thought."
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 34px;">
              <hr style="border:none;border-top:1px solid #221d17;margin:0;">
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px 34px 24px;">
              <div style="text-align:center;margin-bottom:20px;">
                <span style="display:inline-block;background:#1a1713;border:1px solid #3d3428;color:#c9a36a;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:5px 14px;border-radius:20px;">
                  <span style="color:#eab308;margin-right:4px;">●</span> STATUS: ACCESS BEING PROVISIONED
                </span>
              </div>

              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#f4ecde;">
                Hi <strong>${recipientName}</strong>,
              </p>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#d6cfc4;">
                Thank you for requesting access to Stage Work Studio!
              </p>
              <p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#d6cfc4;">
                We have received your application to download the app.
              </p>
              <p style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#d6cfc4;">
                Your access is currently being provisioned. If you have any specific requirements or questions regarding your production slate, please feel free to let us know.
              </p>

              <!-- Signature Box -->
              <div style="background:#0e0d0b;border:1px solid #231f1a;border-radius:10px;padding:18px 20px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#fdfbf7;">
                  Best regards,
                </p>
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#c9a36a;">
                  Stage Work Studio Administration
                </p>
                <p style="margin:0 0 2px;font-size:12px;color:#9e9587;">
                  <a href="mailto:admin@stageworkstudio.com" style="color:#c9a36a;text-decoration:none;">admin@stageworkstudio.com</a>
                </p>
                <p style="margin:0;font-size:12px;color:#9e9587;">
                  <a href="https://www.stageworkstudio.com" style="color:#c9a36a;text-decoration:none;">https://www.stageworkstudio.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0b0a09;border-top:1px solid #1c1813;padding:22px 34px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b6459;letter-spacing:0.12em;text-transform:uppercase;">
                STAGE WORK STUDIO · THE OPERATING SYSTEM FOR VISIONARY CINEMA
              </p>
              <p style="margin:0;font-size:11px;color:#575147;">
                <a href="https://www.stageworkstudio.com" style="color:#857c6e;text-decoration:none;">www.stageworkstudio.com</a> &nbsp;|&nbsp; 
                <a href="mailto:admin@stageworkstudio.com" style="color:#857c6e;text-decoration:none;">admin@stageworkstudio.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Hi ${name || 'there'},

Thank you for requesting access to Stage Work Studio!

We have received your application to download the app.

Your access is currently being provisioned. If you have any specific requirements or questions regarding your production slate, please feel free to let us know.

Best regards,
Stage Work Studio Administration
admin@stageworkstudio.com
https://www.stageworkstudio.com
`.trim();

  return { subject, html, text };
}
/**
 * Designer approval email with personal download button and license specs.
 * Clean, professional, and matching the original approval template.
 */
export function generateDesktopTrialApprovalEmail({ name, email, downloadUrl, expiryDays = 7, maxDownloads = 5 }) {
  const recipientName = name ? escapeHtml(name) : 'there';
  const recipientEmail = escapeHtml(email);
  const safeDownloadUrl = escapeHtml(downloadUrl);

  const subject = `🎬 Your Stage Work Studio App Download is Approved — Welcome to Stage Work Studio`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Stage Work Studio App Download</title>
</head>
<body style="margin:0;padding:0;background-color:#070605;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#e8e2d8;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#070605;padding:36px 14px 50px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:580px;background-color:#12100d;border:1px solid #28221a;border-radius:14px;overflow:hidden;box-shadow:0 24px 50px rgba(0,0,0,0.75);">
          
          <!-- Header Bar with Gold Top Accent -->
          <tr>
            <td style="background:linear-gradient(90deg, #8d7042, #c9a36a, #e8d4a8, #c9a36a, #8d7042);height:4px;"></td>
          </tr>

          <!-- Brand & Category Header -->
          <tr>
            <td style="padding:32px 34px 20px;text-align:center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 14px;">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" width="46" height="46" alt="Stage Work Studio" style="display:block;border-radius:10px;border:1px solid #2e2821;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:0.24em;color:#c9a36a;text-transform:uppercase;">
                STAGE WORK STUDIO · CINEMA PRODUCTION OS
              </p>
              <h1 style="margin:0;font-size:22px;font-weight:700;color:#fdfbf7;letter-spacing:-0.01em;">
                Your App Download is Approved
              </h1>
              <p style="margin:8px 0 0;font-size:13px;color:#9e9587;font-style:italic;">
                "From Script to Screen at the Speed of Thought."
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 34px;">
              <hr style="border:none;border-top:1px solid #221d17;margin:0;">
            </td>
          </tr>

          <!-- Welcome & Download Section -->
          <tr>
            <td style="padding:26px 34px 24px;">
              <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#f4ecde;">
                Hi <strong>${recipientName}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#d6cfc4;">
                Thank you for your interest in <strong>Stage Work Studio</strong>! Your app download has been approved. You can download the application using your personal, secure link below:
              </p>

              <!-- Download Action Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg, #181512 0%, #13100d 100%);border:1px solid #382e22;border-left:4px solid #c9a36a;border-radius:10px;margin:20px 0 22px;padding:22px 18px;text-align:center;">
                <tr>
                  <td>
                    <span style="display:inline-block;background:#241d15;color:#e5c158;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid #453624;margin-bottom:12px;">
                      ✦ Secure Download Link Active ✦
                    </span>
                    <h2 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#fff;">
                      Stage Work Studio for macOS
                    </h2>
                    <p style="margin:0 0 18px;font-size:12px;color:#9e9587;">
                      Native Apple Silicon Performance · Zero Cloud Lag
                    </p>

                    <!-- CTA Button -->
                    <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td align="center" style="border-radius:8px;background:linear-gradient(135deg, #d4af37 0%, #aa842c 100%);box-shadow:0 4px 18px rgba(212,175,55,0.3);">
                          <a href="${safeDownloadUrl}" target="_blank" style="font-size:13px;font-weight:700;color:#0b0a09;text-decoration:none;padding:13px 26px;display:inline-block;letter-spacing:0.04em;">
                            DOWNLOAD APP
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:16px 0 0;font-size:11px;color:#857c70;line-height:1.5;">
                      Personal License for <strong>${recipientEmail}</strong><br>
                      Valid for <strong>${expiryDays} days</strong> · Up to <strong>${maxDownloads} downloads</strong><br>
                      Sign in with <strong>${recipientEmail}</strong> after launch.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Plain Link Fallback -->
              <p style="margin:0 0 20px;font-size:11px;color:#7a7266;line-height:1.5;word-break:break-all;">
                Direct link fallback:<br>
                <a href="${safeDownloadUrl}" style="color:#c9a36a;text-decoration:none;">${safeDownloadUrl}</a>
              </p>

              <!-- macOS Installation Tip -->
              <div style="background:#0f0d0b;border:1px dashed #30281e;border-radius:8px;padding:12px 14px;font-size:11px;line-height:1.55;color:#8a8274;margin-bottom:20px;">
                <strong style="color:#c9a36a;">macOS Install:</strong> If macOS warns on first launch, right-click <strong>Stage Work Studio.app</strong> &rarr; select <strong>Open</strong>, or run: <code>xattr -cr "/Applications/Stage Work Studio.app"</code>.
              </div>

              <!-- Signature -->
              <div style="background:#0e0d0b;border:1px solid #231f1a;border-radius:10px;padding:16px 18px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#fdfbf7;">
                  Best regards,
                </p>
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#c9a36a;">
                  Stage Work Studio Administration
                </p>
                <p style="margin:0 0 2px;font-size:12px;color:#9e9587;">
                  <a href="mailto:admin@stageworkstudio.com" style="color:#c9a36a;text-decoration:none;">admin@stageworkstudio.com</a>
                </p>
                <p style="margin:0;font-size:12px;color:#9e9587;">
                  <a href="https://www.stageworkstudio.com" style="color:#c9a36a;text-decoration:none;">https://www.stageworkstudio.com</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0b0a09;border-top:1px solid #1c1813;padding:22px 34px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b6459;letter-spacing:0.12em;text-transform:uppercase;">
                STAGE WORK STUDIO · THE OPERATING SYSTEM FOR VISIONARY CINEMA
              </p>
              <p style="margin:0;font-size:11px;color:#575147;">
                <a href="https://www.stageworkstudio.com" style="color:#857c6e;text-decoration:none;">www.stageworkstudio.com</a> &nbsp;|&nbsp; 
                <a href="mailto:admin@stageworkstudio.com" style="color:#857c6e;text-decoration:none;">admin@stageworkstudio.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
Hi ${name || 'there'},

Thank you for your interest in Stage Work Studio!

Your app download has been approved. You can download the application using your personal, secure link below:
${downloadUrl}

(Note: This personal link is valid for ${expiryDays} days and up to ${maxDownloads} downloads. Sign in with ${email} after launch.)

macOS Installation:
Right-click "Stage Work Studio.app" -> select Open, or run: xattr -cr "/Applications/Stage Work Studio.app"

If you have any questions or feedback, feel free to reply directly to this email.

Best regards,
Stage Work Studio Administration
admin@stageworkstudio.com
https://www.stageworkstudio.com
`.trim();

  return { subject, html, text };
}

/**
 * Access Request Confirmation Email template.
 */
export function generateAccessRequestConfirmationEmail({ name, email, role }) {
  const recipientName = name ? escapeHtml(name) : 'Collaborator';
  const recipientRole = role ? escapeHtml(role) : 'Creative Production';

  const subject = `🎬 Stage Work Studio — Access Request Received & Under Review`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Access Request Received &amp; Under Review</title>
</head>
<body style="margin:0;padding:0;background-color:#070605;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#e8e2d8;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#070605;padding:30px 12px 50px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;background-color:#12100d;border:1px solid #2d261e;border-radius:16px;overflow:hidden;box-shadow:0 20px 45px rgba(0,0,0,0.75);">
          
          <tr>
            <td style="background:linear-gradient(90deg, #997838, #e5c158, #997838);height:4px;"></td>
          </tr>

          <tr>
            <td style="padding:32px 36px 20px;text-align:center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 16px;">
                <tr>
                  <td align="center">
                    <img src="https://www.stageworkstudio.com/brand/stageworks-mark.png" width="48" height="48" alt="Stage Work Studio" style="display:block;border-radius:11px;border:1px solid #2e2821;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.24em;color:#c9a36a;text-transform:uppercase;">
                STAGE WORK STUDIO · CINEMA PRODUCTION OS
              </p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#fdfbf7;letter-spacing:-0.02em;">
                Access Request Received &amp; In Review
              </h1>
              <p style="margin:10px 0 0;font-size:14px;color:#a89f91;font-style:italic;">
                "Where Cinematic Vision Meets Next-Generation AI."
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #241f1a;margin:0;">
            </td>
          </tr>

          <tr>
            <td style="padding:28px 36px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e8e2d8;">
                Dear <strong>${recipientName}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#ccc5b9;">
                Thank you for showing interest in <strong>Stage Work Studio (SWS)</strong>. We have successfully received your access request for the <strong>${recipientRole}</strong> workstation profile.
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#ccc5b9;">
                Our studio executive administration is actively reviewing your application. Workstation seats and production slate permissions are provisioned to maintain an uncompromised, synchronized creative environment.
              </p>

              <div style="background:#171410;border:1px solid #383127;border-left:4px solid #c9a36a;border-radius:8px;padding:16px 20px;margin:24px 0;">
                <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#c9a36a;text-transform:uppercase;letter-spacing:0.14em;">
                  Status: Priority Slate Review
                </p>
                <p style="margin:0;font-size:13px;color:#e8e2d7;line-height:1.5;">
                  Your allotment credentials and verification key will be dispatched to this inbox directly from <strong>admin@stageworkstudio.com</strong> upon executive approval.
                </p>
              </div>

              <!-- USPs -->
              <div style="background:#0c0a09;border:1px solid #26201a;border-radius:10px;padding:20px;margin-top:24px;">
                <p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:0.18em;color:#c9a36a;text-transform:uppercase;">
                  WHAT TO EXPECT IN STAGE WORK STUDIO:
                </p>
                <p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#b8b0a2;">
                  ✦ <strong>Unified Slate Management:</strong> Break down scripts, generate 4K continuity shotlists, and lock actor consistency in one seamless environment.
                </p>
                <p style="margin:0 0 10px;font-size:13px;line-height:1.55;color:#b8b0a2;">
                  ✦ <strong>Director's 3D Virtual Stage:</strong> Block scenes in realtime 3D space with cinematic camera optics.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.55;color:#b8b0a2;">
                  ✦ <strong>Seedance Video &amp; Campaign Kit:</strong> Turn approved storyboards into dynamic video sequences, posters, and pitch decks with one click.
                </p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:0 36px 36px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#fdfbf7;">Executive Administration &amp; Operations</p>
              <p style="margin:0;font-size:12px;color:#8f877a;">Stage Work Studio — Cinema Production OS</p>
              <p style="margin:8px 0 0;font-size:12px;color:#c9a36a;">
                Need urgent production assistance? Contact us at <a href="mailto:admin@stageworkstudio.com" style="color:#e5c158;text-decoration:none;font-weight:600;">admin@stageworkstudio.com</a>.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0b0a09;border-top:1px solid #1f1a15;padding:22px 36px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#575147;">
                <a href="https://www.stageworkstudio.com" style="color:#857c6e;text-decoration:none;">www.stageworkstudio.com</a> &nbsp;|&nbsp; 
                <a href="mailto:admin@stageworkstudio.com" style="color:#857c6e;text-decoration:none;">admin@stageworkstudio.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
STAGE WORK STUDIO · CINEMA PRODUCTION OS
"Where Cinematic Vision Meets Next-Generation AI."

Dear ${name || 'Collaborator'},

Thank you for showing interest in Stage Work Studio (SWS). We have received your access request for the ${role || 'Creative Production'} workstation profile.

STATUS: Priority Slate Review
Your allotment credentials and verification key will be dispatched to this inbox directly from admin@stageworkstudio.com upon executive approval.

WHAT TO EXPECT IN STAGE WORK STUDIO:
• Unified Slate Management: Break down scripts, generate 4K continuity shotlists, and lock actor consistency.
• Director's 3D Virtual Stage: Block scenes in realtime 3D space with cinematic camera optics.
• Seedance Video & Campaign Kit: Turn approved storyboards into dynamic video sequences, posters, and pitch decks.

For urgent production assistance, reach out to studio administration at admin@stageworkstudio.com.

Sincerely,
Executive Administration & Operations
Stage Work Studio — Cinema Production OS
www.stageworkstudio.com | admin@stageworkstudio.com
`.trim();

  return { subject, html, text };
}

/**
 * Luxury cinema-grade cold promotional outreach email for studios, directors, and producers.
 */
export function generateColdPromotionalEmail({
  name = '',
  role = 'Director / Producer',
  studio = '',
  appUrl = 'https://www.stageworkstudio.com',
} = {}) {
  const recipientName = name ? escapeHtml(name) : 'there';
  const recipientRole = escapeHtml(role);
  const studioName = studio ? ` at ${escapeHtml(studio)}` : '';
  const cleanAppUrl = escapeHtml(appUrl);

  const subject = `🎬 For your next slate: Real-time 3D blocking & cinema AI continuity`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stage Work Studio — Cinema Production OS</title>
</head>
<body style="margin:0;padding:0;background-color:#070605;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#e8e2d8;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#070605;padding:40px 14px 60px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:590px;background-color:#12100d;border:1px solid #29221a;border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.8);">
          
          <!-- Top Gold Ribbon -->
          <tr>
            <td style="background:linear-gradient(90deg, #8d7042, #c9a36a, #e8d4a8, #c9a36a, #8d7042);height:4px;"></td>
          </tr>

          <!-- Brand Header -->
          <tr>
            <td style="padding:36px 36px 20px;text-align:center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 16px;">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" width="48" height="48" alt="Stage Work Studio" style="display:block;border-radius:12px;border:1px solid #2e2821;" />
                  </td>
                </tr>
              </table>
              <span style="display:inline-block;background:#1b1713;border:1px solid #3d3428;color:#c9a36a;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:12px;">
                ✦ VIP STUDIO PREVIEW · CINEMA PRODUCTION OS ✦
              </span>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#fdfbf7;letter-spacing:-0.02em;line-height:1.25;">
                From Script to Screen at the Speed of Thought
              </h1>
              <p style="margin:8px 0 0;font-size:13px;color:#9e9587;">
                The unified creative operating system built specifically for modern filmmakers.
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #241e17;margin:0;">
            </td>
          </tr>

          <!-- Personal Hook -->
          <tr>
            <td style="padding:28px 36px 20px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#f4ecde;">
                Hi <strong>${recipientName}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#d6cfc4;">
                If you're helming productions as a <strong>${recipientRole}</strong>${studioName}, you know the single biggest hurdle in pre-production: the costly lag between script breakdown, visual framing, and keeping 100% character continuity across 80+ shots.
              </p>
              <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#d6cfc4;">
                We built <strong>Stage Work Studio (SWS)</strong> to solve this end-to-end — combining native Apple Silicon performance with cinematic AI tooling that respects real film grammar.
              </p>

              <!-- 4 Value Pillars -->
              <div style="background:#0c0a09;border:1px solid #282119;border-radius:12px;padding:22px 20px;margin-bottom:24px;">
                <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.18em;color:#c9a36a;text-transform:uppercase;">
                  WHAT MAKES STAGE WORK STUDIO DIFFERENT:
                </p>

                <!-- Pillar 1 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:14px;">
                  <tr>
                    <td width="32" valign="top" style="font-size:18px;padding-top:2px;">🎥</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Direct Cinema 2.0 Engine:</strong>
                      Real-time 21:9 Ultrawide &amp; 2.39:1 Anamorphic framing, volumetric key-lighting, and Seedance video animations without leaving your slate.
                    </td>
                  </tr>
                </table>

                <!-- Pillar 2 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:14px;">
                  <tr>
                    <td width="32" valign="top" style="font-size:18px;padding-top:2px;">📐</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Director's 3D Virtual Stage:</strong>
                      Interactive 3D scene blocking, camera crane angles, and real lens focal previews before a single dollar is spent on rendering.
                    </td>
                  </tr>
                </table>

                <!-- Pillar 3 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:14px;">
                  <tr>
                    <td width="32" valign="top" style="font-size:18px;padding-top:2px;">🧬</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Intelligent Continuity Matrix:</strong>
                      Deep Character Bible locking preserves your actors' facial features, wardrobe, and mood consistently across 100+ storyboard shots.
                    </td>
                  </tr>
                </table>

                <!-- Pillar 4 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="32" valign="top" style="font-size:18px;padding-top:2px;">🛡️</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Local-First Security &amp; Speed:</strong>
                      Native desktop app running on Apple Silicon. Zero cloud lag, zero wait queues, and 100% intellectual property privacy.
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg, #181512 0%, #13100d 100%);border:1px solid #382e22;border-left:4px solid #c9a36a;border-radius:10px;margin-bottom:24px;padding:22px 20px;text-align:center;">
                <tr>
                  <td>
                    <h3 style="margin:0 0 6px;font-size:17px;font-weight:600;color:#fff;">
                      Experience Stage Work Studio
                    </h3>
                    <p style="margin:0 0 18px;font-size:12px;color:#9e9587;">
                      Preloaded with complete production slates (Jai Shri Ram, Malgudi Days, MVK).
                    </p>

                    <!-- Button -->
                    <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td align="center" style="border-radius:8px;background:linear-gradient(135deg, #d4af37 0%, #aa842c 100%);box-shadow:0 4px 18px rgba(212,175,55,0.3);">
                          <a href="${cleanAppUrl}" target="_blank" style="font-size:13px;font-weight:700;color:#0b0a09;text-decoration:none;padding:13px 26px;display:inline-block;letter-spacing:0.04em;">
                            ⚡ EXPLORE STUDIO OS &amp; GET VIP ACCESS
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:16px 0 0;font-size:11px;color:#857c70;">
                      Or request to download the app at <a href="${cleanAppUrl}" style="color:#c9a36a;text-decoration:none;">${cleanAppUrl}</a>
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#ccc5b9;">
                Would you be open to a 5-minute private walk-through on how SWS can accelerate your upcoming slate? Simply hit reply or write directly to <a href="mailto:admin@stageworkstudio.com" style="color:#c9a36a;text-decoration:none;font-weight:600;">admin@stageworkstudio.com</a>.
              </p>

              <!-- Signature -->
              <div style="background:#0e0d0b;border:1px solid #231f1a;border-radius:10px;padding:16px 18px;">
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#fdfbf7;">
                  Best regards,
                </p>
                <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#c9a36a;">
                  Stage Work Studio Administration
                </p>
                <p style="margin:0 0 2px;font-size:12px;color:#9e9587;">
                  Stage Work Studio — Cinema Production OS
                </p>
                <p style="margin:0 0 2px;font-size:12px;color:#9e9587;">
                  <a href="mailto:admin@stageworkstudio.com" style="color:#c9a36a;text-decoration:none;">admin@stageworkstudio.com</a>
                </p>
                <p style="margin:0;font-size:12px;color:#9e9587;">
                  <a href="${cleanAppUrl}" style="color:#c9a36a;text-decoration:none;">${cleanAppUrl}</a>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0b0a09;border-top:1px solid #1c1813;padding:22px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;color:#6b6459;letter-spacing:0.12em;text-transform:uppercase;">
                STAGE WORK STUDIO · THE OPERATING SYSTEM FOR VISIONARY CINEMA
              </p>
              <p style="margin:0;font-size:11px;color:#575147;">
                <a href="${cleanAppUrl}" style="color:#857c6e;text-decoration:none;">www.stageworkstudio.com</a> &nbsp;|&nbsp; 
                <a href="mailto:admin@stageworkstudio.com" style="color:#857c6e;text-decoration:none;">admin@stageworkstudio.com</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  const text = `
STAGE WORK STUDIO · CINEMA PRODUCTION OS
"From Script to Screen at the Speed of Thought."

Hi ${name || 'there'},

If you're helming productions as a ${role}${studio ? ` at ${studio}` : ''}, you know the single biggest hurdle in pre-production: the costly lag between script breakdown, visual framing, and keeping 100% character continuity across 80+ shots.

We built Stage Work Studio (SWS) to solve this end-to-end — combining native Apple Silicon performance with cinematic AI tooling that respects real film grammar.

WHAT MAKES STAGE WORK STUDIO DIFFERENT:
• Direct Cinema 2.0 Engine: Real-time 21:9 Ultrawide & 2.39:1 Anamorphic framing, volumetric key-lighting, and Seedance video animations without leaving your slate.
• Director's 3D Virtual Stage: Interactive 3D scene blocking, camera crane angles, and real lens focal previews before a single dollar is spent on rendering.
• Intelligent Continuity Matrix: Deep Character Bible locking preserves your actors' facial features, wardrobe, and mood consistently across 100+ storyboard shots.
• Local-First Security & Speed: Native desktop app running on Apple Silicon. Zero cloud lag, zero wait queues, and 100% intellectual property privacy.

EXPERIENCE STAGE WORK STUDIO:
Explore our live production slates (including "Jai Shri Ram" with 80+ shots, "Malgudi Days", and "MVK") directly in the workspace:
${appUrl}

Would you be open to a 5-minute private walk-through on how SWS can accelerate your upcoming slate? Simply hit reply or write directly to admin@stageworkstudio.com.

Best regards,
Stage Work Studio Administration
Stage Work Studio — Cinema Production OS
admin@stageworkstudio.com
${appUrl}
`.trim();

  return { subject, html, text };
}
