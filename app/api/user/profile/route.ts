import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select(`
      id, email, full_name, credit_balance,
      billing_cycle_start, billing_cycle_end,
      created_at, updated_at,
      tiers ( id, slug, name, monthly_credits, price_usd_cents, credits_rollover, allow_topup )
    `)
    .eq('id', session.user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function PATCH(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const body = await request.json();
  const { full_name } = body;

  if (typeof full_name !== 'string' || full_name.trim().length === 0) {
    return NextResponse.json({ error: 'full_name is required' }, { status: 400 });
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .update({ full_name: full_name.trim() })
    .eq('id', session.user.id)
    .select()
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  return NextResponse.json({ profile });
}
