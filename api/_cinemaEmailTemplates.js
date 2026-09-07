/**
 * Cinema-grade, high-conversion HTML email templates for Stage Work Studio.
 * Designed to build client trust, market SWS USPs, drive engagement, and showcase luxury studio branding.
 */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * High-conversion approval email with direct download link, USPs, studio mantra, and marketing highlights.
 */
export function generateDesktopTrialApprovalEmail({ name, email, downloadUrl, expiryDays = 7, maxDownloads = 5 }) {
  const recipientName = name ? escapeHtml(name) : 'Creator';
  const recipientEmail = escapeHtml(email);
  const safeDownloadUrl = escapeHtml(downloadUrl);

  const subject = `🎬 Your Stage Work Studio Desktop Trial is Approved — Welcome to AI Cinema`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Stage Work Studio Desktop Trial Access</title>
</head>
<body style="margin:0;padding:0;background-color:#070605;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#e8e2d8;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#070605;padding:30px 12px 50px;">
    <tr>
      <td align="center">
        <!-- Main Email Container -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:620px;background-color:#12100d;border:1px solid #2d261e;border-radius:16px;overflow:hidden;box-shadow:0 20px 45px rgba(0,0,0,0.75);">
          
          <!-- Header Bar with Gold Top Accent -->
          <tr>
            <td style="background:linear-gradient(90deg, #997838, #e5c158, #997838);height:4px;"></td>
          </tr>

          <!-- Brand & Category Header -->
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
                STAGE WORK STUDIO · AI CINEMA PRODUCTION OS
              </p>
              <h1 style="margin:0;font-size:26px;font-weight:700;color:#fdfbf7;letter-spacing:-0.02em;line-height:1.25;">
                Your Desktop Trial is Approved
              </h1>
              <p style="margin:10px 0 0;font-size:14px;color:#a89f91;font-style:italic;">
                "From Script to Screen at the Speed of Thought."
              </p>
            </td>
          </tr>

          <!-- Hero Divider -->
          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #241f1a;margin:0;">
            </td>
          </tr>

          <!-- Welcome & Download Section -->
          <tr>
            <td style="padding:28px 36px 24px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#e8e2d8;">
                Hi <strong>${recipientName}</strong>,
              </p>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#ccc5b9;">
                Welcome to the official creative suite. Your application for the <strong>Stage Work Studio Mac Desktop Edition</strong> has been reviewed and granted full VIP trial privileges.
              </p>

              <!-- Download Action Box -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg, #1c1813 0%, #16130f 100%);border:1px solid #3d3428;border-left:4px solid #c9a36a;border-radius:10px;margin:22px 0 24px;padding:24px 20px;text-align:center;">
                <tr>
                  <td>
                    <span style="display:inline-block;background:#292219;color:#e5c158;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:4px 10px;border-radius:20px;border:1px solid #4a3d2c;margin-bottom:14px;">
                      ✦ Secure Download Link Active ✦
                    </span>
                    <h2 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#fff;">
                      Stage Work Studio for macOS (Apple Silicon)
                    </h2>
                    <p style="margin:0 0 20px;font-size:12px;color:#9e9587;">
                      Version 2.5 · Local-First Native Performance · Zero Cloud Lag
                    </p>

                    <!-- CTA Button -->
                    <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto;">
                      <tr>
                        <td align="center" style="border-radius:8px;background:linear-gradient(135deg, #d4af37 0%, #aa842c 100%);box-shadow:0 4px 18px rgba(212,175,55,0.35);">
                          <a href="${safeDownloadUrl}" target="_blank" style="font-size:14px;font-weight:700;color:#0b0a09;text-decoration:none;padding:14px 28px;display:inline-block;letter-spacing:0.04em;">
                            ⚡ DOWNLOAD DESKTOP APP NOW
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:18px 0 0;font-size:11px;color:#857c70;line-height:1.5;">
                      Personalized License for <strong>${recipientEmail}</strong><br>
                      Valid for <strong>${expiryDays} days</strong> · Up to <strong>${maxDownloads} downloads</strong>
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Plain Link Fallback -->
              <p style="margin:0 0 24px;font-size:11px;color:#7a7266;line-height:1.5;word-break:break-all;">
                Direct URL fallback:<br>
                <a href="${safeDownloadUrl}" style="color:#c9a36a;text-decoration:none;">${safeDownloadUrl}</a>
              </p>
            </td>
          </tr>

          <!-- SWS Marketing Mantra & USP Showcase -->
          <tr>
            <td style="padding:0 36px 32px;">
              <div style="background:#0c0a09;border:1px solid #29231c;border-radius:12px;padding:24px;">
                <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.18em;color:#c9a36a;text-transform:uppercase;text-align:center;">
                  WHY TOP CREATORS &amp; STUDIOS CHOOSE STAGE WORK STUDIO
                </p>

                <!-- USP 1 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:14px;">
                  <tr>
                    <td width="36" valign="top" style="font-size:20px;padding-top:2px;">🎥</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Direct Cinema 2.0 Engine:</strong>
                      Real-time 21:9 Ultrawide &amp; 2.39:1 Anamorphic framing, Seedance video animation, and photorealistic lighting simulations built specifically for cinema directors.
                    </td>
                  </tr>
                </table>

                <!-- USP 2 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:14px;">
                  <tr>
                    <td width="36" valign="top" style="font-size:20px;padding-top:2px;">📐</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Director's 3D Virtual Stage:</strong>
                      Interactive 3D scene blocking, character positioning, lens focal length adjustments, and camera crane previews before a single dollar is spent on rendering.
                    </td>
                  </tr>
                </table>

                <!-- USP 3 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:14px;">
                  <tr>
                    <td width="36" valign="top" style="font-size:20px;padding-top:2px;">🧬</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Intelligent Continuity Matrix:</strong>
                      Deep Character Bible locking ensures your protagonist's facial features, wardrobe, and aesthetic DNA remain 100% consistent across all 100+ shots in your slate.
                    </td>
                  </tr>
                </table>

                <!-- USP 4 -->
                <table width="100%" border="0" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="36" valign="top" style="font-size:20px;padding-top:2px;">🛡️</td>
                    <td valign="top" style="font-size:13px;line-height:1.55;color:#d4cec3;">
                      <strong style="color:#fdfbf7;">Local-First Security &amp; Speed:</strong>
                      Heavy AI rendering runs locally on your Apple Silicon chip. Your scripts, pitch decks, and creative IP stay 100% in your control.
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>

          <!-- Promotional Material & VIP Inclusions -->
          <tr>
            <td style="padding:0 36px 32px;">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#171410;border:1px solid #332a1f;border-radius:10px;padding:20px;">
                <tr>
                  <td>
                    <h3 style="margin:0 0 10px;font-size:14px;color:#fdfbf7;font-weight:600;">
                      ✨ Included in Your Studio Trial:
                    </h3>
                    <ul style="margin:0;padding-left:18px;font-size:12px;line-height:1.75;color:#b5ad9f;">
                      <li>Complete access to Prompt Compiler, Storyboard Grid &amp; Promo Pack Engine</li>
                      <li>Sample Production Slates: <em>Jai Shri Ram</em> (80+ shots), <em>Malgudi Days</em>, and <em>MVK</em></li>
                      <li>Exportable Pitch Decks, Shot Breakdown Sheets, and Feature Reels</li>
                      <li>Direct access to Studio Administration for custom Enterprise integrations</li>
                    </ul>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Installation Guide & Gatekeeper Note -->
          <tr>
            <td style="padding:0 36px 28px;">
              <div style="background:#141210;border:1px dashed #3a3227;border-radius:8px;padding:14px 16px;font-size:11px;line-height:1.6;color:#8a8274;">
                <strong style="color:#c9a36a;">macOS Installation Tip:</strong> If macOS displays an unsigned developer alert upon first open, simply right-click <strong>Stage Work Studio.app</strong> &rarr; select <strong>Open</strong>, or run in Terminal: <code>xattr -cr "/Applications/Stage Work Studio.app"</code>. Then sign in using <strong>${recipientEmail}</strong>.
              </div>
            </td>
          </tr>

          <!-- Sign-Off & Official Studio Signature -->
          <tr>
            <td style="padding:0 36px 36px;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#fdfbf7;">
                Pedditi Ram &amp; The Stage Work Studio Team
              </p>
              <p style="margin:0;font-size:12px;color:#8f877a;">
                Executive Producer &amp; System Architect
              </p>
              <p style="margin:4px 0 0;font-size:12px;color:#8f877a;">
                Stage Work Studio — AI Cinema Production OS
              </p>
              <p style="margin:12px 0 0;font-size:12px;color:#c9a36a;">
                Have questions or need enterprise multi-seat licenses? Just reply directly to this email or write to <a href="mailto:admin@stageworkstudio.com" style="color:#e5c158;text-decoration:none;font-weight:600;">admin@stageworkstudio.com</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0b0a09;border-top:1px solid #1f1a15;padding:24px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;color:#6b6459;letter-spacing:0.12em;text-transform:uppercase;">
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
STAGE WORK STUDIO · AI CINEMA PRODUCTION OS
"From Script to Screen at the Speed of Thought."

Hi ${name || 'Creator'},

Your application for the Stage Work Studio Mac Desktop Edition has been approved with full VIP trial privileges!

--------------------------------------------------
DOWNLOAD YOUR DESKTOP TRIAL:
${downloadUrl}
--------------------------------------------------

Personal License: ${email}
Valid: ${expiryDays} days (up to ${maxDownloads} downloads)
Sign in with ${email} after installation.

WHY TOP STUDIOS CHOOSE SWS:
• Direct Cinema 2.0 Engine: Real-time 21:9 Ultrawide & 2.39:1 Anamorphic framing with photorealistic lighting simulations.
• Director's 3D Virtual Stage: Real-time blocking, camera crane angles, and set positioning before rendering.
• Intelligent Continuity Matrix: Deep Character Bible locking so your actors stay 100% consistent across 100+ shots.
• Local-First Speed: Heavy rendering on your Apple Silicon hardware with absolute creative privacy.

INCLUDED IN TRIAL:
- Full access to Prompt Compiler, Storyboard Grid, Promo Pack, and Feature Reel Generator
- Sample Production Slates: Jai Shri Ram, Malgudi Days, and MVK

macOS Installation:
Right-click "Stage Work Studio.app" -> select Open, or run: xattr -cr "/Applications/Stage Work Studio.app"

For inquiries or enterprise multi-seat slates, reach out to studio administration at admin@stageworkstudio.com.

Warm regards,
Pedditi Ram
Executive Producer & System Architect
Stage Work Studio — AI Cinema Production OS
www.stageworkstudio.com | admin@stageworkstudio.com
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
                STAGE WORK STUDIO · AI CINEMA PRODUCTION OS
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
              <p style="margin:0;font-size:12px;color:#8f877a;">Stage Work Studio — AI Cinema Production OS</p>
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
STAGE WORK STUDIO · AI CINEMA PRODUCTION OS
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
Stage Work Studio — AI Cinema Production OS
www.stageworkstudio.com | admin@stageworkstudio.com
`.trim();

  return { subject, html, text };
}
