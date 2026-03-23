import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(`
      credit_balance,
      billing_cycle_end,
      tiers ( slug, name )
    `)
    .eq('id', session.user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  const { data: transactions } = await supabaseAdmin
    .from('credit_transactions')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(10);

  const tier = Array.isArray(profile.tiers) ? profile.tiers[0] : profile.tiers;

  return NextResponse.json({
    balance: profile.credit_balance,
    tier: tier?.slug ?? 'starter',
    tier_name: tier?.name ?? 'Starter',
    billing_cycle_end: profile.billing_cycle_end,
    recent_transactions: transactions ?? [],
  });
}
