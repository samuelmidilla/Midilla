import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  verifyWebhookSignature,
  tierSlugFromPlanCode,
  TIER_CREDITS,
  TOPUP_BUNDLES,
  type PaystackWebhookEvent,
  type TopupBundleId,
} from '@/lib/paystack';

export async function POST(request: NextRequest) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature = request.headers.get('x-paystack-signature') ?? '';

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: PaystackWebhookEvent;
  try {
    event = JSON.parse(rawBody.toString());
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    switch (event.event) {
      case 'charge.success':
        await handleChargeSuccess(event);
        break;
      case 'subscription.create':
        await handleSubscriptionCreate(event);
        break;
      case 'subscription.disable':
        await handleSubscriptionDisable(event);
        break;
      case 'invoice.update':
        await handleInvoiceUpdate(event);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err);
  }

  return NextResponse.json({ received: true });
}

async function handleChargeSuccess(
  event: Extract<PaystackWebhookEvent, { event: 'charge.success' }>
): Promise<void> {
  const tx = event.data;
  const metadata = tx.metadata as Record<string, unknown>;
  const purpose = metadata?.midilla_purpose as string | undefined;
  const userId  = metadata?.midilla_user_id as string | undefined;

  if (!userId) return;

  const { data: existing } = await supabaseAdmin
    .from('credit_transactions')
    .select('id')
    .eq('description', `paystack:${tx.reference}`)
    .maybeSingle();

  if (existing) return;

  if (purpose === 'subscription' || tx.plan) {
    const planCode = tx.plan_object?.plan_code ?? tx.plan ?? '';
    const tierSlug = tierSlugFromPlanCode(planCode);
    if (!tierSlug) return;

    const creditsToAllocate = TIER_CREDITS[tierSlug];

    const { data: tier } = await supabaseAdmin
      .from('tiers')
      .select('id')
      .eq('slug', tierSlug)
      .single();

    if (!tier) return;

    const billingCycleStart = new Date();
    const billingCycleEnd   = new Date(billingCycleStart);
    billingCycleEnd.setDate(billingCycleEnd.getDate() + 30);

    await supabaseAdmin
      .from('profiles')
      .update({
        tier_id:              tier.id,
        billing_cycle_start:  billingCycleStart.toISOString(),
        billing_cycle_end:    billingCycleEnd.toISOString(),
        paystack_customer_id: tx.customer.customer_code,
        paystack_sub_code:    tx.subscription?.subscription_code ?? null,
      })
      .eq('id', userId);

    await supabaseAdmin.rpc('allocate_credits', {
      p_user_id:     userId,
      p_amount:      creditsToAllocate,
      p_description: `paystack:${tx.reference} · ${tierSlug} tier · ${creditsToAllocate} credits allocated`,
    });

    return;
  }

  if (purpose === 'topup') {
    const bundleId = metadata?.midilla_bundle_id as TopupBundleId;
    const credits  = metadata?.midilla_credits as number;
    if (!bundleId || !credits) return;

    const bundle = TOPUP_BUNDLES.find(b => b.id === bundleId);
    if (!bundle || bundle.credits !== credits) return;

    await supabaseAdmin.rpc('allocate_credits', {
      p_user_id:     userId,
      p_amount:      credits,
      p_description: `paystack:${tx.reference} · top-up · ${bundleId} · ${credits} credits`,
    });
  }
}

async function handleSubscriptionCreate(
  event: Extract<PaystackWebhookEvent, { event: 'subscription.create' }>
): Promise<void> {
  const { subscription_code, customer } = event.data;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('paystack_customer_id', customer.customer_code)
    .maybeSingle();

  if (!profile) return;

  await supabaseAdmin
    .from('profiles')
    .update({ paystack_sub_code: subscription_code })
    .eq('id', profile.id);
}

async function handleSubscriptionDisable(
  event: Extract<PaystackWebhookEvent, { event: 'subscription.disable' }>
): Promise<void> {
  const { subscription_code } = event.data;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('paystack_sub_code', subscription_code)
    .maybeSingle();

  if (!profile) return;

  const { data: starterTier } = await supabaseAdmin
    .from('tiers')
    .select('id')
    .eq('slug', 'starter')
    .single();

  if (!starterTier) return;

  await supabaseAdmin
    .from('profiles')
    .update({ tier_id: starterTier.id, paystack_sub_code: null })
    .eq('id', profile.id);
}

async function handleInvoiceUpdate(
  event: Extract<PaystackWebhookEvent, { event: 'invoice.update' }>
): Promise<void> {
  if (event.data.paid) return;
  console.warn('[invoice.update] Renewal failed:', event.data.subscription.subscription_code);
}
