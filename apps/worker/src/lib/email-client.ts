import { Resend } from 'resend';

import type { EnvConfig } from '../env';

export type EmailResult = {
  sent: boolean;
  reason?: string;
};

type ResendClient = {
  resend: Resend;
  from: string;
};

export function getResendClient(env: EnvConfig): ResendClient | null {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return null;
  }

  return {
    resend: new Resend(env.RESEND_API_KEY),
    from: env.RESEND_FROM_EMAIL,
  };
}

export function getMissingEmailConfigReason(): string {
  return 'missing RESEND_API_KEY or RESEND_FROM_EMAIL';
}

export function getResendMissingMessageIdReason(action: string): string {
  return `resend returned no message id for ${action}`;
}

export async function sendResendEmail(
  client: ResendClient,
  request: {
    to: string;
    subject: string;
    html: string;
    text: string;
  },
  action: string,
): Promise<EmailResult> {
  try {
    const response = await client.resend.emails.send({
      from: client.from,
      to: request.to,
      subject: request.subject,
      html: request.html,
      text: request.text,
    });

    if (response.error || !response.data?.id) {
      return {
        sent: false,
        reason: response.error?.message ?? getResendMissingMessageIdReason(action),
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : `unknown ${action} error`,
    };
  }
}
