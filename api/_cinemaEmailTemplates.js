/**
 * Designer HTML Email Templates for Stage Work Studio.
 * Matches the exact visual identity of stageworkstudio.com:
 * Obsidian dark (#0b0a09), warm gold (#c9a36a), clean status chips,
 * minimalist luxury typography, and high-impact action buttons.
 */

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const LOGO_URL = 'https://www.stageworkstudio.com/brand/stageworks-mark.png';

/**
 * Designer desktop trial approval email matching stageworkstudio.com.
 */
export function generateDesktopTrialApprovalEmail({ name, email, downloadUrl, expiryDays = 7, maxDownloads = 5 }) {
  const recipientName = name ? escapeHtml(name) : 'Creator';
  const recipientEmail = escapeHtml(email);
  const safeDownloadUrl = escapeHtml(downloadUrl);

  const subject = `🎬 Your Stage Work Studio Desktop Access is Ready`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stage Work Studio — Desktop Access</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#f4ecde;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0a09;padding:40px 16px 60px;">
    <tr>
      <td align="center">
        <!-- Main Panel -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#141210;border:1px solid #26221e;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.65);">
          
          <!-- Top Gold Accent -->
          <tr>
            <td style="background:linear-gradient(90deg, #8d7042, #c9a36a, #e8d4a8, #c9a36a, #8d7042);height:3px;"></td>
          </tr>

          <!-- Brand Header -->
          <tr>
            <td style="padding:36px 32px 24px;text-align:center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 16px;">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" width="44" height="44" alt="Stage Work Studio" style="display:block;border-radius:10px;border:1px solid #2e2821;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.24em;color:#f4ecde;text-transform:uppercase;">
                STAGE WORK STUDIO
              </p>
              <p style="margin:0;font-size:9.5px;font-weight:600;letter-spacing:0.28em;color:#c9a36a;text-transform:uppercase;">
                AI CINEMA PRODUCTION OS
              </p>
            </td>
          </tr>

          <!-- Subtle Separator -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #201c18;margin:0;">
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:28px 32px 24px;">
              
              <!-- Status Chip -->
              <div style="text-align:center;margin-bottom:20px;">
                <span style="display:inline-block;background:#1a1713;border:1px solid #3d3428;color:#c9a36a;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:5px 14px;border-radius:20px;">
                  <span style="color:#4ade80;margin-right:4px;">●</span> WORKSTATION ACCESS APPROVED
                </span>
              </div>

              <h2 style="margin:0 0 10px;font-size:20px;font-weight:600;color:#fdfbf7;text-align:center;letter-spacing:-0.01em;">
                Your Mac Desktop Build is Ready
              </h2>
              <p style="margin:0 0 24px;font-size:13px;line-height:1.6;color:#938b80;text-align:center;">
                Hi <strong>${recipientName}</strong>, your personal desktop trial has been provisioned. Experience local-first AI cinema production with zero cloud latency.
              </p>

              <!-- Primary CTA Button -->
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 26px;">
                <tr>
                  <td align="center" style="border-radius:8px;background:linear-gradient(135deg, #d4af37 0%, #aa842c 100%);box-shadow:0 4px 20px rgba(201,163,106,0.32);">
                    <a href="${safeDownloadUrl}" target="_blank" style="font-size:13px;font-weight:700;color:#0f0d0b;text-decoration:none;padding:14px 32px;display:inline-block;letter-spacing:0.04em;">
                      DOWNLOAD FOR MAC (APPLE SILICON) &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Spec Details Card -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#0e0d0b;border:1px solid #231f1a;border-radius:10px;padding:16px 18px;margin-bottom:22px;">
                <tr>
                  <td width="50%" style="padding:4px 0;font-size:11px;color:#787167;">
                    AUTHORIZED ACCOUNT
                  </td>
                  <td width="50%" align="right" style="padding:4px 0;font-size:11px;font-weight:600;color:#f4ecde;font-family:monospace;">
                    ${recipientEmail}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:4px 0;font-size:11px;color:#787167;">
                    TARGET ARCHITECTURE
                  </td>
                  <td width="50%" align="right" style="padding:4px 0;font-size:11px;font-weight:600;color:#f4ecde;">
                    macOS (M1 / M2 / M3 / M4)
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:4px 0;font-size:11px;color:#787167;">
                    LICENSE DURATION
                  </td>
                  <td width="50%" align="right" style="padding:4px 0;font-size:11px;font-weight:600;color:#c9a36a;">
                    ${expiryDays} Days (${maxDownloads} Downloads)
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:4px 0;font-size:11px;color:#787167;">
                    WORKSPACE SUITE
                  </td>
                  <td width="50%" align="right" style="padding:4px 0;font-size:11px;font-weight:600;color:#f4ecde;">
                    Full Studio OS Suite
                  </td>
                </tr>
              </table>

              <!-- Feature Tags (Matching Website UI Chips) -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:22px;">
                <tr>
                  <td align="center">
                    <span style="display:inline-block;background:#191613;border:1px solid #2d261e;color:#b0a89b;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;margin:2px 4px;">
                      ✦ Direct Cinema 2.0
                    </span>
                    <span style="display:inline-block;background:#191613;border:1px solid #2d261e;color:#b0a89b;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;margin:2px 4px;">
                      ✦ 3D Virtual Stage
                    </span>
                    <span style="display:inline-block;background:#191613;border:1px solid #2d261e;color:#b0a89b;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;margin:2px 4px;">
                      ✦ Character Continuity
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Installation Tip -->
              <p style="margin:0 0 16px;font-size:11px;line-height:1.5;color:#6b6459;text-align:center;background:#0d0c0a;border:1px dashed #241f19;border-radius:6px;padding:10px 12px;">
                <strong style="color:#a89f91;">First Launch:</strong> Right-click <strong>Stage Work Studio.app</strong> &rarr; select <strong>Open</strong> to initialize, then sign in with <strong>${recipientEmail}</strong>.
              </p>

              <!-- Plain Link Fallback -->
              <p style="margin:0;font-size:10px;color:#575147;text-align:center;word-break:break-all;">
                Link: <a href="${safeDownloadUrl}" style="color:#8d7042;text-decoration:none;">${safeDownloadUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Minimalist Sign-off & Footer -->
          <tr>
            <td style="background-color:#0e0d0b;border-top:1px solid #1c1915;padding:24px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#c9a36a;letter-spacing:0.08em;">
                "From Script to Screen at the Speed of Thought."
              </p>
              <p style="margin:0 0 12px;font-size:11px;color:#787167;">
                Stage Work Studio Operations
              </p>
              <p style="margin:0;font-size:10px;color:#4a453d;">
                <a href="https://www.stageworkstudio.com" style="color:#6b6459;text-decoration:none;">stageworkstudio.com</a> &nbsp;&bull;&nbsp; 
                <a href="mailto:admin@stageworkstudio.com" style="color:#6b6459;text-decoration:none;">admin@stageworkstudio.com</a>
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

Hi ${name || 'there'},

Your personal desktop build of Stage Work Studio has been approved for active creative development.

DOWNLOAD FOR MAC (APPLE SILICON):
${downloadUrl}

DETAILS:
• Account: ${email}
• Architecture: macOS (M1 / M2 / M3 / M4)
• License: ${expiryDays} Days (up to ${maxDownloads} downloads)
• Suite: Full Studio OS Suite (Direct Cinema 2.0 · 3D Virtual Stage · Continuity Matrix)

FIRST LAUNCH:
Right-click "Stage Work Studio.app" -> select Open, then sign in with ${email}.

For questions or production inquiries, reply directly to admin@stageworkstudio.com.

Stage Work Studio Operations
admin@stageworkstudio.com · www.stageworkstudio.com
`.trim();

  return { subject, html, text };
}

/**
 * Designer access request confirmation email matching stageworkstudio.com.
 */
export function generateAccessRequestConfirmationEmail({ name, email, role }) {
  const recipientName = name ? escapeHtml(name) : 'Collaborator';
  const recipientRole = role ? escapeHtml(role) : 'Creative Production';

  const subject = `🎬 Stage Work Studio — Access Request Received`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stage Work Studio — Access Request Received</title>
</head>
<body style="margin:0;padding:0;background-color:#0b0a09;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#f4ecde;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0b0a09;padding:40px 16px 60px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background-color:#141210;border:1px solid #26221e;border-radius:14px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.65);">
          
          <tr>
            <td style="background:linear-gradient(90deg, #8d7042, #c9a36a, #e8d4a8, #c9a36a, #8d7042);height:3px;"></td>
          </tr>

          <tr>
            <td style="padding:36px 32px 24px;text-align:center;">
              <table border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 16px;">
                <tr>
                  <td align="center">
                    <img src="${LOGO_URL}" width="44" height="44" alt="Stage Work Studio" style="display:block;border-radius:10px;border:1px solid #2e2821;" />
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.24em;color:#f4ecde;text-transform:uppercase;">
                STAGE WORK STUDIO
              </p>
              <p style="margin:0;font-size:9.5px;font-weight:600;letter-spacing:0.28em;color:#c9a36a;text-transform:uppercase;">
                AI CINEMA PRODUCTION OS
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #201c18;margin:0;">
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 24px;">
              
              <div style="text-align:center;margin-bottom:20px;">
                <span style="display:inline-block;background:#1a1713;border:1px solid #3d3428;color:#c9a36a;font-size:10px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:5px 14px;border-radius:20px;">
                  <span style="color:#eab308;margin-right:4px;">●</span> APPLICATION UNDER REVIEW
                </span>
              </div>

              <h2 style="margin:0 0 10px;font-size:20px;font-weight:600;color:#fdfbf7;text-align:center;letter-spacing:-0.01em;">
                Access Request Received
              </h2>
              <p style="margin:0 0 20px;font-size:13px;line-height:1.6;color:#938b80;text-align:center;">
                Hi <strong>${recipientName}</strong>, thank you for your interest in Stage Work Studio. Your request for the <strong>${recipientRole}</strong> workstation profile has been recorded.
              </p>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background:#0e0d0b;border:1px solid #231f1a;border-radius:10px;padding:16px 18px;margin-bottom:22px;">
                <tr>
                  <td width="50%" style="padding:4px 0;font-size:11px;color:#787167;">
                    STATUS
                  </td>
                  <td width="50%" align="right" style="padding:4px 0;font-size:11px;font-weight:600;color:#eab308;">
                    Pending Executive Allotment
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:4px 0;font-size:11px;color:#787167;">
                    WORKSTATION ROLE
                  </td>
                  <td width="50%" align="right" style="padding:4px 0;font-size:11px;font-weight:600;color:#f4ecde;">
                    ${recipientRole}
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:4px 0;font-size:11px;color:#787167;">
                    PROVISIONING CHANNEL
                  </td>
                  <td width="50%" align="right" style="padding:4px 0;font-size:11px;font-weight:600;color:#c9a36a;">
                    admin@stageworkstudio.com
                  </td>
                </tr>
              </table>

              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom:20px;">
                <tr>
                  <td align="center">
                    <span style="display:inline-block;background:#191613;border:1px solid #2d261e;color:#b0a89b;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;margin:2px 4px;">
                      ✦ Direct Cinema 2.0
                    </span>
                    <span style="display:inline-block;background:#191613;border:1px solid #2d261e;color:#b0a89b;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;margin:2px 4px;">
                      ✦ 3D Virtual Stage
                    </span>
                    <span style="display:inline-block;background:#191613;border:1px solid #2d261e;color:#b0a89b;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;margin:2px 4px;">
                      ✦ Continuity Bible
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:12px;line-height:1.55;color:#787167;text-align:center;">
                Your verification key and workspace credentials will be dispatched directly upon review completion.
              </p>
            </td>
          </tr>

          <tr>
            <td style="background-color:#0e0d0b;border-top:1px solid #1c1915;padding:24px 32px;text-align:center;">
              <p style="margin:0 0 4px;font-size:12px;font-weight:600;color:#c9a36a;letter-spacing:0.08em;">
                "From Script to Screen at the Speed of Thought."
              </p>
              <p style="margin:0 0 12px;font-size:11px;color:#787167;">
                Stage Work Studio Operations
              </p>
              <p style="margin:0;font-size:10px;color:#4a453d;">
                <a href="https://www.stageworkstudio.com" style="color:#6b6459;text-decoration:none;">stageworkstudio.com</a> &nbsp;&bull;&nbsp; 
                <a href="mailto:admin@stageworkstudio.com" style="color:#6b6459;text-decoration:none;">admin@stageworkstudio.com</a>
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

Hi ${name || 'Collaborator'},

Thank you for your interest in Stage Work Studio. Your access request for the ${role || 'Creative Production'} workstation profile has been received and is currently under executive review.

STATUS: Pending Executive Allotment
Your verification key and workspace credentials will be dispatched directly upon review completion.

Stage Work Studio Operations
admin@stageworkstudio.com · www.stageworkstudio.com
`.trim();

  return { subject, html, text };
}
