import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { verifyTransaction } from '@/lib/paystack';
import type { Database } from '@/types';

export async function GET(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });

  const reference = new URL(request.url).searchParams.get('reference');
  if (!reference) {
    return NextResponse.json({ error: 'reference is required' }, { status: 400 });
  }

  const transaction = await verifyTransaction(reference);

  if (transaction.status !== 'success') {
    return NextResponse.json(
      { error: 'Payment was not successful', status: transaction.status },
      { status: 422 }
    );
  }

  return NextResponse.json({
    verified: true,
    reference: transaction.reference,
    purpose: transaction.metadata?.midilla_purpose ?? 'unknown',
    tier_slug: transaction.metadata?.midilla_tier ?? null,
    credits_added: transaction.metadata?.midilla_credits ?? null,
  });
}
