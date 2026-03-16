import { Resend } from 'resend';

import type { EnvConfig } from '../env';
import { escapeHtml, renderEmailShell } from './email-template';

export type DropAlertPayload = {
  to: string;
  appName: string;
  appId: string;
  country: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
  targetPrice: number | null;
  storeUrl: string | null;
};

export type AlertResult = {
  sent: boolean;
  reason?: string;
};

const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const statRow = (label: string, value: string): string => {
  return `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #52525b; font-size: 13px; white-space: nowrap;">
        ${escapeHtml(label)}
      </td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e4e4e7; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">
        ${escapeHtml(value)}
      </td>
    </tr>
  `;
};

export const sendDropAlertEmail = async (
  env: EnvConfig,
  payload: DropAlertPayload,
): Promise<AlertResult> => {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL) {
    return {
      sent: false,
      reason: 'missing RESEND_API_KEY or RESEND_FROM_EMAIL',
    };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const oldText = formatMoney(payload.oldPrice, payload.currency);
  const newText = formatMoney(payload.newPrice, payload.currency);
  const targetText =
    payload.targetPrice === null
      ? '任意降价提醒'
      : `<= ${formatMoney(payload.targetPrice, payload.currency)}`;
  const dropPercent =
    payload.oldPrice > 0
      ? `${(((payload.oldPrice - payload.newPrice) / payload.oldPrice) * 100).toFixed(2)}%`
      : '-';

  const contentHtml = `
    <div style="border-radius: 16px; border: 1px solid #e4e4e7; background: #f8fafc; padding: 14px 14px 2px; margin-bottom: 14px;">
      <p style="margin: 0 0 6px; font-size: 16px; font-weight: 600; color: #0f172a;">${escapeHtml(payload.appName)}</p>
      <p style="margin: 0 0 12px; font-size: 12px; color: #64748b;">appId: ${escapeHtml(payload.appId)} · 地区: ${escapeHtml(payload.country)}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse: collapse; border-radius: 12px; overflow: hidden; background: #ffffff; border: 1px solid #e4e4e7;">
        ${statRow('原价格', oldText)}
        ${statRow('新价格', newText)}
        ${statRow('跌幅', dropPercent)}
        ${statRow('提醒条件', targetText)}
      </table>
    </div>
  `;

  const html = renderEmailShell({
    preheader: `${payload.appName} 价格下降到 ${newText}`,
    eyebrow: 'App Store Price Radar',
    title: '检测到价格下降',
    intro: `${payload.appName}（${payload.country}）出现降价，已达到你的提醒条件。`,
    contentHtml,
    action: payload.storeUrl
      ? {
          text: '打开 App Store',
          href: payload.storeUrl,
        }
      : undefined,
    footer: '你收到此邮件是因为开启了 App Store 价格监听。',
  });

  try {
    await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: payload.to,
      subject: `[Price Radar] ${payload.appName} 降价：${oldText} -> ${newText}`,
      html,
      text: [
        `价格下降提醒`,
        `${payload.appName} (${payload.country}) 已降价。`,
        `原价格: ${oldText}`,
        `新价格: ${newText}`,
        `跌幅: ${dropPercent}`,
        `提醒条件: ${targetText}`,
        payload.storeUrl ? `App Store: ${payload.storeUrl}` : '',
        `appId: ${payload.appId}`,
      ]
        .filter(Boolean)
        .join('\n'),
    });

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      reason: error instanceof Error ? error.message : 'unknown email send error',
    };
  }
};
