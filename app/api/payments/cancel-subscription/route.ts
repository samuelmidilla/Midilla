import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { cancelSubscription } from '@/lib/paystack';
import type { Database } from '@/types';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { email_token } = await request.json();
  if (!email_token) {
    return NextResponse.json({ error: 'email_token is required' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('paystack_sub_code')
    .eq('id', session.user.id)
    .single();

  if (!profile?.paystack_sub_code) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  }

  await cancelSubscription({
    code:  profile.paystack_sub_code,
    token: email_token,
  });

  return NextResponse.json({
    cancelled: true,
    message: 'Subscription cancellation confirmed. Your access continues until the end of the current billing cycle.',
  });
}
