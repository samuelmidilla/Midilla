import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const secret = request.headers.get('x-midilla-internal');
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  const { data, error } = await supabaseAdmin
    .rpc('confirm_order', { p_order_id: id });

  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'Order confirmation failed' },
      { status: 422 }
    );
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('credit_balance')
    .eq('id', data.user_id)
    .single();

  return NextResponse.json({
    order: data,
    delivery_scheduled_at: data.delivery_scheduled_at,
    order_number: data.order_number,
    credits_remaining: profile?.credit_balance ?? null,
  });
}
