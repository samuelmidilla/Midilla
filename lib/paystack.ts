import crypto from 'crypto';
import type { TierSlug } from '@/types';

const PAYSTACK_BASE = 'https://api.paystack.co';
const SECRET_KEY    = process.env.PAYSTACK_SECRET_KEY!;

export const PLAN_CODES: Record<Exclude<TierSlug, 'architect'>, string> = {
  starter:      process.env.PAYSTACK_PLAN_STARTER!,
  professional: process.env.PAYSTACK_PLAN_PROFESSIONAL!,
};

export const TIER_CREDITS: Record<TierSlug, number> = {
  starter:      60,
  professional: 250,
  architect:    0,
};

export const TIER_PRICES_KOBO: Record<Exclude<TierSlug, 'architect'>, number> = {
  starter:      2400000,
  professional: 7200000,
};

export const TOPUP_BUNDLES = [
  { id: 'topup_50',  credits: 50,  price_kobo: 425000,  label: '50 credits' },
  { id: 'topup_100', credits: 100, price_kobo: 800000,  label: '100 credits' },
  { id: 'topup_200', credits: 200, price_kobo: 1500000, label: '200 credits' },
] as const;

export type TopupBundleId = typeof TOPUP_BUNDLES[number]['id'];

async function paystackFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${SECRET_KEY}`,
      'Content-Type':  'application/json',
      ...options.headers,
    },
  });
  const data = await response.json();
  if (!response.ok || !data.status) {
    throw new PaystackError(data.message ?? `Paystack request failed: ${path}`, response.status, data);
  }
  return data.data as T;
}

export class PaystackError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly raw: unknown) {
    super(message);
    this.name = 'PaystackError';
  }
}

export interface InitializeSubscriptionParams {
  email: string;
  tier_slug: Exclude<TierSlug, 'architect'>;
  callback_url: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export async function initializeSubscription(params: InitializeSubscriptionParams): Promise<PaystackInitializeResponse> {
  const plan_code = PLAN_CODES[params.tier_slug];
  return paystackFetch<PaystackInitializeResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: TIER_PRICES_KOBO[params.tier_slug],
      plan: plan_code,
      callback_url: params.callback_url,
      metadata: { ...params.metadata, midilla_tier: params.tier_slug, midilla_purpose: 'subscription' },
    }),
  });
}

export interface InitializeTopupParams {
  email: string;
  bundle_id: TopupBundleId;
  user_id: string;
  callback_url: string;
}

export async function initializeTopup(params: InitializeTopupParams): Promise<PaystackInitializeResponse> {
  const bundle = TOPUP_BUNDLES.find(b => b.id === params.bundle_id);
  if (!bundle) throw new Error(`Unknown bundle_id: ${params.bundle_id}`);
  return paystackFetch<PaystackInitializeResponse>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: bundle.price_kobo,
      callback_url: params.callback_url,
      metadata: {
        midilla_user_id: params.user_id,
        midilla_bundle_id: params.bundle_id,
        midilla_credits: bundle.credits,
        midilla_purpose: 'topup',
      },
    }),
  });
}

export interface PaystackTransaction {
  id: number;
  reference: string;
  status: 'success' | 'failed' | 'abandoned';
  amount: number;
  currency: string;
  paid_at: string;
  customer: { id: number; email: string; customer_code: string };
  plan: string | null;
  plan_object: { plan_code: string; name: string } | null;
  subscription: { subscription_code: string } | null;
  metadata: Record<string, unknown>;
}

export async function verifyTransaction(reference: string): Promise<PaystackTransaction> {
  return paystackFetch<PaystackTransaction>(`/transaction/verify/${reference}`);
}

export interface PaystackSubscription {
  subscription_code: string;
  plan: { plan_code: string; name: string };
  status: 'active' | 'non-renewing' | 'attention' | 'completed' | 'cancelled';
  next_payment_date: string;
  customer: { customer_code: string; email: string };
}

export async function fetchSubscription(subscription_code: string): Promise<PaystackSubscription> {
  return paystackFetch<PaystackSubscription>(`/subscription/${subscription_code}`);
}

export async function cancelSubscription(params: { code: string; token: string }): Promise<void> {
  await paystackFetch('/subscription/disable', {
    method: 'POST',
    body: JSON.stringify({ code: params.code, token: params.token }),
  });
}

export function verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
  const webhookSecret = process.env.PAYSTACK_WEBHOOK_SECRET ?? SECRET_KEY;
  const expected = crypto.createHmac('sha512', webhookSecret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

export type PaystackWebhookEvent =
  | ChargeSuccessEvent
  | SubscriptionCreateEvent
  | SubscriptionDisableEvent
  | InvoiceUpdateEvent;

export interface ChargeSuccessEvent {
  event: 'charge.success';
  data: PaystackTransaction & { subscription?: { subscription_code: string } };
}

export interface SubscriptionCreateEvent {
  event: 'subscription.create';
  data: {
    subscription_code: string;
    plan: { plan_code: string; name: string };
    customer: { email: string; customer_code: string };
    next_payment_date: string;
  };
}

export interface SubscriptionDisableEvent {
  event: 'subscription.disable';
  data: {
    subscription_code: string;
    customer: { email: string; customer_code: string };
    reason: string;
  };
}

export interface InvoiceUpdateEvent {
  event: 'invoice.update';
  data: {
    subscription: { subscription_code: string };
    transaction: { reference: string; status: string };
    paid: boolean;
    next_payment_date: string;
  };
}

export function tierSlugFromPlanCode(plan_code: string): Exclude<TierSlug, 'architect'> | null {
  for (const [slug, code] of Object.entries(PLAN_CODES)) {
    if (code === plan_code) return slug as Exclude<TierSlug, 'architect'>;
  }
  return null;
}
