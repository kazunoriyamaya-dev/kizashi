/**
 * Stripe SDK インスタンス
 *
 * - Stripe Checkout（チケット販売）
 * - Stripe Webhook（決済確定）
 * - Stripe Connect（講師支払い）
 *
 * Phase 7 / P12 で本格実装。
 */
import Stripe from 'stripe';

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    throw new Error('[stripe] STRIPE_SECRET_KEY 未設定');
  }
  cached = new Stripe(secret, {
    apiVersion: '2024-12-18.acacia',
    typescript: true,
    appInfo: {
      name: 'Kizashi',
      version: '0.1.0',
    },
  });
  return cached;
}
