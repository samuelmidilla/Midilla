import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { initializeSubscription, initializeTopup } from '@/lib/paystack';
import type { Database } from '@/types';
import type { TopupBundleId } from '@/lib/paystack';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const { type, tier_slug, bundle_id } = body;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('email, tier_id, tiers(slug)')
    .eq('id', session.user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (type === 'subscription') {
    if (!tier_slug || !['starter', 'professional'].includes(tier_slug)) {
      return NextResponse.json(
        { error: 'tier_slug must be "starter" or "professional"' },
        { status: 400 }
      );
    }

    const result = await initializeSubscription({
      email:        profile.email,
      tier_slug:    tier_slug as 'starter' | 'professional',
      callback_url: `${appUrl}/payment/callback`,
      metadata:     { midilla_user_id: session.user.id },
    });

    return NextResponse.json({ authorization_url: result.authorization_url });
  }

  if (type === 'topup') {
    const currentTierSlug = Array.isArray(profile.tiers)
      ? profile.tiers[0]?.slug
      : (profile.tiers as { slug: string } | null)?.slug;

    if (currentTierSlug === 'starter') {
      return NextResponse.json(
        { error: 'Top-ups are available on Professional and Architect tiers only' },
        { status: 422 }
      );
    }

    if (!bundle_id) {
      return NextResponse.json({ error: 'bundle_id is required for topup' }, { status: 400 });
    }

    const result = await initializeTopup({
      email:        profile.email,
      bundle_id:    bundle_id as TopupBundleId,
      user_id:      session.user.id,
      callback_url: `${appUrl}/payment/callback`,
    });

    return NextResponse.json({ authorization_url: result.authorization_url });
  }

  return NextResponse.json({ error: 'type must be "subscription" or "topup"' }, { status: 400 });
}
