export type EmailAction = {
  text: string;
  href: string;
};

export type EmailShellInput = {
  preheader: string;
  eyebrow: string;
  title: string;
  intro: string;
  contentHtml: string;
  action?: EmailAction;
  footer?: string;
};

export const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

export const renderEmailShell = (input: EmailShellInput): string => {
  const actionHtml = input.action
    ? `
      <tr>
        <td style="padding: 0 32px 26px;">
          <a
            href="${escapeHtml(input.action.href)}"
            style="display: inline-block; border-radius: 12px; background: #0f766e; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 12px 18px;"
          >
            ${escapeHtml(input.action.text)}
          </a>
        </td>
      </tr>
    `
    : '';

  const footerText = input.footer ?? 'This email was sent by App Store Price Radar.';

  return `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${escapeHtml(input.title)}</title>
    <style>
      @media (max-width: 620px) {
        .email-shell {
          width: 100% !important;
        }

        .email-pad {
          padding-left: 18px !important;
          padding-right: 18px !important;
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: #f3f6f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #18181b;">
    <div style="display: none; overflow: hidden; line-height: 1px; opacity: 0; max-height: 0; max-width: 0;">
      ${escapeHtml(input.preheader)}
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background: #f3f6f5;">
      <tr>
        <td align="center" style="padding: 26px 14px;">
          <table role="presentation" width="620" class="email-shell" cellspacing="0" cellpadding="0" border="0" style="width: 620px; max-width: 620px; border-collapse: collapse;">
            <tr>
              <td style="padding: 0 0 12px; font-size: 12px; letter-spacing: 0.14em; font-weight: 600; color: #475569; text-transform: uppercase;">
                ${escapeHtml(input.eyebrow)}
              </td>
            </tr>

            <tr>
              <td style="border-radius: 20px; border: 1px solid #e4e4e7; background: #ffffff; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.06);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse;">
                  <tr>
                    <td class="email-pad" style="padding: 30px 32px 10px;">
                      <p style="margin: 0; font-size: 26px; line-height: 1.2; letter-spacing: -0.01em; font-weight: 650; color: #111827;">
                        ${escapeHtml(input.title)}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td class="email-pad" style="padding: 0 32px 22px;">
                      <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #475569;">
                        ${escapeHtml(input.intro)}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td class="email-pad" style="padding: 0 32px 22px;">
                      ${input.contentHtml}
                    </td>
                  </tr>

                  ${actionHtml}

                  <tr>
                    <td class="email-pad" style="border-top: 1px solid #e4e4e7; padding: 14px 32px 20px;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.6; color: #6b7280;">
                        ${escapeHtml(footerText)}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
};
