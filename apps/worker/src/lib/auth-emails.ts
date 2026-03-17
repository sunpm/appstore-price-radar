import type { EnvConfig } from '../env';
import { escapeHtml, renderEmailShell } from './email-template';
import {
  getMissingEmailConfigReason,
  getResendClient,
  sendResendEmail,
  type EmailResult,
} from './email-client';

export const sendPasswordResetEmail = async (
  env: EnvConfig,
  to: string,
  token: string,
  expiresMinutes: number,
): Promise<EmailResult> => {
  const client = getResendClient(env);

  if (!client) {
    return { sent: false, reason: getMissingEmailConfigReason() };
  }

  const appBase = env.APP_BASE_URL ?? 'http://localhost:5173';
  const resetUrl = `${appBase.replace(/\/$/, '')}/auth?reset_token=${encodeURIComponent(token)}`;

  const contentHtml = `
    <div style="border-radius: 16px; border: 1px solid #e4e4e7; background: #f8fafc; padding: 14px; margin-bottom: 14px;">
      <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #334155;">
        我们收到了你的密码重置请求。点击下方按钮后可直接进入重置页，链接有效期为
        <strong>${expiresMinutes} 分钟</strong>。
      </p>
    </div>
    <div style="border-radius: 14px; border: 1px dashed #cbd5e1; background: #ffffff; padding: 12px 14px;">
      <p style="margin: 0 0 6px; font-size: 12px; color: #64748b;">手动输入 token（备用）</p>
      <p style="margin: 0; word-break: break-all; font-size: 13px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; color: #0f172a;">
        ${escapeHtml(token)}
      </p>
    </div>
  `;

  const html = renderEmailShell({
    preheader: '密码重置链接已生成',
    eyebrow: 'App Store Price Radar',
    title: '重置你的密码',
    intro: '如果本次操作是你本人发起，请在有效期内完成重置。',
    contentHtml,
    action: {
      text: '打开重置页面',
      href: resetUrl,
    },
    footer: '如果不是你本人操作，可忽略此邮件，你的账号不会被修改。',
  });

  return sendResendEmail(
    client,
    {
      to,
      subject: '[Price Radar] 重置密码',
      html,
      text: [
        '重置密码',
        `重置链接: ${resetUrl}`,
        `Token: ${token}`,
        `有效期: ${expiresMinutes} 分钟`,
        '如果不是你本人操作，可忽略此邮件。',
      ].join('\n'),
    },
    'reset email',
  );
};

export const sendLoginCodeEmail = async (
  env: EnvConfig,
  to: string,
  code: string,
  expiresMinutes: number,
): Promise<EmailResult> => {
  const client = getResendClient(env);

  if (!client) {
    return { sent: false, reason: getMissingEmailConfigReason() };
  }

  const contentHtml = `
    <div style="border-radius: 16px; border: 1px solid #e4e4e7; background: #f8fafc; padding: 14px; margin-bottom: 14px;">
      <p style="margin: 0; font-size: 14px; line-height: 1.8; color: #334155;">
        请在登录页面输入下面的 6 位验证码。验证码有效期 <strong>${expiresMinutes} 分钟</strong>。
      </p>
    </div>
    <div style="border-radius: 16px; border: 1px solid #d4d4d8; background: #ffffff; padding: 16px 14px; text-align: center;">
      <p style="margin: 0; font-size: 34px; line-height: 1; letter-spacing: 0.22em; font-weight: 700; color: #0f172a; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;">
        ${escapeHtml(code)}
      </p>
    </div>
  `;

  const html = renderEmailShell({
    preheader: `你的验证码是 ${code}`,
    eyebrow: 'App Store Price Radar',
    title: '邮箱验证码登录',
    intro: '若本次登录不是你本人发起，请忽略此邮件。',
    contentHtml,
    footer: '为保障账号安全，请勿将验证码泄露给他人。',
  });

  return sendResendEmail(
    client,
    {
      to,
      subject: `[Price Radar] 登录验证码 ${code}`,
      html,
      text: [
        '邮箱验证码登录',
        `验证码: ${code}`,
        `有效期: ${expiresMinutes} 分钟`,
        '若本次登录不是你本人发起，请忽略此邮件。',
      ].join('\n'),
    },
    'login code email',
  );
};
